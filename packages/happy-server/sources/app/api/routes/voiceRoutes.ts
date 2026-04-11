import { z } from "zod";
import { type Fastify } from "../types";
import { log } from "@/utils/log";
import { db } from "@/storage/db";
import { decryptString } from "@/modules/encrypt";

type VoicePostprocessProvider = 'openai' | 'anthropic' | 'gemini';
type VoicePostprocessApiStyle = 'openai' | 'anthropic' | 'gemini';
type VoicePostprocessAuthType = 'bearer' | 'x-api-key' | 'x-goog-api-key';

type VoicePostprocessTarget = {
    provider: VoicePostprocessProvider;
    apiStyle: VoicePostprocessApiStyle;
    baseUrl: string;
    model: string;
    apiKey: string;
    authType: VoicePostprocessAuthType;
    label: string;
    configSource: string;
};

type VoicePostprocessResolvedValue = {
    value: string;
    source: string;
};

type VoicePostprocessResolvedSecret = VoicePostprocessResolvedValue & {
    authType: VoicePostprocessAuthType;
};

function readTrimmedEnv(name: string) {
    const value = process.env[name]?.trim();
    return value ? value : null;
}

function resolveEnvValue(names: string[], sourcePrefix: string) {
    for (const name of names) {
        const value = readTrimmedEnv(name);
        if (value) {
            return {
                value,
                source: `${sourcePrefix}:${name}`
            } satisfies VoicePostprocessResolvedValue;
        }
    }

    return null;
}

function joinBaseUrl(baseUrl: string, path: string) {
    return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function hasVoiceSpecificConfig(prefix: 'OPENAI' | 'ANTHROPIC' | 'GEMINI') {
    return [
        `VOICE_POSTPROCESS_${prefix}_API_KEY`,
        `VOICE_POSTPROCESS_${prefix}_BASE_URL`,
        `VOICE_POSTPROCESS_${prefix}_MODEL`
    ].some(name => readTrimmedEnv(name));
}

function getOpenAiTargetLabel(baseUrl: string) {
    return readTrimmedEnv('VOICE_POSTPROCESS_OPENAI_LABEL')
        ?? (baseUrl === 'https://api.openai.com/v1' ? 'openai' : 'openai-compatible');
}

function getAnthropicTargetLabel(baseUrl: string) {
    return readTrimmedEnv('VOICE_POSTPROCESS_ANTHROPIC_LABEL')
        ?? (baseUrl === 'https://api.anthropic.com' ? 'anthropic' : 'anthropic-compatible');
}

function getGeminiTargetLabel(baseUrl: string) {
    return readTrimmedEnv('VOICE_POSTPROCESS_GEMINI_LABEL')
        ?? (baseUrl === 'https://generativelanguage.googleapis.com/v1beta' ? 'gemini' : 'gemini-compatible');
}

function parseStoredTokenPayload(rawToken: string) {
    const trimmed = rawToken.trim();
    if (!trimmed) {
        return null;
    }

    try {
        return JSON.parse(trimmed);
    } catch {
        return trimmed;
    }
}

function pickStringValue(...candidates: unknown[]) {
    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim()) {
            return candidate.trim();
        }
    }

    return null;
}

function extractStoredSecret(vendor: VoicePostprocessProvider, rawToken: string): VoicePostprocessResolvedSecret | null {
    const parsed = parseStoredTokenPayload(rawToken);
    const objectValue = parsed && typeof parsed === 'object'
        ? parsed as Record<string, any>
        : null;
    const oauth = objectValue?.oauth && typeof objectValue.oauth === 'object'
        ? objectValue.oauth as Record<string, any>
        : null;

    if (vendor === 'anthropic') {
        const value = pickStringValue(
            oauth?.token,
            objectValue?.token,
            oauth?.access_token,
            objectValue?.access_token,
            typeof parsed === 'string' ? parsed : null
        );
        return value ? {
            value,
            source: 'service-account-token:anthropic',
            authType: 'x-api-key'
        } : null;
    }

    if (vendor === 'gemini') {
        const apiKey = pickStringValue(
            oauth?.apiKey,
            oauth?.api_key,
            objectValue?.apiKey,
            objectValue?.api_key
        );
        if (apiKey) {
            return {
                value: apiKey,
                source: 'service-account-token:gemini',
                authType: 'x-goog-api-key'
            };
        }

        const accessToken = pickStringValue(
            oauth?.access_token,
            objectValue?.access_token,
            oauth?.token,
            objectValue?.token,
            typeof parsed === 'string' ? parsed : null
        );
        return accessToken ? {
            value: accessToken,
            source: 'service-account-token:gemini',
            authType: 'bearer'
        } : null;
    }

    const value = pickStringValue(
        oauth?.access_token,
        objectValue?.access_token,
        oauth?.apiKey,
        oauth?.api_key,
        objectValue?.apiKey,
        objectValue?.api_key,
        oauth?.token,
        objectValue?.token,
        typeof parsed === 'string' ? parsed : null
    );
    return value ? {
        value,
        source: 'service-account-token:openai',
        authType: 'bearer'
    } : null;
}

async function getStoredVendorToken(userId: string, vendor: VoicePostprocessProvider) {
    const record = await db.serviceAccountToken.findUnique({
        where: { accountId_vendor: { accountId: userId, vendor } },
        select: { token: true }
    });

    if (!record) {
        return null;
    }

    return decryptString(['user', userId, 'vendors', vendor, 'token'], record.token);
}

function resolveEnvSecret(
    names: string[],
    sourcePrefix: string,
    authType: VoicePostprocessAuthType
) {
    const resolved = resolveEnvValue(names, sourcePrefix);
    return resolved ? {
        ...resolved,
        authType
    } satisfies VoicePostprocessResolvedSecret : null;
}

async function resolveApiSecret(
    userId: string,
    vendor: VoicePostprocessProvider,
    voiceSpecificEnvNames: string[],
    sharedEnvNames: string[],
    envAuthType: VoicePostprocessAuthType
) {
    const voiceSpecific = resolveEnvSecret(voiceSpecificEnvNames, 'voice-postprocess-env', envAuthType);
    if (voiceSpecific) {
        return voiceSpecific;
    }

    const shared = resolveEnvSecret(sharedEnvNames, 'shared-env', envAuthType);
    if (shared) {
        return shared;
    }

    const storedToken = await getStoredVendorToken(userId, vendor);
    if (storedToken) {
        return extractStoredSecret(vendor, storedToken);
    }

    return null;
}

function withDefaultValue(
    resolved: VoicePostprocessResolvedValue | null,
    defaultValue: string,
    defaultSource: string
) {
    return resolved ?? {
        value: defaultValue,
        source: defaultSource
    };
}

function describeTarget(target: VoicePostprocessTarget) {
    return `${target.label}:${target.model} source=${target.configSource} baseUrl=${target.baseUrl}`;
}

function buildVoicePostprocessPrompt(text: string) {
    return [
        '你是中文语音识别文本修正器。',
        '请把下面这段实时语音识别结果整理成自然、准确、可直接发送的中文句子。',
        '只做以下处理：',
        '1. 修正明显同音字、错别字、中英混杂误识别。',
        '2. 删除明显重复片段和口头禅噪音。',
        '3. 补足自然标点和断句。',
        '4. 保留原意，不要扩写，不要解释。',
        '5. 如果无法确定，就尽量保守保留原词。',
        '6. 如果上下文明显在讨论 AI 产品、模型、命令或工程术语，优先修正为常见技术名词。',
        '7. 常见术语示例：Claude、Codex、OpenCode、HelloVibe、daemon、CLI。',
        '8. 例如在模型或产品语境下，优先把“可拉/可乐/cloud”理解为“Claude”；只有在明确讨论云服务、天气或 cloud 平台时才保留 cloud。',
        '9. 像“一会儿啊、然后呢、比方说”这类不影响原意的口头填充词可以删掉。',
        '只输出修正后的文本，不要加引号，不要附加说明。',
        '',
        '<asr_text>',
        text,
        '</asr_text>'
    ].join('\n');
}

function normalizeVoicePostprocessOutput(output: string, fallback: string) {
    const normalized = output
        .trim()
        .replace(/^["“”'`]+|["“”'`]+$/g, '')
        .trim();

    return normalized || fallback;
}

async function postprocessWithOpenAI(target: VoicePostprocessTarget, text: string) {
    const response = await fetch(joinBaseUrl(target.baseUrl, '/chat/completions'), {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${target.apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: target.model,
            temperature: 0.1,
            messages: [
                {
                    role: 'system',
                    content: '你是一个严格的中文 ASR 后处理器，只输出修正后的最终文本。'
                },
                {
                    role: 'user',
                    content: buildVoicePostprocessPrompt(text)
                }
            ]
        })
    });

    if (!response.ok) {
        throw new Error(`openai:${response.status}`);
    }

    const data = await response.json() as any;
    return normalizeVoicePostprocessOutput(data.choices?.[0]?.message?.content ?? '', text);
}

async function postprocessWithAnthropic(target: VoicePostprocessTarget, text: string) {
    const response = await fetch(joinBaseUrl(target.baseUrl, '/v1/messages'), {
        method: 'POST',
        headers: {
            [target.authType === 'bearer' ? 'authorization' : 'x-api-key']: target.authType === 'bearer'
                ? `Bearer ${target.apiKey}`
                : target.apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            model: target.model,
            max_tokens: 512,
            temperature: 0.1,
            system: '你是一个严格的中文 ASR 后处理器，只输出修正后的最终文本。',
            messages: [
                {
                    role: 'user',
                    content: buildVoicePostprocessPrompt(text)
                }
            ]
        })
    });

    if (!response.ok) {
        throw new Error(`anthropic:${response.status}`);
    }

    const data = await response.json() as any;
    const content = Array.isArray(data.content)
        ? data.content.find((item: any) => item?.type === 'text')?.text
        : '';

    return normalizeVoicePostprocessOutput(content ?? '', text);
}

async function postprocessWithGemini(target: VoicePostprocessTarget, text: string) {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };
    if (target.authType === 'bearer') {
        headers.Authorization = `Bearer ${target.apiKey}`;
    } else {
        headers['x-goog-api-key'] = target.apiKey;
    }

    const response = await fetch(
        joinBaseUrl(target.baseUrl, `/models/${encodeURIComponent(target.model)}:generateContent`),
        {
            method: 'POST',
            headers,
            body: JSON.stringify({
                generationConfig: {
                    temperature: 0.1
                },
                contents: [
                    {
                        role: 'user',
                        parts: [
                            {
                                text: buildVoicePostprocessPrompt(text)
                            }
                        ]
                    }
                ],
                systemInstruction: {
                    parts: [
                        {
                            text: '你是一个严格的中文 ASR 后处理器，只输出修正后的最终文本。'
                        }
                    ]
                }
            })
        }
    );

    if (!response.ok) {
        throw new Error(`gemini:${response.status}`);
    }

    const data = await response.json() as any;
    const content = Array.isArray(data.candidates)
        ? data.candidates
            .flatMap((item: any) => Array.isArray(item?.content?.parts) ? item.content.parts : [])
            .find((part: any) => typeof part?.text === 'string')?.text
        : '';

    return normalizeVoicePostprocessOutput(content ?? '', text);
}

async function resolveVoicePostprocessTargets(userId: string): Promise<VoicePostprocessTarget[]> {
    const openAiApiKey = await resolveApiSecret(
        userId,
        'openai',
        ['VOICE_POSTPROCESS_OPENAI_API_KEY'],
        ['OPENAI_API_KEY'],
        'bearer'
    );
    const openAiBaseUrl = withDefaultValue(
        resolveEnvValue(['VOICE_POSTPROCESS_OPENAI_BASE_URL'], 'voice-postprocess-env')
            ?? resolveEnvValue(['OPENAI_BASE_URL'], 'shared-env'),
        'https://api.openai.com/v1',
        'default:openai-base-url'
    );
    const openAiModel = withDefaultValue(
        resolveEnvValue(['VOICE_POSTPROCESS_OPENAI_MODEL'], 'voice-postprocess-env')
            ?? resolveEnvValue(['OPENAI_SMALL_FAST_MODEL', 'OPENAI_MODEL'], 'shared-env'),
        'gpt-4o-mini',
        'default:openai-model'
    );

    const anthropicApiKey = await resolveApiSecret(
        userId,
        'anthropic',
        ['VOICE_POSTPROCESS_ANTHROPIC_API_KEY'],
        ['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY'],
        'x-api-key'
    );
    const anthropicBaseUrl = withDefaultValue(
        resolveEnvValue(['VOICE_POSTPROCESS_ANTHROPIC_BASE_URL'], 'voice-postprocess-env')
            ?? resolveEnvValue(['ANTHROPIC_BASE_URL'], 'shared-env'),
        'https://api.anthropic.com',
        'default:anthropic-base-url'
    );
    const anthropicModel = withDefaultValue(
        resolveEnvValue(['VOICE_POSTPROCESS_ANTHROPIC_MODEL'], 'voice-postprocess-env')
            ?? resolveEnvValue(['ANTHROPIC_SMALL_FAST_MODEL', 'ANTHROPIC_MODEL'], 'shared-env'),
        'claude-3-5-haiku-latest',
        'default:anthropic-model'
    );

    const geminiApiKey = await resolveApiSecret(
        userId,
        'gemini',
        ['VOICE_POSTPROCESS_GEMINI_API_KEY'],
        ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
        'x-goog-api-key'
    );
    const geminiBaseUrl = withDefaultValue(
        resolveEnvValue(['VOICE_POSTPROCESS_GEMINI_BASE_URL'], 'voice-postprocess-env')
            ?? resolveEnvValue(['GEMINI_BASE_URL'], 'shared-env'),
        'https://generativelanguage.googleapis.com/v1beta',
        'default:gemini-base-url'
    );
    const geminiModel = withDefaultValue(
        resolveEnvValue(['VOICE_POSTPROCESS_GEMINI_MODEL'], 'voice-postprocess-env')
            ?? resolveEnvValue(['GEMINI_MODEL'], 'shared-env'),
        'gemini-2.5-pro',
        'default:gemini-model'
    );

    const targets: VoicePostprocessTarget[] = [];
    const preferredProvider = readTrimmedEnv('VOICE_POSTPROCESS_PROVIDER');
    const shouldPreferAnthropic = preferredProvider === 'anthropic'
        || (!preferredProvider && hasVoiceSpecificConfig('ANTHROPIC') && !hasVoiceSpecificConfig('OPENAI'));
    const shouldPreferGemini = preferredProvider === 'gemini'
        || (!preferredProvider
            && hasVoiceSpecificConfig('GEMINI')
            && !hasVoiceSpecificConfig('OPENAI')
            && !hasVoiceSpecificConfig('ANTHROPIC'));

    const openAiTarget = openAiApiKey ? {
        provider: 'openai' as const,
        apiStyle: 'openai' as const,
        baseUrl: openAiBaseUrl.value,
        model: openAiModel.value,
        apiKey: openAiApiKey.value,
        authType: openAiApiKey.authType,
        label: getOpenAiTargetLabel(openAiBaseUrl.value),
        configSource: `apiKey=${openAiApiKey.source};baseUrl=${openAiBaseUrl.source};model=${openAiModel.source}`
    } : null;

    const anthropicTarget = anthropicApiKey ? {
        provider: 'anthropic' as const,
        apiStyle: 'anthropic' as const,
        baseUrl: anthropicBaseUrl.value,
        model: anthropicModel.value,
        apiKey: anthropicApiKey.value,
        authType: anthropicApiKey.authType,
        label: getAnthropicTargetLabel(anthropicBaseUrl.value),
        configSource: `apiKey=${anthropicApiKey.source};baseUrl=${anthropicBaseUrl.source};model=${anthropicModel.source}`
    } : null;

    const geminiTarget = geminiApiKey ? {
        provider: 'gemini' as const,
        apiStyle: 'gemini' as const,
        baseUrl: geminiBaseUrl.value,
        model: geminiModel.value,
        apiKey: geminiApiKey.value,
        authType: geminiApiKey.authType,
        label: getGeminiTargetLabel(geminiBaseUrl.value),
        configSource: `apiKey=${geminiApiKey.source};baseUrl=${geminiBaseUrl.source};model=${geminiModel.source}`
    } : null;

    if (shouldPreferGemini) {
        if (geminiTarget) {
            targets.push(geminiTarget);
        }
        if (openAiTarget) {
            targets.push(openAiTarget);
        }
        if (anthropicTarget) {
            targets.push(anthropicTarget);
        }
    } else if (shouldPreferAnthropic) {
        if (anthropicTarget) {
            targets.push(anthropicTarget);
        }
        if (openAiTarget) {
            targets.push(openAiTarget);
        }
        if (geminiTarget) {
            targets.push(geminiTarget);
        }
    } else {
        if (openAiTarget) {
            targets.push(openAiTarget);
        }
        if (anthropicTarget) {
            targets.push(anthropicTarget);
        }
        if (geminiTarget) {
            targets.push(geminiTarget);
        }
    }

    return targets;
}

async function postprocessWithTarget(target: VoicePostprocessTarget, text: string) {
    if (target.apiStyle === 'openai') {
        return await postprocessWithOpenAI(target, text);
    }

    if (target.apiStyle === 'gemini') {
        return await postprocessWithGemini(target, text);
    }

    return await postprocessWithAnthropic(target, text);
}

export function voiceRoutes(app: Fastify) {
    app.post('/v1/voice/token', {
        preHandler: app.authenticate,
        schema: {
            body: z.object({
                agentId: z.string(),
                revenueCatPublicKey: z.string().optional()
            }),
            response: {
                200: z.object({
                    allowed: z.boolean(),
                    token: z.string().optional(),
                    agentId: z.string().optional()
                }),
                400: z.object({
                    allowed: z.boolean(),
                    error: z.string()
                })
            }
        }
    }, async (request, reply) => {
        const userId = request.userId; // CUID from JWT
        const { agentId, revenueCatPublicKey } = request.body;

        log({ module: 'voice' }, `Voice token request from user ${userId}`);

        const isDevelopment = process.env.NODE_ENV === 'development' || process.env.ENV === 'dev';

        // Production requires RevenueCat key
        if (!isDevelopment && !revenueCatPublicKey) {
            log({ module: 'voice' }, 'Production environment requires RevenueCat public key');
            return reply.code(400).send({ 
                allowed: false,
                error: 'RevenueCat public key required'
            });
        }

        // Check subscription in production
        if (!isDevelopment && revenueCatPublicKey) {
            const response = await fetch(
                `https://api.revenuecat.com/v1/subscribers/${userId}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${revenueCatPublicKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                log({ module: 'voice' }, `RevenueCat check failed for user ${userId}: ${response.status}`);
                return reply.send({ 
                    allowed: false,
                    agentId
                });
            }

            const data = await response.json() as any;
            const proEntitlement = data.subscriber?.entitlements?.active?.pro;
            
            if (!proEntitlement) {
                log({ module: 'voice' }, `User ${userId} does not have active subscription`);
                return reply.send({ 
                    allowed: false,
                    agentId
                });
            }
        }

        // Check if 11Labs API key is configured
        const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
        if (!elevenLabsApiKey) {
            log({ module: 'voice' }, 'Missing 11Labs API key');
            return reply.code(400).send({ allowed: false, error: 'Missing 11Labs API key on the server' });
        }

        // Get 11Labs conversation token
        const response = await fetch(
            `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${agentId}`,
            {
                method: 'GET',
                headers: {
                    'xi-api-key': elevenLabsApiKey,
                    'Accept': 'application/json'
                }
            }
        );
        
        if (!response.ok) {
            log({ module: 'voice' }, `Failed to get 11Labs token for user ${userId}`);
            return reply.code(400).send({ 
                allowed: false,
                error: `Failed to get 11Labs token for user ${userId}`
            });
        }

        const data = await response.json() as any;
        const token = data.token;

        log({ module: 'voice' }, `Voice token issued for user ${userId}`);
        return reply.send({
            allowed: true,
            token,
            agentId
        });
    });

    app.post('/v1/voice/postprocess', {
        preHandler: app.authenticate,
        schema: {
            body: z.object({
                text: z.string().min(1).max(4000)
            }),
            response: {
                200: z.object({
                    text: z.string(),
                    applied: z.boolean(),
                    provider: z.string().nullable()
                })
            }
        }
    }, async (request, reply) => {
        const userId = request.userId;
        const originalText = request.body.text.trim();

        if (!originalText) {
            return reply.send({
                text: '',
                applied: false,
                provider: null
            });
        }

        const targets = await resolveVoicePostprocessTargets(userId);
        log(
            { module: 'voice' },
            `[voice-postprocess] start user=${userId} targets=${targets.length > 0 ? targets.map(describeTarget).join(' | ') : 'none'} text="${originalText}"`
        );

        if (targets.length === 0) {
            log(
                { module: 'voice', level: 'warn' },
                '[voice-postprocess] fallback user='
                + `${userId} provider=none reason=no-target `
                + 'openaiApiKeySource=none anthropicApiKeySource=none'
            );
            return reply.send({
                text: originalText,
                applied: false,
                provider: null
            });
        }

        for (const target of targets) {
            try {
                const text = await postprocessWithTarget(target, originalText);
                log(
                    { module: 'voice' },
                    `[voice-postprocess] success user=${userId} provider=${target.label} model=${target.model} baseUrl=${target.baseUrl} source=${target.configSource} applied=${text !== originalText}`
                );
                return reply.send({
                    text,
                    applied: text !== originalText,
                    provider: `${target.label}:${target.model}`
                });
            } catch (error) {
                log(
                    { module: 'voice', level: 'warn' },
                    `[voice-postprocess] failed user=${userId} provider=${target.label} model=${target.model} baseUrl=${target.baseUrl} source=${target.configSource}: ${error}`
                );
            }
        }

        log({ module: 'voice', level: 'warn' }, `[voice-postprocess] fallback user=${userId} provider=none`);
        return reply.send({
            text: originalText,
            applied: false,
            provider: null
        });
    });
}
