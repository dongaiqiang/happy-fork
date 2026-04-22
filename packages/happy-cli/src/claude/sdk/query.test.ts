import { EventEmitter } from "node:events"
import { PassThrough } from "node:stream"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { mockSpawn, mockExistsSync, mockGetCleanEnv, mockNormalizeClaudeExecutablePath, mockStreamToStdin } = vi.hoisted(() => ({
    mockSpawn: vi.fn(),
    mockExistsSync: vi.fn(),
    mockGetCleanEnv: vi.fn(),
    mockNormalizeClaudeExecutablePath: vi.fn(),
    mockStreamToStdin: vi.fn(),
}))

vi.mock("node:child_process", () => ({
    spawn: mockSpawn,
}))

vi.mock("node:fs", () => ({
    existsSync: mockExistsSync,
}))

vi.mock("./utils", () => ({
    getDefaultClaudeCodePath: vi.fn(() => "claude"),
    getCleanEnv: mockGetCleanEnv,
    logDebug: vi.fn(),
    normalizeClaudeExecutablePath: mockNormalizeClaudeExecutablePath,
    streamToStdin: mockStreamToStdin,
}))

vi.mock("@/ui/logger", () => ({
    logger: {
        debug: vi.fn(),
    },
}))

import { query } from "./query"

function createChildProcessMock() {
    const child = new EventEmitter() as EventEmitter & Record<string, any>
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.stdin = new PassThrough()
    child.killed = false
    child.kill = vi.fn(() => {
        child.killed = true
        return true
    })
    process.nextTick(() => {
        child.stdout.end()
        child.emit("close", 0)
    })
    return child
}

describe("query Windows spawn behavior", () => {
    const originalPlatform = process.platform

    beforeEach(() => {
        vi.clearAllMocks()
        mockGetCleanEnv.mockReturnValue({ PATH: "clean-path" })
        mockExistsSync.mockReturnValue(true)
        mockSpawn.mockImplementation(() => createChildProcessMock())
        Object.defineProperty(process, "platform", { value: "win32", configurable: true })
    })

    afterEach(() => {
        Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true })
    })

    it("uses the Windows shell only for command-only Claude lookups", () => {
        mockNormalizeClaudeExecutablePath.mockReturnValue("claude")

        query({
            prompt: "hello",
            options: {
                pathToClaudeCodeExecutable: "claude",
            },
        })

        expect(mockSpawn).toHaveBeenCalledWith(
            "claude",
            expect.any(Array),
            expect.objectContaining({
                shell: true,
                windowsHide: true,
                env: { PATH: "clean-path" },
            }),
        )
    })

    it("avoids the Windows shell for resolved executable paths", () => {
        mockNormalizeClaudeExecutablePath.mockReturnValue("C:/Anthropic/claude.exe")

        query({
            prompt: "hello",
            options: {
                pathToClaudeCodeExecutable: "C:/Anthropic/claude.cmd",
            },
        })

        expect(mockExistsSync).toHaveBeenCalledWith("C:/Anthropic/claude.exe")
        expect(mockSpawn).toHaveBeenCalledWith(
            "C:/Anthropic/claude.exe",
            expect.any(Array),
            expect.objectContaining({
                shell: false,
                windowsHide: true,
            }),
        )
    })
})
