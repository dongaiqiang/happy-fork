import { describe, expect, it } from 'vitest';
import {
  buildAcpCommandArgs,
  buildOpenCodeConfigContent,
  buildOpenInMacClaudeCommandArgs,
  buildTmuxHostedClaudeCommandArgs,
  classifyHostedTmuxResumeTarget,
  resolveOpenCodeModelId,
  resolveRequestedTerminalCarrierMode
} from './run';

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

describe('buildAcpCommandArgs', () => {
  it('builds OpenCode ACP invocation for daemon-spawned sessions', () => {
    expect(buildAcpCommandArgs('opencode')).toEqual([
      'acp',
      'opencode',
      '--started-by',
      'daemon'
    ]);
  });

  it('does not pass OpenCode model selection as an ACP CLI flag', () => {
    expect(buildAcpCommandArgs('opencode', {
      model: 'openai/gpt-5.3-codex'
    })).toEqual([
      'acp',
      'opencode',
      '--started-by',
      'daemon'
    ]);
  });
});

describe('resolveOpenCodeModelId', () => {
  it('maps OPENAI_MODEL to the OpenCode provider/model format', () => {
    expect(resolveOpenCodeModelId({
      OPENAI_MODEL: 'gpt-5.3-codex'
    })).toBe('openai/gpt-5.3-codex');
  });
});

describe('buildOpenCodeConfigContent', () => {
  it('builds inline OpenCode config from OpenAI profile variables', () => {
    expect(JSON.parse(buildOpenCodeConfigContent({
      OPENAI_BASE_URL: 'https://4sapi.com/v1',
      OPENAI_MODEL: 'gpt-5.3-codex',
      OPENAI_SMALL_FAST_MODEL: 'gpt-5.3-mini'
    }) ?? '{}')).toEqual({
      $schema: 'https://opencode.ai/config.json',
      model: 'openai/gpt-5.3-codex',
      small_model: 'openai/gpt-5.3-mini',
      provider: {
        openai: {
          options: {
            baseURL: 'https://4sapi.com/v1'
          }
        }
      }
    });
  });

  it('returns undefined when no OpenCode-specific config can be derived', () => {
    expect(buildOpenCodeConfigContent({})).toBeUndefined();
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

describe('classifyHostedTmuxResumeTarget', () => {
  it('rejects missing tmux targets', () => {
    expect(classifyHostedTmuxResumeTarget({
      targetExists: false
    })).toEqual({
      reusable: false,
      reason: 'tmux-target-missing'
    });
  });

  it('rejects panes that already fell back to a shell prompt', () => {
    expect(classifyHostedTmuxResumeTarget({
      targetExists: true,
      paneCurrentCommand: 'zsh'
    })).toEqual({
      reusable: false,
      reason: 'tmux-pane-shell-prompt'
    });
  });

  it('rejects dead panes even when tmux target still exists', () => {
    expect(classifyHostedTmuxResumeTarget({
      targetExists: true,
      paneDead: true,
      paneCurrentCommand: 'node'
    })).toEqual({
      reusable: false,
      reason: 'tmux-pane-dead'
    });
  });

  it('reuses tmux targets that still have a live non-shell process', () => {
    expect(classifyHostedTmuxResumeTarget({
      targetExists: true,
      paneCurrentCommand: 'node'
    })).toEqual({
      reusable: true,
      reason: 'tmux-pane-has-live-process'
    });
  });
});
