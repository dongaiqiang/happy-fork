import { buildNewMessageUpdate, buildSessionControlUpdate, eventRouter } from "@/app/events/eventRouter";
import { db } from "@/storage/db";
import { allocateSessionSeqBatch, allocateUserSeq } from "@/storage/seq";
import { randomKeyNaked } from "@/utils/randomKeyNaked";
import { z } from "zod";
import { type Fastify } from "../types";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import tweetnacl from "tweetnacl";
import { checkSubscriptionValidity, estimateTokens, getQuotaLimitExceededResponse, getUserQuota, updateUsage } from "@/app/api/middleware/tokenQuota";

const getMessagesQuerySchema = z.object({
    after_seq: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(500).default(100)
});

const sendMessagesBodySchema = z.object({
    messages: z.array(z.object({
        content: z.string(),
        localId: z.string().min(1)
    })).min(1).max(100)
});

const controllerSchema = z.enum(['mobile', 'mac']);
const handoffStateSchema = z.enum(['idle', 'switching', 'failed']);
const controlStateBodySchema = z.object({
    expectedLeaseVersion: z.number().int().min(0)
});
const handoffMacBodySchema = controlStateBodySchema.extend({
    machineId: z.string().min(1),
    directory: z.string().min(1),
    claudeSessionId: z.string().min(1),
    tmuxSessionId: z.string().min(1).optional(),
    openTerminal: z.boolean().optional(),
    terminalCarrierMode: z.enum(['direct', 'hosted']).optional(),
    approvedNewDirectoryCreation: z.boolean().optional()
});
const controllerSwitchBodySchema = controlStateBodySchema.extend({
    targetController: controllerSchema
});

type SelectedMessage = {
    id: string;
    seq: number;
    content: unknown;
    localId: string | null;
    createdAt: Date;
    updatedAt: Date;
};

type SessionControlState = {
    id: string;
    controller: 'mobile' | 'mac';
    controllerLeaseVersion: number;
    handoffState: 'idle' | 'switching' | 'failed';
    handoffReason: string | null;
    controllerUpdatedAt: Date;
};

function toResponseMessage(message: SelectedMessage) {
    return {
        id: message.id,
        seq: message.seq,
        content: message.content,
        localId: message.localId,
        createdAt: message.createdAt.getTime(),
        updatedAt: message.updatedAt.getTime()
    };
}

function toSendResponseMessage(message: Omit<SelectedMessage, "content">) {
    return {
        id: message.id,
        seq: message.seq,
        localId: message.localId,
        createdAt: message.createdAt.getTime(),
        updatedAt: message.updatedAt.getTime()
    };
}

function toControlStateResponse(state: SessionControlState) {
    return {
        sessionId: state.id,
        controller: state.controller,
        leaseVersion: state.controllerLeaseVersion,
        handoffState: state.handoffState,
        handoffReason: state.handoffReason,
        controllerUpdatedAt: state.controllerUpdatedAt.getTime()
    };
}

function normalizeHandoffFailureReason(rawReason: string): string {
    const normalized = rawReason.trim().toLowerCase();
    if (normalized === 'not found' || normalized.includes('no conversation found')) {
        return 'claude-session-not-found';
    }
    if (normalized.includes('permission denied') || normalized.includes('eacces')) {
        return 'permission-denied';
    }
    if (normalized.includes('rpc method not available')) {
        return 'rpc-method-not-available';
    }
    return rawReason;
}

function encodeBase64(data: Uint8Array): string {
    return Buffer.from(data).toString('base64');
}

function decodeBase64(data: string): Uint8Array {
    return new Uint8Array(Buffer.from(data, 'base64'));
}

function encodePlaintextRpcPayload(payload: any): string {
    return encodeBase64(new TextEncoder().encode(`PLAINTEXT:${JSON.stringify(payload)}`));
}

function decodePlaintextRpcPayload(payload: string): any | null {
    try {
        const decoded = new TextDecoder().decode(decodeBase64(payload));
        const jsonStartIndex = Math.max(decoded.indexOf('{'), decoded.indexOf('['));
        if (jsonStartIndex === -1) {
            return null;
        }
        return JSON.parse(decoded.slice(jsonStartIndex));
    } catch {
        return null;
    }
}

function encryptLegacy(data: any, key: Uint8Array): Uint8Array {
    const nonce = new Uint8Array(randomBytes(tweetnacl.secretbox.nonceLength));
    const encrypted = tweetnacl.secretbox(new TextEncoder().encode(JSON.stringify(data)), nonce, key);
    const result = new Uint8Array(nonce.length + encrypted.length);
    result.set(nonce);
    result.set(encrypted, nonce.length);
    return result;
}

function decryptLegacy(data: Uint8Array, key: Uint8Array): any | null {
    const nonce = data.slice(0, tweetnacl.secretbox.nonceLength);
    const encrypted = data.slice(tweetnacl.secretbox.nonceLength);
    const decrypted = tweetnacl.secretbox.open(encrypted, nonce, key);
    if (!decrypted) {
        return null;
    }
    return JSON.parse(new TextDecoder().decode(decrypted));
}

function encryptDataKey(data: any, key: Uint8Array): Uint8Array {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    const plaintext = new TextEncoder().encode(JSON.stringify(data));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const bundle = new Uint8Array(1 + 12 + ciphertext.length + 16);
    bundle[0] = 0;
    bundle.set(nonce, 1);
    bundle.set(new Uint8Array(ciphertext), 13);
    bundle.set(new Uint8Array(authTag), 13 + ciphertext.length);
    return bundle;
}

function decryptDataKey(data: Uint8Array, key: Uint8Array): any | null {
    if (data.length < 29 || data[0] !== 0) {
        return null;
    }
    const nonce = data.slice(1, 13);
    const authTag = data.slice(data.length - 16);
    const ciphertext = data.slice(13, data.length - 16);
    try {
        const decipher = createDecipheriv('aes-256-gcm', key, nonce);
        decipher.setAuthTag(Buffer.from(authTag));
        const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertext)), decipher.final()]);
        return JSON.parse(new TextDecoder().decode(plaintext));
    } catch {
        return null;
    }
}

function tryDecryptRpcPayload(payload: string, key: Uint8Array): any | null {
    const bytes = decodeBase64(payload);
    const dataKeyResult = decryptDataKey(bytes, key);
    if (dataKeyResult !== null) {
        return dataKeyResult;
    }
    return decryptLegacy(bytes, key);
}

function encryptRpcPayload(payload: any, key: Uint8Array, variant: 'dataKey' | 'legacy'): string {
    const encrypted = variant === 'dataKey'
        ? encryptDataKey(payload, key)
        : encryptLegacy(payload, key);
    return encodeBase64(encrypted);
}

async function callConnectionRpcPlaintext(
    connectionSocket: any,
    method: string,
    params: any
): Promise<{ success: boolean; result?: any; error?: string }> {
    let directEventError: string | undefined;
    try {
        const response = await connectionSocket.timeout(30000).emitWithAck('rpc-request-plaintext', {
            method,
            params
        });
        if (!response || typeof response !== 'object') {
            return { success: false, error: 'invalid-rpc-response' };
        }
        if (typeof response.error === 'string') {
            return { success: false, error: response.error };
        }
        return { success: true, result: response };
    } catch (error) {
        directEventError = error instanceof Error ? error.message : 'rpc-call-failed';
    }

    try {
        const response = await connectionSocket.timeout(30000).emitWithAck('rpc-request', {
            method,
            params: encodePlaintextRpcPayload(params)
        });
        if (typeof response !== 'string') {
            return { success: false, error: 'invalid-rpc-response' };
        }
        const decoded = decodePlaintextRpcPayload(response);
        if (decoded === null) {
            return { success: false, error: 'invalid-rpc-response' };
        }
        if (decoded && typeof decoded === 'object' && typeof decoded.error === 'string') {
            return { success: false, error: decoded.error };
        }
        return { success: true, result: decoded };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : (directEventError ?? 'rpc-call-failed')
        };
    }
}

async function callConnectionRpcWithVariantRetry(
    connectionSocket: any,
    method: string,
    params: any,
    key: Uint8Array
): Promise<{ success: boolean; result?: any; error?: string }> {
    if (key.length !== 32) {
        return callConnectionRpcPlaintext(connectionSocket, method, params);
    }
    const variants: Array<'dataKey' | 'legacy'> = ['dataKey', 'legacy'];
    let lastError = 'rpc-call-failed';
    for (const variant of variants) {
        const encodedParams = encryptRpcPayload(params, key, variant);
        try {
            const response = await connectionSocket.timeout(30000).emitWithAck('rpc-request', {
                method,
                params: encodedParams
            });
            if (typeof response !== 'string') {
                lastError = 'invalid-rpc-response';
                continue;
            }
            const decoded = tryDecryptRpcPayload(response, key);
            if (decoded === null) {
                lastError = 'rpc-response-decrypt-failed';
                continue;
            }
            if (decoded && typeof decoded === 'object' && typeof decoded.error === 'string') {
                lastError = decoded.error;
                continue;
            }
            return { success: true, result: decoded };
        } catch (error) {
            lastError = error instanceof Error ? error.message : 'rpc-call-failed';
        }
    }
    return { success: false, error: lastError };
}

async function loadSessionControlState(userId: string, sessionId: string): Promise<SessionControlState | null> {
    const row = await db.session.findFirst({
        where: {
            id: sessionId,
            accountId: userId
        },
        select: {
            id: true,
            controller: true,
            controllerLeaseVersion: true,
            handoffState: true,
            handoffReason: true,
            controllerUpdatedAt: true
        }
    });
    if (!row) {
        return null;
    }
    return {
        ...row,
        controller: controllerSchema.parse(row.controller),
        handoffState: handoffStateSchema.parse(row.handoffState)
    };
}

async function emitSessionControlStateUpdate(userId: string, state: SessionControlState): Promise<void> {
    const updateSeq = await allocateUserSeq(userId);
    const updatePayload = buildSessionControlUpdate(state.id, updateSeq, randomKeyNaked(12), {
        controller: state.controller,
        leaseVersion: state.controllerLeaseVersion,
        handoffState: state.handoffState,
        handoffReason: state.handoffReason,
        controllerUpdatedAt: state.controllerUpdatedAt.getTime()
    });
    eventRouter.emitUpdate({
        userId,
        payload: updatePayload,
        recipientFilter: { type: 'all-interested-in-session', sessionId: state.id }
    });
}

const HANDOFF_SWITCHING_STALE_MS = 60_000;

async function markSessionHandoffFailed(userId: string, sessionId: string, reason: string): Promise<SessionControlState | null> {
    await db.session.updateMany({
        where: { id: sessionId, accountId: userId },
        data: {
            handoffState: 'failed',
            handoffReason: reason,
            controllerUpdatedAt: new Date()
        }
    });
    const failedState = await loadSessionControlState(userId, sessionId);
    if (failedState) {
        await emitSessionControlStateUpdate(userId, failedState);
    }
    return failedState;
}

export function v3SessionRoutes(app: Fastify) {
    app.get('/v3/sessions/:sessionId/control-state', {
        preHandler: app.authenticate,
        schema: {
            params: z.object({
                sessionId: z.string()
            })
        }
    }, async (request, reply) => {
        const userId = request.userId;
        const { sessionId } = request.params;
        const state = await loadSessionControlState(userId, sessionId);
        if (!state) {
            return reply.code(404).send({ error: 'Session not found' });
        }
        return reply.send({
            success: true,
            state: toControlStateResponse(state)
        });
    });

    app.post('/v3/sessions/:sessionId/controller-switch', {
        preHandler: app.authenticate,
        schema: {
            params: z.object({
                sessionId: z.string()
            }),
            body: controllerSwitchBodySchema
        }
    }, async (request, reply) => {
        const userId = request.userId;
        const { sessionId } = request.params;
        const { targetController, expectedLeaseVersion } = request.body;
        let current = await loadSessionControlState(userId, sessionId);
        if (!current) {
            return reply.code(404).send({ error: 'Session not found' });
        }
        if (current.handoffState === 'switching') {
            const switchingAge = Date.now() - current.controllerUpdatedAt.getTime();
            if (switchingAge >= HANDOFF_SWITCHING_STALE_MS) {
                const recovered = await markSessionHandoffFailed(userId, sessionId, 'switching-timeout-recovered');
                if (recovered) {
                    current = recovered;
                }
            }
        }
        if (current.handoffState === 'switching') {
            return reply.code(409).send({
                success: false,
                error: 'switching-in-progress',
                state: toControlStateResponse(current)
            });
        }
        if (current.controllerLeaseVersion !== expectedLeaseVersion) {
            return reply.code(409).send({
                success: false,
                error: 'lease-version-mismatch',
                state: toControlStateResponse(current)
            });
        }
        if (current.controller === targetController && current.handoffState === 'idle') {
            return reply.send({
                success: true,
                noOp: true,
                state: toControlStateResponse(current)
            });
        }
        const now = new Date();
        const updated = await db.session.updateMany({
            where: {
                id: sessionId,
                accountId: userId,
                controllerLeaseVersion: expectedLeaseVersion,
                handoffState: { not: 'switching' }
            },
            data: {
                controller: targetController,
                controllerLeaseVersion: expectedLeaseVersion + 1,
                handoffState: 'idle',
                handoffReason: null,
                controllerUpdatedAt: now
            }
        });
        if (updated.count === 0) {
            const latest = await loadSessionControlState(userId, sessionId);
            return reply.code(409).send({
                success: false,
                error: 'cas-conflict',
                state: latest ? toControlStateResponse(latest) : null
            });
        }
        const state = await loadSessionControlState(userId, sessionId);
        if (!state) {
            return reply.code(404).send({ error: 'Session not found' });
        }
        await emitSessionControlStateUpdate(userId, state);
        return reply.send({
            success: true,
            state: toControlStateResponse(state)
        });
    });

    app.post('/v3/sessions/:sessionId/handoff/mac', {
        preHandler: app.authenticate,
        schema: {
            params: z.object({
                sessionId: z.string()
            }),
            body: handoffMacBodySchema
        }
    }, async (request, reply) => {
        const userId = request.userId;
        const { sessionId } = request.params;
        const { expectedLeaseVersion, machineId, directory, claudeSessionId, tmuxSessionId, openTerminal = true, terminalCarrierMode = 'hosted', approvedNewDirectoryCreation = false } = request.body;
        const current = await loadSessionControlState(userId, sessionId);
        if (!current) {
            return reply.code(404).send({ error: 'Session not found' });
        }
        if (current.handoffState === 'switching') {
            return reply.code(409).send({
                success: false,
                error: 'switching-in-progress',
                state: toControlStateResponse(current)
            });
        }
        if (current.controllerLeaseVersion !== expectedLeaseVersion) {
            return reply.code(409).send({
                success: false,
                error: 'lease-version-mismatch',
                state: toControlStateResponse(current)
            });
        }
        try {
            const switchingUpdated = await db.session.updateMany({
                where: {
                    id: sessionId,
                    accountId: userId,
                    controllerLeaseVersion: expectedLeaseVersion,
                    handoffState: { not: 'switching' }
                },
                data: {
                    handoffState: 'switching',
                    handoffReason: null,
                    controllerUpdatedAt: new Date()
                }
            });
            if (switchingUpdated.count === 0) {
                const latest = await loadSessionControlState(userId, sessionId);
                return reply.code(409).send({
                    success: false,
                    error: 'cas-conflict',
                    state: latest ? toControlStateResponse(latest) : null
                });
            }
            const switchingState = await loadSessionControlState(userId, sessionId);
            if (!switchingState) {
                return reply.code(404).send({ error: 'Session not found' });
            }
            await emitSessionControlStateUpdate(userId, switchingState);

        const machineWithKey = await db.machine.findFirst({
            where: {
                id: machineId,
                accountId: userId
            },
            select: {
                id: true,
                dataEncryptionKey: true,
                active: true
            }
        });
        if (!machineWithKey?.dataEncryptionKey || !machineWithKey.active) {
            await db.session.updateMany({
                where: { id: sessionId, accountId: userId },
                data: {
                    handoffState: 'failed',
                    handoffReason: 'machine-offline-or-missing-key',
                    controllerUpdatedAt: new Date()
                }
            });
            const failedState = await loadSessionControlState(userId, sessionId);
            if (failedState) {
                await emitSessionControlStateUpdate(userId, failedState);
            }
            return reply.code(502).send({
                success: false,
                error: 'machine-offline-or-missing-key',
                state: failedState ? toControlStateResponse(failedState) : null
            });
        }

        const connections = eventRouter.getConnections(userId);
        const machineConnection = connections
            ? Array.from(connections).find((connection) => (
                connection.connectionType === 'machine-scoped'
                && connection.machineId === machineId
                && connection.socket.connected
            ))
            : undefined;
        if (!machineConnection || machineConnection.connectionType !== 'machine-scoped') {
            await db.session.updateMany({
                where: { id: sessionId, accountId: userId },
                data: {
                    handoffState: 'failed',
                    handoffReason: 'machine-rpc-unavailable',
                    controllerUpdatedAt: new Date()
                }
            });
            const failedState = await loadSessionControlState(userId, sessionId);
            if (failedState) {
                await emitSessionControlStateUpdate(userId, failedState);
            }
            return reply.code(502).send({
                success: false,
                error: 'machine-rpc-unavailable',
                state: failedState ? toControlStateResponse(failedState) : null
            });
        }

        const spawnResult = await callConnectionRpcWithVariantRetry(
            machineConnection.socket,
            `${machineId}:spawn-happy-session`,
            {
                directory,
                sessionId: claudeSessionId,
                happySessionId: sessionId,
                tmuxSessionId,
                machineId,
                openTerminal,
                terminalCarrierMode,
                approvedNewDirectoryCreation,
                agent: 'claude'
            },
            new Uint8Array(machineWithKey.dataEncryptionKey)
        );
        if (!spawnResult.success) {
            await db.session.updateMany({
                where: { id: sessionId, accountId: userId },
                data: {
                    handoffState: 'failed',
                    handoffReason: `resume-failed:${spawnResult.error ?? 'unknown'}`,
                    controllerUpdatedAt: new Date()
                }
            });
            const failedState = await loadSessionControlState(userId, sessionId);
            if (failedState) {
                await emitSessionControlStateUpdate(userId, failedState);
            }
            return reply.code(502).send({
                success: false,
                error: 'resume-failed',
                state: failedState ? toControlStateResponse(failedState) : null
            });
        }

        const spawnPayload = spawnResult.result as { type?: string; sessionId?: string; errorMessage?: string } | undefined;
        if (!spawnPayload || spawnPayload.type !== 'success' || !spawnPayload.sessionId) {
            const reason = spawnPayload?.type === 'requestToApproveDirectoryCreation'
                ? 'resume-needs-directory-approval'
                : normalizeHandoffFailureReason(spawnPayload?.errorMessage || 'resume-invalid-response');
            await db.session.updateMany({
                where: { id: sessionId, accountId: userId },
                data: {
                    handoffState: 'failed',
                    handoffReason: reason,
                    controllerUpdatedAt: new Date()
                }
            });
            const failedState = await loadSessionControlState(userId, sessionId);
            if (failedState) {
                await emitSessionControlStateUpdate(userId, failedState);
            }
            return reply.code(502).send({
                success: false,
                error: reason,
                state: failedState ? toControlStateResponse(failedState) : null
            });
        }

        const finalized = await db.session.updateMany({
            where: {
                id: sessionId,
                accountId: userId,
                controllerLeaseVersion: expectedLeaseVersion,
                handoffState: 'switching'
            },
            data: {
                controller: 'mac',
                controllerLeaseVersion: expectedLeaseVersion + 1,
                handoffState: 'idle',
                handoffReason: null,
                controllerUpdatedAt: new Date()
            }
        });
        if (finalized.count === 0) {
            await db.session.updateMany({
                where: {
                    id: sessionId,
                    accountId: userId,
                    handoffState: 'switching'
                },
                data: {
                    handoffState: 'failed',
                    handoffReason: 'handoff-finalize-failed',
                    controllerUpdatedAt: new Date()
                }
            });
            const failedState = await loadSessionControlState(userId, sessionId);
            if (failedState) {
                await emitSessionControlStateUpdate(userId, failedState);
            }
            return reply.code(500).send({
                success: false,
                error: 'handoff-finalize-failed',
                state: failedState ? toControlStateResponse(failedState) : null
            });
        }
            const finalState = await loadSessionControlState(userId, sessionId);
            if (!finalState) {
                return reply.code(404).send({ error: 'Session not found' });
            }
            await emitSessionControlStateUpdate(userId, finalState);
            return reply.send({
                success: true,
                resumedHappySessionId: spawnPayload.sessionId,
                state: toControlStateResponse(finalState)
            });
        } catch (error) {
            const failedState = await markSessionHandoffFailed(userId, sessionId, 'handoff-internal-error');
            const message = error instanceof Error ? error.message : 'handoff-internal-error';
            return reply.code(500).send({
                success: false,
                error: 'handoff-internal-error',
                message,
                state: failedState ? toControlStateResponse(failedState) : null
            });
        }
    });

    app.get('/v3/sessions/:sessionId/messages', {
        preHandler: app.authenticate,
        schema: {
            params: z.object({
                sessionId: z.string()
            }),
            querystring: getMessagesQuerySchema
        }
    }, async (request, reply) => {
        const userId = request.userId;
        const { sessionId } = request.params;
        const { after_seq, limit } = request.query;

        const session = await db.session.findFirst({
            where: {
                id: sessionId,
                accountId: userId
            },
            select: {
                id: true,
                controller: true,
                handoffState: true
            }
        });

        if (!session) {
            return reply.code(404).send({ error: 'Session not found' });
        }

        if (session.handoffState === 'switching') {
            return reply.code(409).send({
                error: 'switching-in-progress'
            });
        }

        const messages = await db.sessionMessage.findMany({
            where: {
                sessionId,
                seq: { gt: after_seq }
            },
            orderBy: { seq: 'asc' },
            take: limit + 1,
            select: {
                id: true,
                seq: true,
                content: true,
                localId: true,
                createdAt: true,
                updatedAt: true
            }
        });

        const hasMore = messages.length > limit;
        const page = hasMore ? messages.slice(0, limit) : messages;

        return reply.send({
            messages: page.map(toResponseMessage),
            hasMore
        });
    });

    app.post('/v3/sessions/:sessionId/messages', {
        preHandler: app.authenticate,
        schema: {
            params: z.object({
                sessionId: z.string()
            }),
            body: sendMessagesBodySchema
        }
    }, async (request, reply) => {
        const userId = request.userId;
        const { sessionId } = request.params;
        const { messages } = request.body;
        const writerSourceHeader = request.headers['x-happy-message-source'];
        const isCliWriter = writerSourceHeader === 'cli';

        const validity = await checkSubscriptionValidity(userId);
        if (!validity.allowed && validity.response) {
            return reply.code(429).send(validity.response);
        }

        // 估算本次请求的 tokens 消耗
        const estimatedTokens = messages.reduce((sum, msg) => {
            return sum + estimateTokens(msg.content);
        }, 0);

        // 检查配额
        const quota = await getUserQuota(userId);
        if (quota && estimatedTokens > quota.dailyRemaining) {
            return reply.code(429).send(getQuotaLimitExceededResponse({
                reason: 'daily_limit_exceeded',
                estimated: estimatedTokens,
                quota,
            }));
        }

        if (quota && estimatedTokens > quota.monthlyRemaining) {
            return reply.code(429).send(getQuotaLimitExceededResponse({
                reason: 'monthly_limit_exceeded',
                estimated: estimatedTokens,
                quota,
            }));
        }

        const session = await db.session.findFirst({
            where: {
                id: sessionId,
                accountId: userId
            },
            select: {
                id: true,
                controller: true,
                handoffState: true
            }
        });

        if (!session) {
            return reply.code(404).send({ error: 'Session not found' });
        }

        if (session.handoffState === 'switching') {
            return reply.code(409).send({ error: 'switching-in-progress' });
        }

        if (session.controller !== 'mobile' && !isCliWriter) {
            return reply.code(409).send({ error: 'mobile-controller-required' });
        }

        const firstMessageByLocalId = new Map<string, { localId: string; content: string }>();
        for (const message of messages) {
            if (!firstMessageByLocalId.has(message.localId)) {
                firstMessageByLocalId.set(message.localId, message);
            }
        }

        const uniqueMessages = Array.from(firstMessageByLocalId.values());
        const contentByLocalId = new Map(uniqueMessages.map((message) => [message.localId, message.content]));

        const txResult = await db.$transaction(async (tx) => {
            const localIds = uniqueMessages.map((message) => message.localId);
            const existing = await tx.sessionMessage.findMany({
                where: {
                    sessionId,
                    localId: { in: localIds }
                },
                select: {
                    id: true,
                    seq: true,
                    localId: true,
                    createdAt: true,
                    updatedAt: true
                }
            });

            const existingByLocalId = new Map<string, Omit<SelectedMessage, 'content'>>();
            for (const message of existing) {
                if (message.localId) {
                    existingByLocalId.set(message.localId, message);
                }
            }

            const newMessages = uniqueMessages.filter((message) => !existingByLocalId.has(message.localId));
            const seqs = await allocateSessionSeqBatch(sessionId, newMessages.length, tx);

            const createdMessages: Omit<SelectedMessage, 'content'>[] = [];
            for (let i = 0; i < newMessages.length; i += 1) {
                const message = newMessages[i];
                const createdMessage = await tx.sessionMessage.create({
                    data: {
                        sessionId,
                        seq: seqs[i],
                        content: {
                            t: 'encrypted',
                            c: message.content
                        },
                        localId: message.localId
                    },
                    select: {
                        id: true,
                        seq: true,
                        content: true,
                        localId: true,
                        createdAt: true,
                        updatedAt: true
                    }
                });
                createdMessages.push(createdMessage);
            }

            const responseMessages = [...existing, ...createdMessages].sort((a, b) => a.seq - b.seq);

            return {
                responseMessages,
                createdMessages
            };
        });

        for (const message of txResult.createdMessages) {
            const content = message.localId ? contentByLocalId.get(message.localId) : null;
            if (!content) {
                continue;
            }
            const updSeq = await allocateUserSeq(userId);
            const updatePayload = buildNewMessageUpdate({
                ...message,
                content: {
                    t: 'encrypted',
                    c: content
                }
            }, sessionId, updSeq, randomKeyNaked(12));

            eventRouter.emitUpdate({
                userId,
                payload: updatePayload,
                recipientFilter: { type: 'all-interested-in-session', sessionId }
            });
        }

        // 更新用量记录
        await updateUsage(userId, estimatedTokens, sessionId);

        return reply.send({
            messages: txResult.responseMessages.map(toSendResponseMessage),
            quota: quota ? {
                dailyRemaining: quota.dailyRemaining - estimatedTokens,
                monthlyRemaining: quota.monthlyRemaining - estimatedTokens,
            } : undefined,
        });
    });
}
