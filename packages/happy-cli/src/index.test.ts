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
        HELLOVIBE_HOME_DIR: tempHomeDir,
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

describe('hellovibe CLI entrypoint', () => {
  it('prints version without triggering authentication', () => {
    const result = runCli(['--version'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain(`hellovibe version: ${packageJson.version}`)
    expect(result.stdout).not.toContain('Authentication Status')
    expect(result.stdout).not.toContain('Mobile Authentication')
  })

  it('fails fast when starting daemon without authentication', () => {
    const result = runCli(['daemon', 'start'])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('HelloVibe is not signed in on this computer yet.')
    expect(result.stderr).toContain('Run "hellovibe auth login" first, then run "hellovibe daemon start" again.')
    expect(result.stdout).not.toContain('Mobile Authentication')
  })

  it('shows updated auth help with HelloVibe sign-in guidance', () => {
    const result = runCli(['auth', '--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Sign in to HelloVibe on this computer')
    expect(result.stdout).toContain('managed from the mobile or web app instead of the CLI')
  })

  it('shows daemon help as background service guidance', () => {
    const result = runCli(['daemon'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Background service management')
    expect(result.stdout).toContain('keeps remote sessions available when you step away from your computer')
    expect(result.stdout).toContain('hellovibe daemon logs')
  })
})
