import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildTmuxHostedClaudeCommandArgs } from './run';
import { isTmuxAvailable, getTmuxUtilities, parseTmuxSessionIdentifier } from '@/utils/tmux';
import { projectPath } from '@/projectPath';

type ProbeOptions = {
  directory: string;
  tmuxSessionName?: string;
  happySessionId?: string;
  resumeId?: string;
  waitMs: number;
  startingMode: 'local' | 'remote';
};

function shellSingleQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function parseOptions(argv: string[]): ProbeOptions {
  const options: ProbeOptions = {
    directory: process.cwd(),
    waitMs: 5000,
    startingMode: 'local'
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dir') {
      options.directory = argv[++index] || options.directory;
    } else if (arg === '--tmux-session') {
      options.tmuxSessionName = argv[++index] || undefined;
    } else if (arg === '--happy-session-id') {
      options.happySessionId = argv[++index] || undefined;
    } else if (arg === '--resume') {
      options.resumeId = argv[++index] || undefined;
    } else if (arg === '--wait-ms') {
      options.waitMs = Number(argv[++index] || options.waitMs);
    } else if (arg === '--starting-mode') {
      const value = argv[++index];
      options.startingMode = value === 'remote' ? 'remote' : 'local';
    } else if (arg === '--help') {
      console.log([
        'Usage: yarn workspace happy-coder debug:tmux-hosted -- [options]',
        '',
        'Options:',
        '  --dir <path>',
        '  --tmux-session <name>',
        '  --happy-session-id <id>',
        '  --resume <claude-session-id>',
        '  --wait-ms <number>',
        '  --starting-mode <local|remote>'
      ].join('\n'));
      process.exit(0);
    }
  }

  return options;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isProcessAlive(pid?: number) {
  if (!pid) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function capturePane(sessionId: string) {
  const parsed = parseTmuxSessionIdentifier(sessionId);
  const target = parsed.pane
    ? `${parsed.session}:${parsed.window}.${parsed.pane}`
    : `${parsed.session}:${parsed.window}`;
  try {
    return execFileSync('tmux', ['capture-pane', '-p', '-t', target], {
      encoding: 'utf8'
    }).trim();
  } catch (error) {
    return `capture-pane failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const tmuxAvailable = await isTmuxAvailable();
  if (!tmuxAvailable) {
    throw new Error('tmux is not available on this machine');
  }

  const cliPath = join(projectPath(), 'dist', 'index.mjs');
  const windowName = `happy-probe-${Date.now()}`;
  const command = buildTmuxHostedClaudeCommandArgs(cliPath, {
    happySessionId: options.happySessionId,
    resumeId: options.resumeId,
    startingMode: options.startingMode,
    startedBy: 'daemon'
  }).join(' ');
  const logFilePath = `/tmp/happy-tmux-probe-${Date.now()}.log`;
  const shellScript = `${command} > ${shellSingleQuote(logFilePath)} 2>&1; status=$?; echo __HAPPY_TMUX_PROBE_EXIT__:$status >> ${shellSingleQuote(logFilePath)}; sleep 30; exit $status`;
  const wrappedCommand = `/bin/bash -lc ${shellSingleQuote(shellScript)}`;
  const tmux = getTmuxUtilities(options.tmuxSessionName);
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value !== undefined)
  ) as Record<string, string>;

  console.log(JSON.stringify({
    phase: 'spawn-request',
    directory: options.directory,
    tmuxSessionName: options.tmuxSessionName ?? '',
    waitMs: options.waitMs,
    startingMode: options.startingMode,
    happySessionId: options.happySessionId ?? null,
    resumeId: options.resumeId ?? null,
    logFilePath,
    command,
    wrappedCommand
  }, null, 2));

  const result = await tmux.spawnInTmux([wrappedCommand], {
    sessionName: options.tmuxSessionName ?? '',
    windowName,
    cwd: options.directory
  }, env);

  console.log(JSON.stringify({ phase: 'spawn-result', result }, null, 2));

  if (!result.success || !result.sessionId) {
    process.exit(1);
  }

  await sleep(options.waitMs);

  const paneOutput = capturePane(result.sessionId);
  const logFileExists = existsSync(logFilePath);
  const logFileContents = logFileExists
    ? readFileSync(logFilePath, 'utf8')
    : null;
  const summary = {
    phase: 'post-wait',
    sessionId: result.sessionId,
    pid: result.pid ?? null,
    processAlive: isProcessAlive(result.pid),
    attachCommand: `tmux attach -t ${parseTmuxSessionIdentifier(result.sessionId).session}`,
    captureTarget: result.sessionId,
    paneOutput,
    logFilePath,
    logFileExists,
    logFileContents
  };

  console.log(JSON.stringify(summary, null, 2));
}

void main().catch((error) => {
  console.error(JSON.stringify({
    phase: 'probe-error',
    error: error instanceof Error ? error.message : String(error)
  }, null, 2));
  process.exit(1);
});
