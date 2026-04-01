import { render } from "ink";
import { Session } from "./session";
import { MessageBuffer, type BufferedMessage } from "@/ui/ink/messageBuffer";
import { RemoteModeDisplay } from "@/ui/ink/RemoteModeDisplay";
import React from "react";
import { claudeRemote } from "./claudeRemote";
import { PermissionHandler } from "./utils/permissionHandler";
import { Future } from "@/utils/future";
import { SDKAssistantMessage, SDKMessage, SDKUserMessage } from "./sdk";
import { formatClaudeMessageForInk } from "@/ui/messageFormatterInk";
import { logger } from "@/ui/logger";
import { SDKToLogConverter } from "./utils/sdkToLogConverter";
import { PLAN_FAKE_REJECT } from "./sdk/prompts";
import { EnhancedMode } from "./loop";
import { RawJSONLines } from "@/claude/types";
import { OutgoingMessageQueue } from "./utils/OutgoingMessageQueue";
import { getToolName } from "./utils/getToolName";

interface PermissionsField {
    date: number;
    result: 'approved' | 'denied';
    mode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
    allowedTools?: string[];
}

type RemoteBufferEntry = {
    type: BufferedMessage['type'];
    content: string;
};

function isRecord(value: unknown): value is Record<string, any> {
    return typeof value === 'object' && value !== null;
}

function asText(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function formatJson(value: unknown, maxLength = 400): string | null {
    if (value === undefined || value === null) {
        return null;
    }

    try {
        const formatted = JSON.stringify(value, null, 2);
        if (!formatted) {
            return null;
        }
        return formatted.length > maxLength
            ? `${formatted.slice(0, maxLength)}...`
            : formatted;
    } catch {
        return null;
    }
}

function withHeading(heading: string, text: string): string {
    return `${heading}\n${text}`;
}

function extractSessionEnvelope(body: unknown): Record<string, any> | null {
    if (!isRecord(body) || body.role !== 'session' || !isRecord(body.content)) {
        return null;
    }

    const content = body.content;
    if (content.type === 'session' && isRecord(content.data)) {
        return content.data;
    }

    if (typeof content.id === 'string' && typeof content.role === 'string' && content.ev !== undefined) {
        return content;
    }

    return null;
}

function formatSessionEnvelopeEntry(envelope: Record<string, any>): RemoteBufferEntry[] {
    if (!isRecord(envelope.ev)) {
        return [];
    }

    const role = envelope.role === 'user' ? 'user' : 'agent';
    const event = envelope.ev;

    if (event.t === 'text') {
        const text = asText(event.text);
        if (!text) {
            return [];
        }
        return [{
            type: role === 'user' ? 'user' : 'assistant',
            content: withHeading(role === 'user' ? 'You' : 'Claude', text)
        }];
    }

    if (event.t === 'service' && role === 'agent') {
        const text = asText(event.text);
        return text ? [{ type: 'status', content: text }] : [];
    }

    if (event.t === 'tool-call-start' && role === 'agent') {
        const parts = [asText(event.description), formatJson(event.args)].filter((part): part is string => !!part);
        return [{
            type: 'tool',
            content: withHeading(`Tool · ${event.name || 'unknown'}`, parts.join('\n'))
        }];
    }

    if (event.t === 'tool-call-end' && role === 'agent') {
        return [{
            type: 'result',
            content: withHeading('Tool', `Finished ${event.name || event.call || 'call'}`)
        }];
    }

    if (event.t === 'file' && role === 'agent') {
        const details = [asText(event.description), formatJson({
            name: event.name,
            ref: event.ref,
            size: event.size
        })].filter((part): part is string => !!part);
        return [{
            type: 'tool',
            content: withHeading('Attachment', details.join('\n'))
        }];
    }

    return [];
}

function formatLegacyAgentEntry(body: Record<string, any>): RemoteBufferEntry[] {
    if (!isRecord(body.content)) {
        return [];
    }

    const content = body.content;
    if (body.role === 'user' && content.type === 'text') {
        const text = asText(content.text);
        return text ? [{ type: 'user', content: withHeading('You', text) }] : [];
    }

    if (body.role !== 'agent') {
        return [];
    }

    if (content.type === 'output' && isRecord(content.data)) {
        const data = content.data;
        if (data.type === 'assistant' && isRecord(data.message) && Array.isArray(data.message.content)) {
            const entries: RemoteBufferEntry[] = [];
            const textBlocks = data.message.content
                .filter(isRecord)
                .filter((block) => block.type === 'text' || block.type === 'thinking')
                .map((block) => asText(block.text))
                .filter((text): text is string => !!text);

            if (textBlocks.length > 0) {
                entries.push({
                    type: 'assistant',
                    content: withHeading('Claude', textBlocks.join('\n\n'))
                });
            }

            for (const block of data.message.content.filter(isRecord)) {
                if (block.type !== 'tool_use') {
                    continue;
                }
                const parts = [asText(block.description), formatJson(block.input)].filter((part): part is string => !!part);
                entries.push({
                    type: 'tool',
                    content: withHeading(`Tool · ${block.name || 'unknown'}`, parts.join('\n'))
                });
            }

            return entries;
        }

        if (data.type === 'user' && isRecord(data.message)) {
            if (typeof data.message.content === 'string') {
                const text = asText(data.message.content);
                return text ? [{ type: 'user', content: withHeading('You', text) }] : [];
            }

            if (Array.isArray(data.message.content)) {
                const entries: RemoteBufferEntry[] = [];
                for (const block of data.message.content.filter(isRecord)) {
                    if (block.type !== 'tool_result') {
                        continue;
                    }
                    const resultText = typeof block.content === 'string'
                        ? block.content
                        : formatJson(block.content);
                    if (!resultText) {
                        continue;
                    }
                    entries.push({
                        type: 'result',
                        content: withHeading('Tool Result', resultText)
                    });
                }
                return entries;
            }
        }
    }

    if (content.type === 'acp' && isRecord(content.data)) {
        const provider = asText(content.provider) || 'Agent';
        const data = content.data;
        if (data.type === 'message') {
            const text = asText(data.message);
            return text ? [{ type: 'assistant', content: withHeading(provider, text) }] : [];
        }
        if (data.type === 'thinking') {
            const text = asText(data.text);
            return text ? [{ type: 'assistant', content: withHeading(`${provider} thinking`, text) }] : [];
        }
        if (data.type === 'reasoning') {
            const text = asText(data.message);
            return text ? [{ type: 'assistant', content: withHeading(`${provider} reasoning`, text) }] : [];
        }
    }

    return [];
}

export function formatRemoteHistoryEntries(messages: Array<{ body: unknown }>): RemoteBufferEntry[] {
    const entries: RemoteBufferEntry[] = [];

    for (const message of messages) {
        const envelope = extractSessionEnvelope(message.body);
        if (envelope) {
            entries.push(...formatSessionEnvelopeEntry(envelope));
            continue;
        }

        if (isRecord(message.body)) {
            entries.push(...formatLegacyAgentEntry(message.body));
        }
    }

    return entries;
}

export async function claudeRemoteLauncher(session: Session): Promise<'switch' | 'exit'> {
    logger.debug('[claudeRemoteLauncher] Starting remote launcher');

    // Check if we have a TTY for UI rendering
    const hasTTY = process.stdout.isTTY && process.stdin.isTTY;
    logger.debug(`[claudeRemoteLauncher] TTY available: ${hasTTY}`);

    // Configure terminal
    let messageBuffer = new MessageBuffer();
    let inkInstance: any = null;

    if (hasTTY) {
        console.clear();
        inkInstance = render(React.createElement(RemoteModeDisplay, {
            messageBuffer,
            logPath: process.env.DEBUG ? session.logPath : undefined,
            onExit: async () => {
                // Exit the entire client
                logger.debug('[remote]: Exiting client via Ctrl-C');
                if (!exitReason) {
                    exitReason = 'exit';
                }
                await abort();
            },
            onSwitchToLocal: () => {
                // Switch to local mode
                logger.debug('[remote]: Switching to local mode via double space');
                doSwitch();
            }
        }), {
            exitOnCtrlC: false,
            patchConsole: false
        });
    }

    if (hasTTY) {
        process.stdin.resume();
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }
        process.stdin.setEncoding("utf8");
    }

    // Handle abort
    let exitReason: 'switch' | 'exit' | null = null;
    let abortController: AbortController | null = null;
    let abortFuture: Future<void> | null = null;

    async function abort() {
        if (abortController && !abortController.signal.aborted) {
            abortController.abort();
        }
        await abortFuture?.promise;
    }

    async function doAbort() {
        logger.debug('[remote]: doAbort');
        await abort();
    }

    async function doStopSessionInner() {
        logger.debug('[remote]: doStopSession');
        if (!exitReason) {
            exitReason = 'exit';
        }
        await abort();
    }
    
    async function doStopSession() {
        void doStopSessionInner();
        return { success: true, message: 'Stopping session' };
    }

    async function doSwitch() {
        logger.debug('[remote]: doSwitch');
        if (!exitReason) {
            exitReason = 'switch';
        }
        await abort();
        return true;
    }

    // When to abort
    session.client.rpcHandlerManager.registerHandler('abort', doAbort); // When abort clicked
    session.client.rpcHandlerManager.registerHandler('switch', doSwitch); // When switch clicked
    session.client.rpcHandlerManager.registerHandler('stopSession', doStopSession);
    // Removed catch-all stdin handler - now handled by RemoteModeDisplay keyboard handlers

    // Create permission handler
    const permissionHandler = new PermissionHandler(session);

    // Create outgoing message queue
    const messageQueue = new OutgoingMessageQueue(
        (logMessage) => session.client.sendClaudeSessionMessage(logMessage)
    );

    // Set up callback to release delayed messages when permission is requested
    permissionHandler.setOnPermissionRequest((toolCallId: string) => {
        messageQueue.releaseToolCall(toolCallId);
    });

    // Create SDK to Log converter (pass responses from permissions)
    const sdkToLogConverter = new SDKToLogConverter({
        sessionId: session.sessionId || 'unknown',
        cwd: session.path,
        version: process.env.npm_package_version
    }, permissionHandler.getResponses());


    // Handle messages
    let planModeToolCalls = new Set<string>();
    let ongoingToolCalls = new Map<string, { parentToolCallId: string | null }>();

    function onMessage(message: SDKMessage) {

        // Write to message log
        formatClaudeMessageForInk(message, messageBuffer);

        // Write to permission handler for tool id resolving
        permissionHandler.onMessage(message);

        // Detect plan mode tool call
        if (message.type === 'assistant') {
            let umessage = message as SDKAssistantMessage;
            if (umessage.message.content && Array.isArray(umessage.message.content)) {
                for (let c of umessage.message.content) {
                    if (c.type === 'tool_use' && (c.name === 'exit_plan_mode' || c.name === 'ExitPlanMode')) {
                        logger.debug('[remote]: detected plan mode tool call ' + c.id!);
                        planModeToolCalls.add(c.id! as string);
                    }
                }
            }
        }

        // Track active tool calls
        if (message.type === 'assistant') {
            let umessage = message as SDKAssistantMessage;
            if (umessage.message.content && Array.isArray(umessage.message.content)) {
                for (let c of umessage.message.content) {
                    if (c.type === 'tool_use') {
                        logger.debug('[remote]: detected tool use ' + c.id! + ' parent: ' + umessage.parent_tool_use_id);
                        ongoingToolCalls.set(c.id!, { parentToolCallId: umessage.parent_tool_use_id ?? null });
                    }
                }
            }
        }
        if (message.type === 'user') {
            let umessage = message as SDKUserMessage;
            if (umessage.message.content && Array.isArray(umessage.message.content)) {
                for (let c of umessage.message.content) {
                    if (c.type === 'tool_result' && c.tool_use_id) {
                        ongoingToolCalls.delete(c.tool_use_id);

                        // When tool result received, release any delayed messages for this tool call
                        messageQueue.releaseToolCall(c.tool_use_id);
                    }
                }
            }
        }

        // Convert SDK message to log format and send to client
        let msg = message;

        // Hack plan mode exit
        if (message.type === 'user') {
            let umessage = message as SDKUserMessage;
            if (umessage.message.content && Array.isArray(umessage.message.content)) {
                msg = {
                    ...umessage,
                    message: {
                        ...umessage.message,
                        content: umessage.message.content.map((c) => {
                            if (c.type === 'tool_result' && c.tool_use_id && planModeToolCalls.has(c.tool_use_id!)) {
                                if (c.content === PLAN_FAKE_REJECT) {
                                    logger.debug('[remote]: hack plan mode exit');
                                    logger.debugLargeJson('[remote]: hack plan mode exit', c);
                                    return {
                                        ...c,
                                        is_error: false,
                                        content: 'Plan approved',
                                        mode: c.mode
                                    }
                                } else {
                                    return c;
                                }
                            }
                            return c;
                        })
                    }
                }
            }
        }

        const logMessage = sdkToLogConverter.convert(msg);
        if (logMessage) {
            // Add permissions field to tool result content
            if (logMessage.type === 'user' && logMessage.message?.content) {
                const content = Array.isArray(logMessage.message.content)
                    ? logMessage.message.content
                    : [];

                // Modify the content array to add permissions to each tool_result
                for (let i = 0; i < content.length; i++) {
                    const c = content[i];
                    if (c.type === 'tool_result' && c.tool_use_id) {
                        const responses = permissionHandler.getResponses();
                        const response = responses.get(c.tool_use_id);

                        if (response) {
                            const permissions: PermissionsField = {
                                date: response.receivedAt || Date.now(),
                                result: response.approved ? 'approved' : 'denied'
                            };

                            // Add optional fields if they exist
                            if (response.mode) {
                                permissions.mode = response.mode;
                            }

                            if (response.allowTools && response.allowTools.length > 0) {
                                permissions.allowedTools = response.allowTools;
                            }

                            // Add permissions directly to the tool_result content object
                            content[i] = {
                                ...c,
                                permissions
                            };
                        }
                    }
                }
            }

            // Queue message with optional delay for tool calls
            if (logMessage.type === 'assistant' && message.type === 'assistant') {
                const assistantMsg = message as SDKAssistantMessage;
                const toolCallIds: string[] = [];

                if (assistantMsg.message.content && Array.isArray(assistantMsg.message.content)) {
                    for (const block of assistantMsg.message.content) {
                        if (block.type === 'tool_use' && block.id) {
                            toolCallIds.push(block.id);
                        }
                    }
                }

                if (toolCallIds.length > 0) {
                    // Check if this is a sidechain tool call (has parent_tool_use_id)
                    const isSidechain = assistantMsg.parent_tool_use_id !== undefined;

                    if (!isSidechain) {
                        // Top-level tool call - queue with delay
                        messageQueue.enqueue(logMessage, {
                            delay: 250,
                            toolCallIds
                        });
                        return; // Don't queue again below
                    }
                }
            }

            // Queue all other messages immediately (no delay)
            messageQueue.enqueue(logMessage);
        }

        // Insert a fake message to start the sidechain
        if (message.type === 'assistant') {
            let umessage = message as SDKAssistantMessage;
            if (umessage.message.content && Array.isArray(umessage.message.content)) {
                for (let c of umessage.message.content) {
                    if (c.type === 'tool_use' && c.name === 'Task' && c.input && typeof (c.input as any).prompt === 'string') {
                        const logMessage2 = sdkToLogConverter.convertSidechainUserMessage(c.id!, (c.input as any).prompt);
                        if (logMessage2) {
                            messageQueue.enqueue(logMessage2);
                        }
                    }
                }
            }
        }
    }

    try {
        let pending: {
            message: string;
            mode: EnhancedMode;
        } | null = null;

        // Track session ID to detect when it actually changes
        // This prevents context loss when mode changes (permission mode, model, etc.)
        // without starting a new session. Only reset parent chain when session ID
        // actually changes (e.g., new session started or /clear command used).
        // See: https://github.com/anthropics/happy-cli/issues/143
        let previousSessionId: string | null = null;
        let hasLaunchedRemoteSession = false;
        let loadedHistorySessionId: string | null = null;
        while (!exitReason) {
            logger.debug('[remote]: launch');
            messageBuffer.addMessage('═'.repeat(40), 'status');

            const isResumingExistingSession = !hasLaunchedRemoteSession && session.sessionId !== null;
            const isNewSession = session.sessionId !== previousSessionId;
            if (isResumingExistingSession) {
                messageBuffer.addMessage('Resuming Claude session...', 'status');
                logger.debug(`[remote]: Resuming existing session on first launch: ${session.sessionId}`);
            } else if (isNewSession) {
                messageBuffer.addMessage('Starting new Claude session...', 'status');
                permissionHandler.reset(); // Reset permissions before starting new session
                sdkToLogConverter.resetParentChain(); // Reset parent chain for new conversation
                logger.debug(`[remote]: New session detected (previous: ${previousSessionId}, current: ${session.sessionId})`);
            } else {
                messageBuffer.addMessage('Continuing Claude session...', 'status');
                logger.debug(`[remote]: Continuing existing session: ${session.sessionId}`);
            }

            if (isResumingExistingSession && session.sessionId && loadedHistorySessionId !== session.sessionId) {
                const historyMessages = await session.client.getRecentMessages(18);
                const historyEntries = formatRemoteHistoryEntries(historyMessages);
                if (historyEntries.length > 0) {
                    messageBuffer.addMessage('Recent session history', 'status');
                    for (const entry of historyEntries) {
                        messageBuffer.addMessage(entry.content, entry.type);
                    }
                    messageBuffer.addMessage('─'.repeat(40), 'status');
                }
                loadedHistorySessionId = session.sessionId;
            }

            previousSessionId = session.sessionId;
            hasLaunchedRemoteSession = true;
            const controller = new AbortController();
            abortController = controller;
            abortFuture = new Future<void>();
            let modeHash: string | null = null;
            let mode: EnhancedMode | null = null;
            try {
                const remoteResult = await claudeRemote({
                    sessionId: session.sessionId,
                    path: session.path,
                    allowedTools: session.allowedTools ?? [],
                    mcpServers: session.mcpServers,
                    hookSettingsPath: session.hookSettingsPath,
                    jsRuntime: session.jsRuntime,
                    canCallTool: permissionHandler.handleToolCall,
                    isAborted: (toolCallId: string) => {
                        return permissionHandler.isAborted(toolCallId);
                    },
                    nextMessage: async () => {
                        if (pending) {
                            let p = pending;
                            pending = null;
                            permissionHandler.handleModeChange(p.mode.permissionMode);
                            return p;
                        }

                        let msg = await session.queue.waitForMessagesAndGetAsString(controller.signal);

                        // Check if mode has changed
                        if (msg) {
                            if ((modeHash && msg.hash !== modeHash) || msg.isolate) {
                                logger.debug('[remote]: mode has changed, pending message');
                                pending = msg;
                                return null;
                            }
                            modeHash = msg.hash;
                            mode = msg.mode;
                            permissionHandler.handleModeChange(mode.permissionMode);
                            return {
                                message: msg.message,
                                mode: msg.mode
                            }
                        }

                        // Exit
                        return null;
                    },
                    onSessionFound: (sessionId) => {
                        // Update converter's session ID when new session is found
                        sdkToLogConverter.updateSessionId(sessionId);
                        session.onSessionFound(sessionId);
                    },
                    onThinkingChange: session.onThinkingChange,
                    claudeEnvVars: session.claudeEnvVars,
                    claudeArgs: session.claudeArgs,
                    onMessage,
                    onCompletionEvent: (message: string) => {
                        logger.debug(`[remote]: Completion event: ${message}`);
                        session.client.sendSessionEvent({ type: 'message', message });
                    },
                    onSessionReset: () => {
                        logger.debug('[remote]: Session reset');
                        session.clearSessionId();
                    },
                    onReady: () => {
                        session.client.closeClaudeSessionTurn('completed');
                        if (!pending && session.queue.size() === 0) {
                            session.api.push().sendToAllDevices(
                                'It\'s ready!',
                                `Claude is waiting for your command`,
                                { sessionId: session.client.sessionId }
                            );
                        }
                    },
                    signal: abortController.signal,
                });
                
                // Consume one-time Claude flags after spawn
                session.consumeOneTimeFlags();
                
                if (!exitReason && abortController.signal.aborted) {
                    session.client.closeClaudeSessionTurn('cancelled');
                    session.client.sendSessionEvent({ type: 'message', message: 'Aborted by user' });
                }
            } catch (e) {
                logger.debug('[remote]: launch error', e);
                if (!exitReason) {
                    session.client.closeClaudeSessionTurn('failed');
                    session.client.sendSessionEvent({ type: 'message', message: 'Process exited unexpectedly' });
                    continue;
                }
            } finally {

                logger.debug('[remote]: launch finally');

                // Terminate all ongoing tool calls
                for (let [toolCallId, { parentToolCallId }] of ongoingToolCalls) {
                    const converted = sdkToLogConverter.generateInterruptedToolResult(toolCallId, parentToolCallId);
                    if (converted) {
                        logger.debug('[remote]: terminating tool call ' + toolCallId + ' parent: ' + parentToolCallId);
                        session.client.sendClaudeSessionMessage(converted);
                    }
                }
                ongoingToolCalls.clear();

                // Flush any remaining messages in the queue
                logger.debug('[remote]: flushing message queue');
                await messageQueue.flush();
                messageQueue.destroy();
                logger.debug('[remote]: message queue flushed');

                // Reset abort controller and future
                abortController = null;
                abortFuture?.resolve(undefined);
                abortFuture = null;
                logger.debug('[remote]: launch done');
                permissionHandler.reset();
                modeHash = null;
                mode = null;
            }
        }
    } finally {

        // Clean up permission handler
        permissionHandler.reset();

        // Reset Terminal
        process.stdin.off('data', abort);
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }
        if (inkInstance) {
            inkInstance.unmount();
        }
        messageBuffer.clear();

        // Resolve abort future
        if (abortFuture) { // Just in case of error
            abortFuture.resolve(undefined);
        }
    }

    return exitReason || 'exit';
}
