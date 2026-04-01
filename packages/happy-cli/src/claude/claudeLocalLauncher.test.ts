import { beforeEach, describe, expect, it, vi } from 'vitest';
import { claudeLocalLauncher } from './claudeLocalLauncher';
import { ExitCodeError, claudeLocal } from './claudeLocal';
import { createSessionScanner } from './utils/sessionScanner';

vi.mock('./utils/sessionScanner', () => ({
    createSessionScanner: vi.fn()
}));

vi.mock('./claudeLocal', async () => {
    const actual = await vi.importActual<typeof import('./claudeLocal')>('./claudeLocal');
    return {
        ...actual,
        claudeLocal: vi.fn()
    };
});

describe('claudeLocalLauncher', () => {
    const handlers = new Map<string, (...args: any[]) => any>();
    const mockedClaudeLocal = vi.mocked(claudeLocal);
    const mockedCreateSessionScanner = vi.mocked(createSessionScanner);

    beforeEach(() => {
        handlers.clear();
        mockedCreateSessionScanner.mockReset();
        mockedClaudeLocal.mockReset();
    });

    it('returns switch when local session is asked to switch and the child exits with code 143', async () => {
        mockedCreateSessionScanner.mockResolvedValue({
            onNewSession: vi.fn(),
            cleanup: vi.fn()
        } as any);

        mockedClaudeLocal.mockImplementation(async ({ abort }) => {
            return await new Promise<string | null>((_, reject) => {
                abort.addEventListener('abort', () => {
                    reject(new ExitCodeError(143));
                }, { once: true });

                queueMicrotask(() => {
                    void handlers.get('switch')?.();
                });
            });
        });

        const closeClaudeSessionTurn = vi.fn();
        const session = {
            path: '/tmp',
            sessionId: 'session-1',
            onThinkingChange: vi.fn(),
            claudeEnvVars: undefined,
            claudeArgs: undefined,
            mcpServers: {},
            allowedTools: undefined,
            hookSettingsPath: '/tmp/hook-settings.json',
            sandboxConfig: undefined,
            addSessionFoundCallback: vi.fn(),
            removeSessionFoundCallback: vi.fn(),
            consumeOneTimeFlags: vi.fn(),
            onSessionFound: vi.fn(),
            queue: {
                reset: vi.fn(),
                size: vi.fn(() => 0),
                setOnMessage: vi.fn()
            },
            client: {
                closeClaudeSessionTurn,
                sendSessionEvent: vi.fn(),
                rpcHandlerManager: {
                    registerHandler: vi.fn((method: string, handler: (...args: any[]) => any) => {
                        handlers.set(method, handler);
                    })
                }
            }
        } as any;

        const result = await claudeLocalLauncher(session);

        expect(result).toEqual({ type: 'switch' });
        expect(closeClaudeSessionTurn).toHaveBeenCalledWith('cancelled');
    });
});
