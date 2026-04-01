import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockedClaudeLocalLauncher,
    mockedClaudeRemoteLauncher,
    sessionOnModeChangeSpy,
    SessionMock
} = vi.hoisted(() => {
    const mockedClaudeLocalLauncher = vi.fn();
    const mockedClaudeRemoteLauncher = vi.fn();
    const sessionOnModeChangeSpy = vi.fn(function (this: any, mode: 'local' | 'remote') {
        this.mode = mode;
        this._onModeChange(mode);
    });
    const SessionMock = vi.fn().mockImplementation((opts: any) => ({
        mode: 'local',
        sessionId: null,
        path: opts.path,
        _onModeChange: opts.onModeChange,
        onModeChange: sessionOnModeChangeSpy
    }));

    return {
        mockedClaudeLocalLauncher,
        mockedClaudeRemoteLauncher,
        sessionOnModeChangeSpy,
        SessionMock
    };
});

vi.mock('./session', () => ({
    Session: SessionMock
}));

vi.mock('./claudeLocalLauncher', () => ({
    claudeLocalLauncher: mockedClaudeLocalLauncher
}));

vi.mock('./claudeRemoteLauncher', () => ({
    claudeRemoteLauncher: mockedClaudeRemoteLauncher
}));

import { loop } from './loop';

describe('loop mode propagation', () => {
    beforeEach(() => {
        mockedClaudeLocalLauncher.mockReset();
        mockedClaudeRemoteLauncher.mockReset();
        sessionOnModeChangeSpy.mockClear();
        SessionMock.mockClear();
    });

    it('updates Session mode when local switches to remote', async () => {
        mockedClaudeLocalLauncher.mockResolvedValueOnce({ type: 'switch' });
        mockedClaudeRemoteLauncher.mockResolvedValueOnce('exit');
        const onModeChange = vi.fn();

        await loop({
            path: '/tmp',
            startingMode: 'local',
            onModeChange,
            mcpServers: {},
            session: { keepAlive: vi.fn() } as any,
            api: {} as any,
            messageQueue: {} as any,
            hookSettingsPath: '/tmp/hook-settings.json'
        });

        expect(sessionOnModeChangeSpy).toHaveBeenCalledWith('remote');
        expect(onModeChange).toHaveBeenCalledWith('remote');
    });

    it('updates Session mode when remote switches back to local', async () => {
        mockedClaudeRemoteLauncher.mockResolvedValueOnce('switch');
        mockedClaudeLocalLauncher.mockResolvedValueOnce({ type: 'exit', code: 0 });
        const onModeChange = vi.fn();

        await loop({
            path: '/tmp',
            startingMode: 'remote',
            onModeChange,
            mcpServers: {},
            session: { keepAlive: vi.fn() } as any,
            api: {} as any,
            messageQueue: {} as any,
            hookSettingsPath: '/tmp/hook-settings.json'
        });

        expect(sessionOnModeChangeSpy).toHaveBeenCalledWith('local');
        expect(onModeChange).toHaveBeenCalledWith('local');
    });
});
