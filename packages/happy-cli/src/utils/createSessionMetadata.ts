/**
 * Session Metadata Factory
 *
 * Creates session state and metadata objects for all backends (Claude, Codex, Gemini).
 * This follows DRY principles by providing a single implementation for all backends.
 *
 * @module createSessionMetadata
 */

import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import type { AgentState, Metadata } from '@/api/types';
import { configuration, readBrandEnv } from '@/configuration';
import { projectPath } from '@/projectPath';
import type { SandboxConfig } from '@/persistence';
import packageJson from '../../package.json';

/**
 * Backend flavor identifier for session metadata.
 */
export type BackendFlavor = 'claude' | 'codex' | 'gemini' | 'opencode' | 'acp';

/**
 * Options for creating session metadata.
 */
export interface CreateSessionMetadataOptions {
    /** Backend flavor (claude, codex, gemini) */
    flavor: BackendFlavor;
    /** Machine ID for server identification */
    machineId: string;
    /** How the session was started */
    startedBy?: 'daemon' | 'terminal';
    /** Active sandbox config for the session, or undefined when not used */
    sandbox?: SandboxConfig;
    /** Whether the backend runs with "dangerously skip permissions" behavior */
    dangerouslySkipPermissions?: boolean;
}

/**
 * Result containing both state and metadata for session creation.
 */
export interface SessionMetadataResult {
    /** Agent state for session */
    state: AgentState;
    /** Session metadata */
    metadata: Metadata;
}

export function resolveTerminalCarrierMetadata(): Pick<Metadata, 'terminalCarrier' | 'tmuxSessionId'> {
    let tmuxSessionId = readBrandEnv('HELLOVIBE_TMUX_SESSION_ID', 'HAPPY_TMUX_SESSION_ID')?.trim();
    if (!tmuxSessionId && process.env.TMUX) {
        try {
            tmuxSessionId = execFileSync('tmux', ['display-message', '-p', '#S:#W'], {
                encoding: 'utf8'
            }).trim();
        } catch {
            tmuxSessionId = undefined;
        }
    }
    if (tmuxSessionId) {
        return {
            terminalCarrier: 'tmux',
            tmuxSessionId
        };
    }

    const terminalCarrier = readBrandEnv('HELLOVIBE_TERMINAL_CARRIER', 'HAPPY_TERMINAL_CARRIER')?.trim();
    if (terminalCarrier === 'tmux' || terminalCarrier === 'fallback' || terminalCarrier === 'unknown') {
        return {
            terminalCarrier,
            tmuxSessionId: null
        };
    }

    return {
        terminalCarrier: 'unknown',
        tmuxSessionId: null
    };
}

/**
 * Creates session state and metadata for backend agents.
 *
 * This utility consolidates the common session metadata creation logic used by
 * Codex and Gemini backends, ensuring consistency across all backend implementations.
 *
 * @param opts - Options specifying flavor, machineId, and startedBy
 * @returns Object containing state and metadata for session creation
 *
 * @example
 * ```typescript
 * const { state, metadata } = createSessionMetadata({
 *     flavor: 'gemini',
 *     machineId: settings.machineId,
 *     startedBy: opts.startedBy
 * });
 *
 * const response = await api.getOrCreateSession({ tag: sessionTag, metadata, state });
 * ```
 */
export function createSessionMetadata(opts: CreateSessionMetadataOptions): SessionMetadataResult {
    const state: AgentState = {
        controlledByUser: false,
    };

    const metadata: Metadata = {
        path: process.cwd(),
        host: os.hostname(),
        version: packageJson.version,
        os: os.platform(),
        machineId: opts.machineId,
        homeDir: os.homedir(),
        happyHomeDir: configuration.happyHomeDir,
        happyLibDir: projectPath(),
        happyToolsDir: resolve(projectPath(), 'tools', 'unpacked'),
        startedFromDaemon: opts.startedBy === 'daemon',
        hostPid: process.pid,
        startedBy: opts.startedBy || 'terminal',
        lifecycleState: 'running',
        lifecycleStateSince: Date.now(),
        flavor: opts.flavor,
        sandbox: opts.sandbox?.enabled ? opts.sandbox : null,
        dangerouslySkipPermissions: opts.dangerouslySkipPermissions ?? null,
        ...resolveTerminalCarrierMetadata(),
    };

    return { state, metadata };
}
