import { describe, expect, it } from 'vitest';
import { buildOpenInMacClaudeCommandArgs, buildTmuxHostedClaudeCommandArgs, resolveRequestedTerminalCarrierMode } from './run';

describe('buildOpenInMacClaudeCommandArgs', () => {
  it('starts Open in Mac terminal in remote observe mode', () => {
    const args = buildOpenInMacClaudeCommandArgs('/tmp/dist/index.mjs', {
      happySessionId: 'happy-session-1',
      resumeId: 'claude-session-1'
    });

    expect(args).toContain('claude');
    expect(args).toContain('--happy-starting-mode');
    expect(args).toContain('remote');
    expect(args).toContain('--terminal-carrier');
    expect(args).toContain('fallback');
    expect(args).toContain('--started-by');
    expect(args).toContain('terminal');
    expect(args).toContain('--happy-session-id');
    expect(args).toContain("'happy-session-1'");
    expect(args).toContain('--resume');
    expect(args).toContain("'claude-session-1'");
  });
});

describe('buildTmuxHostedClaudeCommandArgs', () => {
  it('builds daemon tmux-hosted Claude command in local mode by default', () => {
    const args = buildTmuxHostedClaudeCommandArgs('/tmp/dist/index.mjs', {
      happySessionId: 'happy-session-1',
      resumeId: 'claude-session-1'
    });

    expect(args).toContain('claude');
    expect(args).toContain('--happy-starting-mode');
    expect(args).toContain('local');
    expect(args).toContain('--terminal-carrier');
    expect(args).toContain('tmux');
    expect(args).toContain('--started-by');
    expect(args).toContain('daemon');
  });
});

describe('resolveRequestedTerminalCarrierMode', () => {
  it('keeps default session spawning on direct carrier mode', () => {
    expect(resolveRequestedTerminalCarrierMode({ openTerminal: false })).toBe('direct');
    expect(resolveRequestedTerminalCarrierMode({ openTerminal: true })).toBe('direct');
  });

  it('uses hosted carrier mode only when explicitly requested', () => {
    expect(resolveRequestedTerminalCarrierMode({ openTerminal: true, terminalCarrierMode: 'hosted' })).toBe('hosted');
  });
});
