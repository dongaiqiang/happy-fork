import { afterEach, describe, expect, it } from 'vitest';
import type { SandboxConfig } from '@/persistence';
import { createSessionMetadata } from './createSessionMetadata';

function createSandboxConfig(overrides: Partial<SandboxConfig> = {}): SandboxConfig {
    return {
        enabled: true,
        workspaceRoot: '~/Developer',
        sessionIsolation: 'workspace',
        customWritePaths: [],
        denyReadPaths: ['~/.ssh', '~/.aws', '~/.gnupg'],
        extraWritePaths: ['/tmp'],
        denyWritePaths: ['.env'],
        networkMode: 'allowed',
        allowedDomains: [],
        deniedDomains: [],
        allowLocalBinding: true,
        ...overrides,
    };
}

describe('createSessionMetadata', () => {
    afterEach(() => {
        delete process.env.HAPPY_TERMINAL_CARRIER;
        delete process.env.HAPPY_TMUX_SESSION_ID;
    });

    it('sets metadata.sandbox to the config when enabled', () => {
        const sandbox = createSandboxConfig();
        const { metadata } = createSessionMetadata({
            flavor: 'codex',
            machineId: 'machine-1',
            startedBy: 'terminal',
            sandbox,
        });

        expect(metadata.sandbox).toEqual(sandbox);
    });

    it('sets metadata.sandbox to null when sandbox is disabled', () => {
        const sandbox = createSandboxConfig({ enabled: false });
        const { metadata } = createSessionMetadata({
            flavor: 'gemini',
            machineId: 'machine-2',
            startedBy: 'daemon',
            sandbox,
        });

        expect(metadata.sandbox).toBeNull();
    });

    it('sets metadata.sandbox to null when sandbox is not provided', () => {
        const { metadata } = createSessionMetadata({
            flavor: 'claude',
            machineId: 'machine-3',
        });

        expect(metadata.sandbox).toBeNull();
    });

    it('sets metadata.dangerouslySkipPermissions to null when not provided', () => {
        const { metadata } = createSessionMetadata({
            flavor: 'codex',
            machineId: 'machine-4',
        });

        expect(metadata.dangerouslySkipPermissions).toBeNull();
    });

    it('sets metadata.dangerouslySkipPermissions when provided', () => {
        const { metadata } = createSessionMetadata({
            flavor: 'claude',
            machineId: 'machine-5',
            dangerouslySkipPermissions: true,
        });

        expect(metadata.dangerouslySkipPermissions).toBe(true);
    });

    it('sets tmux carrier metadata when tmux launch context exists', () => {
        process.env.HAPPY_TERMINAL_CARRIER = 'tmux';
        process.env.HAPPY_TMUX_SESSION_ID = 'happy:session-1';

        const { metadata } = createSessionMetadata({
            flavor: 'claude',
            machineId: 'machine-6',
        });

        expect(metadata.terminalCarrier).toBe('tmux');
        expect(metadata.tmuxSessionId).toBe('happy:session-1');
    });

    it('sets fallback carrier metadata when tmux launch context is absent', () => {
        process.env.HAPPY_TERMINAL_CARRIER = 'fallback';

        const { metadata } = createSessionMetadata({
            flavor: 'claude',
            machineId: 'machine-7',
        });

        expect(metadata.terminalCarrier).toBe('fallback');
        expect(metadata.tmuxSessionId).toBeNull();
    });
});
