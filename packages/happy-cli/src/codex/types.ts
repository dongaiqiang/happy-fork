/**
 * Type definitions for Codex MCP integration
 */

export interface CodexSessionConfig {
    prompt: string;
    'approval-policy'?: 'untrusted' | 'on-failure' | 'on-request' | 'never';
    'base-instructions'?: string;
    config?: Record<string, any>;
    cwd?: string;
    'include-plan-tool'?: boolean;
    model?: string;
    profile?: string;
    sandbox?: 'read-only' | 'workspace-write' | 'danger-full-access';
}

export interface CodexToolResponse {
    content: Array<{
        type: 'text' | 'image' | 'resource';
        text?: string;
        data?: any;
        mimeType?: string;
    }>;
    isError?: boolean;
}


export function getCodexToolErrorMessage(response: CodexToolResponse | null | undefined): string | null {
    if (!response?.isError) {
        return null;
    }

    for (const item of response.content ?? []) {
        if (item.type === 'text' && typeof item.text === 'string') {
            const message = item.text.trim();
            if (message) {
                return message;
            }
        }
    }

    return 'Codex tool request failed';
}
