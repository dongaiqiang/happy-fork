import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
    mockExistsSync,
    mockRealpathSync,
    mockExecSync,
    mockReadBrandEnv,
    mockIsBun,
} = vi.hoisted(() => ({
    mockExistsSync: vi.fn(),
    mockRealpathSync: vi.fn(),
    mockExecSync: vi.fn(),
    mockReadBrandEnv: vi.fn(),
    mockIsBun: vi.fn(() => false),
}))

vi.mock("node:fs", () => ({
    existsSync: mockExistsSync,
    realpathSync: mockRealpathSync,
}))

vi.mock("node:child_process", () => ({
    execSync: mockExecSync,
}))

vi.mock("@/ui/logger", () => ({
    logger: {
        debug: vi.fn(),
    },
}))

vi.mock("@/configuration", () => ({
    readBrandEnv: mockReadBrandEnv,
}))

vi.mock("@/utils/runtime", () => ({
    isBun: mockIsBun,
}))

import { getDefaultClaudeCodePath, normalizeClaudeExecutablePath } from "./utils"

describe("normalizeClaudeExecutablePath", () => {
    const originalPlatform = process.platform

    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true })
    })

    it("returns the original path outside Windows", () => {
        Object.defineProperty(process, "platform", { value: "darwin", configurable: true })

        expect(normalizeClaudeExecutablePath("/usr/local/bin/claude")).toBe("/usr/local/bin/claude")
        expect(mockExistsSync).not.toHaveBeenCalled()
    })

    it("resolves a Windows shim to the bundled executable when available", () => {
        Object.defineProperty(process, "platform", { value: "win32", configurable: true })
        mockExistsSync.mockImplementation((filePath: string) =>
            filePath === "C:/Anthropic/node_modules/@anthropic-ai/claude-code/bin/claude.exe",
        )
        mockRealpathSync.mockReturnValue("D:/resolved/claude.exe")

        expect(normalizeClaudeExecutablePath("C:/Anthropic/claude.cmd")).toBe("D:/resolved/claude.exe")
        expect(mockExistsSync).toHaveBeenNthCalledWith(
            1,
            "C:/Anthropic/node_modules/@anthropic-ai/claude-code/bin/claude.exe",
        )
        expect(mockRealpathSync).toHaveBeenCalledWith(
            "C:/Anthropic/node_modules/@anthropic-ai/claude-code/bin/claude.exe",
        )
    })

    it("falls back to cli.js when the executable is unavailable", () => {
        Object.defineProperty(process, "platform", { value: "win32", configurable: true })
        mockExistsSync.mockImplementation((filePath: string) =>
            filePath === "C:/Anthropic/node_modules/@anthropic-ai/claude-code/cli.js",
        )
        mockRealpathSync.mockReturnValue("D:/resolved/cli.js")

        expect(normalizeClaudeExecutablePath("C:/Anthropic/claude.bat")).toBe("D:/resolved/cli.js")
        expect(mockExistsSync).toHaveBeenNthCalledWith(
            1,
            "C:/Anthropic/node_modules/@anthropic-ai/claude-code/bin/claude.exe",
        )
        expect(mockExistsSync).toHaveBeenNthCalledWith(
            2,
            "C:/Anthropic/node_modules/@anthropic-ai/claude-code/cli.js",
        )
    })

    it("keeps the original shim when no direct target exists", () => {
        Object.defineProperty(process, "platform", { value: "win32", configurable: true })
        mockExistsSync.mockReturnValue(false)

        expect(normalizeClaudeExecutablePath("C:/Anthropic/claude.cmd")).toBe("C:/Anthropic/claude.cmd")
        expect(mockRealpathSync).not.toHaveBeenCalled()
    })
})

describe("getDefaultClaudeCodePath", () => {
    const originalPlatform = process.platform

    beforeEach(() => {
        vi.clearAllMocks()
        Object.defineProperty(process, "platform", { value: "win32", configurable: true })
    })

    afterEach(() => {
        Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true })
    })

    it("normalizes the explicit override path before returning it", () => {
        mockReadBrandEnv.mockImplementation((...keys: string[]) => {
            if (keys.includes("HELLOVIBE_CLAUDE_PATH")) {
                return "C:/Anthropic/claude.cmd"
            }
            return undefined
        })
        mockExistsSync.mockImplementation((filePath: string) =>
            filePath === "C:/Anthropic/node_modules/@anthropic-ai/claude-code/bin/claude.exe",
        )
        mockRealpathSync.mockReturnValue("D:/resolved/claude.exe")

        expect(getDefaultClaudeCodePath()).toBe("D:/resolved/claude.exe")
        expect(mockExecSync).not.toHaveBeenCalled()
    })
})
