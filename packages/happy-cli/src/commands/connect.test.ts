import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/persistence', () => ({
    readCredentials: vi.fn(),
}));

vi.mock('@/api/api', () => ({
    ApiClient: {
        create: vi.fn(),
    },
}));

vi.mock('./connect/authenticateCodex', () => ({
    authenticateCodex: vi.fn(),
}));

vi.mock('./connect/authenticateClaude', () => ({
    authenticateClaude: vi.fn(),
}));

vi.mock('./connect/authenticateGemini', () => ({
    authenticateGemini: vi.fn(),
}));

vi.mock('./connect/utils', () => ({
    decodeJwtPayload: vi.fn(),
}));

describe('handleConnectCommand help output', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('shows the hellovibe-ai key management url', async () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const { handleConnectCommand } = await import('./connect');

        await handleConnectCommand(['help']);

        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('https://app.hellovibe-ai.com'));
    });
});
