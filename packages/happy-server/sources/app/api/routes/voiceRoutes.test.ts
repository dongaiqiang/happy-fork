import fastify from "fastify";
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from "fastify-type-provider-zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Fastify } from "../types";

const { logMock, dbMock, resetMocks } = vi.hoisted(() => {
    const logMock = vi.fn();
    const dbMock = {
        serviceAccountToken: {
            findUnique: vi.fn(async () => null),
        },
    };

    return {
        logMock,
        dbMock,
        resetMocks: () => {
            logMock.mockReset();
            dbMock.serviceAccountToken.findUnique.mockReset();
            dbMock.serviceAccountToken.findUnique.mockResolvedValue(null);
        }
    };
});

vi.mock("@/utils/log", () => ({
    log: logMock,
}));

vi.mock("@/storage/db", () => ({
    db: dbMock,
}));

vi.mock("@/modules/encrypt", () => ({
    decryptString: vi.fn((_: unknown, token: unknown) => {
        if (typeof token === "string") {
            return token;
        }

        if (Buffer.isBuffer(token)) {
            return token.toString("utf8");
        }

        return String(token);
    }),
}));

describe("voiceRoutes /v1/voice/postprocess", () => {
    let app: Fastify;
    const originalFetch = global.fetch;

    beforeEach(async () => {
        resetMocks();
        vi.clearAllMocks();

        const server = fastify();
        server.setValidatorCompiler(validatorCompiler);
        server.setSerializerCompiler(serializerCompiler);
        server.decorate("authenticate", async (request: any) => {
            request.userId = "user-1";
        });

        app = server.withTypeProvider<ZodTypeProvider>() as unknown as Fastify;

        const { voiceRoutes } = await import("./voiceRoutes");
        voiceRoutes(app);
        await app.ready();
    });

    afterEach(async () => {
        delete process.env.VOICE_POSTPROCESS_PROVIDER;
        delete process.env.VOICE_POSTPROCESS_ANTHROPIC_API_KEY;
        delete process.env.VOICE_POSTPROCESS_ANTHROPIC_BASE_URL;
        delete process.env.VOICE_POSTPROCESS_ANTHROPIC_MODEL;
        delete process.env.ANTHROPIC_AUTH_TOKEN;
        delete process.env.ANTHROPIC_BASE_URL;
        delete process.env.ANTHROPIC_MODEL;
        delete process.env.ANTHROPIC_SMALL_FAST_MODEL;
        delete process.env.VOICE_POSTPROCESS_OPENAI_API_KEY;
        delete process.env.VOICE_POSTPROCESS_OPENAI_BASE_URL;
        delete process.env.VOICE_POSTPROCESS_OPENAI_MODEL;
        delete process.env.OPENAI_API_KEY;
        delete process.env.OPENAI_BASE_URL;
        delete process.env.OPENAI_MODEL;
        delete process.env.OPENAI_SMALL_FAST_MODEL;
        delete process.env.VOICE_POSTPROCESS_GEMINI_API_KEY;
        delete process.env.VOICE_POSTPROCESS_GEMINI_BASE_URL;
        delete process.env.VOICE_POSTPROCESS_GEMINI_MODEL;
        delete process.env.GEMINI_API_KEY;
        delete process.env.GOOGLE_API_KEY;
        delete process.env.GEMINI_BASE_URL;
        delete process.env.GEMINI_MODEL;
        global.fetch = originalFetch;
        await app.close();
    });

    it("logs shared anthropic config source and returns applied result", async () => {
        process.env.ANTHROPIC_AUTH_TOKEN = "anthropic-key";
        process.env.ANTHROPIC_BASE_URL = "https://router.example.com/anthropic";
        process.env.ANTHROPIC_MODEL = "claude-3-5-haiku-latest";
        global.fetch = vi.fn(async () => ({
            ok: true,
            json: async () => ({
                content: [
                    {
                        type: "text",
                        text: "整理后的最终句子。"
                    }
                ]
            })
        })) as any;

        const response = await app.inject({
            method: "POST",
            url: "/v1/voice/postprocess",
            payload: {
                text: "整理后的最终句子"
            }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
            text: "整理后的最终句子。",
            applied: true,
            provider: "anthropic-compatible:claude-3-5-haiku-latest"
        });
        expect(logMock).toHaveBeenCalledWith(
            { module: "voice" },
            expect.stringContaining("targets=anthropic-compatible:claude-3-5-haiku-latest")
        );
        expect(logMock).toHaveBeenCalledWith(
            { module: "voice" },
            expect.stringContaining("source=apiKey=shared-env:ANTHROPIC_AUTH_TOKEN;baseUrl=shared-env:ANTHROPIC_BASE_URL;model=shared-env:ANTHROPIC_MODEL")
        );
    });

    it("includes product glossary guidance in the postprocess prompt", async () => {
        process.env.OPENAI_API_KEY = "openai-key";
        const fetchMock = vi.fn(async () => ({
            ok: true,
            json: async () => ({
                choices: [
                    {
                        message: {
                            content: "我们看一看哪些地方需要优化，再排一个详细计划，比如 Claude 如何优化，最后怎么办？"
                        }
                    }
                ]
            })
        })) as any;
        global.fetch = fetchMock;

        const response = await app.inject({
            method: "POST",
            url: "/v1/voice/postprocess",
            payload: {
                text: "一会儿啊，我们看一看啊，到底有哪些这个需要优化的地方然后呢排一个详细的一个计划比方说可拉然后呢排一个详细的一个计划比方说可乐的如何优，然后呢排一个详细的一个计划，比方说cloud如何优化？最后怎么办？"
            }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
            text: "我们看一看哪些地方需要优化，再排一个详细计划，比如 Claude 如何优化，最后怎么办？",
            applied: true,
            provider: "openai:gpt-4o-mini"
        });

        const request = fetchMock.mock.calls[0]?.[1];
        expect(request).toBeTruthy();
        const body = JSON.parse(request.body as string);
        expect(body.messages[1].content).toContain("Claude、Codex、OpenCode、HelloVibe、daemon、CLI");
        expect(body.messages[1].content).toContain("优先把“可拉/可乐/cloud”理解为“Claude”");
    });

    it("reuses stored anthropic token without requiring dedicated voice env keys", async () => {
        process.env.VOICE_POSTPROCESS_PROVIDER = "anthropic";
        dbMock.serviceAccountToken.findUnique.mockImplementation((async ({ where }: any) => {
            if (where?.accountId_vendor?.vendor === "anthropic") {
                return {
                    token: Buffer.from(JSON.stringify({
                        oauth: {
                            token: "stored-claude-token"
                        }
                    }))
                } as any;
            }

            return null;
        }) as any);
        global.fetch = vi.fn(async () => ({
            ok: true,
            json: async () => ({
                content: [
                    {
                        type: "text",
                        text: "走存量 Claude 链路也能修正。"
                    }
                ]
            })
        })) as any;

        const response = await app.inject({
            method: "POST",
            url: "/v1/voice/postprocess",
            payload: {
                text: "走存量 Claude 链路也能修正"
            }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
            text: "走存量 Claude 链路也能修正。",
            applied: true,
            provider: "anthropic:claude-3-5-haiku-latest"
        });
        expect(global.fetch).toHaveBeenCalledWith(
            "https://api.anthropic.com/v1/messages",
            expect.objectContaining({
                headers: expect.objectContaining({
                    "x-api-key": "stored-claude-token"
                })
            })
        );
        expect(logMock).toHaveBeenCalledWith(
            { module: "voice" },
            expect.stringContaining("source=apiKey=service-account-token:anthropic;baseUrl=default:anthropic-base-url;model=default:anthropic-model")
        );
    });

    it("reuses stored openai oauth token for codex-compatible path", async () => {
        process.env.VOICE_POSTPROCESS_PROVIDER = "openai";
        dbMock.serviceAccountToken.findUnique.mockImplementation((async ({ where }: any) => {
            if (where?.accountId_vendor?.vendor === "openai") {
                return {
                    token: Buffer.from(JSON.stringify({
                        oauth: {
                            access_token: "stored-openai-oauth-token"
                        }
                    }))
                } as any;
            }

            return null;
        }) as any);
        global.fetch = vi.fn(async () => ({
            ok: true,
            json: async () => ({
                choices: [
                    {
                        message: {
                            content: "Codex 也能直接复用。"
                        }
                    }
                ]
            })
        })) as any;

        const response = await app.inject({
            method: "POST",
            url: "/v1/voice/postprocess",
            payload: {
                text: "Codex 也能直接复用"
            }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
            text: "Codex 也能直接复用。",
            applied: true,
            provider: "openai:gpt-4o-mini"
        });
        expect(global.fetch).toHaveBeenCalledWith(
            "https://api.openai.com/v1/chat/completions",
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: "Bearer stored-openai-oauth-token"
                })
            })
        );
    });

    it("supports shared gemini config for postprocess reuse", async () => {
        process.env.VOICE_POSTPROCESS_PROVIDER = "gemini";
        process.env.GEMINI_API_KEY = "gemini-key";
        process.env.GEMINI_MODEL = "gemini-2.5-flash";
        global.fetch = vi.fn(async () => ({
            ok: true,
            json: async () => ({
                candidates: [
                    {
                        content: {
                            parts: [
                                {
                                    text: "Gemini 也能复用现有链路。"
                                }
                            ]
                        }
                    }
                ]
            })
        })) as any;

        const response = await app.inject({
            method: "POST",
            url: "/v1/voice/postprocess",
            payload: {
                text: "Gemini 也能复用现有链路"
            }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
            text: "Gemini 也能复用现有链路。",
            applied: true,
            provider: "gemini:gemini-2.5-flash"
        });
        expect(global.fetch).toHaveBeenCalledWith(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
            expect.objectContaining({
                headers: expect.objectContaining({
                    "x-goog-api-key": "gemini-key"
                })
            })
        );
        expect(logMock).toHaveBeenCalledWith(
            { module: "voice" },
            expect.stringContaining("source=apiKey=shared-env:GEMINI_API_KEY;baseUrl=default:gemini-base-url;model=shared-env:GEMINI_MODEL")
        );
    });

    it("falls back with no-target reason when no shared or stored provider is available", async () => {
        global.fetch = vi.fn() as any;

        const response = await app.inject({
            method: "POST",
            url: "/v1/voice/postprocess",
            payload: {
                text: "原文"
            }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
            text: "原文",
            applied: false,
            provider: null
        });
        expect(global.fetch).not.toHaveBeenCalled();
        expect(logMock).toHaveBeenCalledWith(
            { module: "voice", level: "warn" },
            expect.stringContaining("reason=no-target")
        );
    });
});
