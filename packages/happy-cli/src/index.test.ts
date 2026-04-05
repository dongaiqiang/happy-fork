import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import packageJson from '../package.json'

const __dirname = dirname(fileURLToPath(import.meta.url))
const cliPath = resolve(__dirname, '..', 'dist', 'index.mjs')

function runCli(args: string[], happyHomeDir?: string): { stdout: string; stderr: string; exitCode: number } {
  const tempHomeDir = happyHomeDir ?? mkdtempSync(resolve(tmpdir(), 'happy-cli-test-'))

  try {
    const stdout = execFileSync(process.execPath, [
      '--no-warnings',
      '--no-deprecation',
      cliPath,
      ...args
    ], {
      encoding: 'utf-8',
      env: {
        ...process.env,
        HAPPY_HOME_DIR: tempHomeDir
      },
      timeout: 4000
    })

    return { stdout, stderr: '', exitCode: 0 }
  } catch (error: any) {
    return {
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
      exitCode: error.status ?? 1
    }
  } finally {
    rmSync(tempHomeDir, { recursive: true, force: true })
  }
}

describe('happy CLI entrypoint', () => {
  it('prints version without triggering authentication', () => {
    const result = runCli(['--version'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain(`happy version: ${packageJson.version}`)
    expect(result.stdout).not.toContain('Authentication Status')
    expect(result.stdout).not.toContain('Mobile Authentication')
  })

  it('fails fast when starting daemon without authentication', () => {
    const result = runCli(['daemon', 'start'])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Not authenticated. Run "happy auth login" to authenticate before starting the daemon.')
    expect(result.stdout).not.toContain('Mobile Authentication')
  })
})
