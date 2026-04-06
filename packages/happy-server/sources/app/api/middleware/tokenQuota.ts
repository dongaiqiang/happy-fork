import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '@/storage/db';
import { log } from '@/utils/log';

/**
 * Token 配额配置常量
 *
 * 实现"三刀流"限额设计：
 * 1. 日限额 - 防止一天刷爆
 * 2. 月限额 - 控制总成本
 * 3. 速率限制 - 防止脚本滥用
 */
export const QUOTA_TIERS = {
    free: {
        dailyLimit: 5000,        // 5K tokens/天
        monthlyLimit: 100000,    // 10 万 tokens/月
        rateLimit: 10,           // 10 请求/分钟
        tokensPerMonth: 100000,
        storageLimit: BigInt(1024 * 1024 * 100), // 100MB
    },
    student: {
        dailyLimit: 20000,       // 20K tokens/天
        monthlyLimit: 500000,    // 50 万 tokens/月
        rateLimit: 30,           // 30 请求/分钟
        tokensPerMonth: 500000,
        storageLimit: BigInt(1024 * 1024 * 1024 * 5), // 5GB
    },
    pro: {
        dailyLimit: 100000,      // 100K tokens/天
        monthlyLimit: 2000000,   // 200 万 tokens/月
        rateLimit: 100,          // 100 请求/分钟
        tokensPerMonth: 2000000,
        storageLimit: BigInt(1024 * 1024 * 1024 * 20), // 20GB
    },
    team: {
        dailyLimit: 500000,      // 500K tokens/天
        monthlyLimit: 10000000,  // 1000 万 tokens/月
        rateLimit: 300,          // 300 请求/分钟
        tokensPerMonth: 10000000,
        storageLimit: BigInt(1024 * 1024 * 1024 * 100), // 100GB
    },
    enterprise: {
        dailyLimit: 5000000,     // 5M tokens/天
        monthlyLimit: 100000000, // 1 亿 tokens/月
        rateLimit: 1000,         // 1000 请求/分钟
        tokensPerMonth: 100000000,
        storageLimit: BigInt(1024 * 1024 * 1024 * 1000), // 1TB
    },
};

export type QuotaTier = keyof typeof QUOTA_TIERS;
export type LimitViolationReason =
    | 'daily_limit_exceeded'
    | 'monthly_limit_exceeded'
    | 'trial_expired'
    | 'subscription_inactive'
    | 'subscription_expired';
export type LimitViolationError = 'quota_limit_exceeded' | 'validity_check_failed';
export interface LimitViolationResponse {
    error: LimitViolationError;
    reason: LimitViolationReason;
    message: string;
    upgradeUrl: string;
    estimated?: number;
    remaining?: number;
    dailyLimit?: number;
    dailyUsed?: number;
    monthlyLimit?: number;
    monthlyUsed?: number;
    expiresAt?: string;
}
export interface SubscriptionValidityResult {
    allowed: boolean;
    response?: LimitViolationResponse;
}

export interface QuotaCheckResult {
    allowed: boolean;
    reason?: 'daily_limit_exceeded' | 'monthly_limit_exceeded' | 'rate_limit_exceeded';
    currentUsage?: {
        dailyTokens: number;
        monthlyTokens: number;
        dailyRequests: number;
    };
    limits?: {
        dailyLimit: number;
        monthlyLimit: number;
        rateLimit: number;
    };
}

export interface QuotaInfo {
    tier: QuotaTier;
    dailyRemaining: number;
    monthlyRemaining: number;
    rateLimit: number;
    dailyLimit: number;
    monthlyLimit: number;
    dailyUsed: number;
    monthlyUsed: number;
}

const PRICING_UPGRADE_URL = '/pricing';
const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_SUBSCRIPTION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function buildQuotaLimitExceededResponse(input: {
    reason: 'daily_limit_exceeded' | 'monthly_limit_exceeded';
    message: string;
    estimated?: number;
    remaining: number;
    dailyLimit?: number;
    dailyUsed?: number;
    monthlyLimit?: number;
    monthlyUsed?: number;
}): LimitViolationResponse {
    return {
        error: 'quota_limit_exceeded',
        reason: input.reason,
        message: input.message,
        upgradeUrl: PRICING_UPGRADE_URL,
        estimated: input.estimated,
        remaining: input.remaining,
        dailyLimit: input.dailyLimit,
        dailyUsed: input.dailyUsed,
        monthlyLimit: input.monthlyLimit,
        monthlyUsed: input.monthlyUsed,
    };
}

function buildValidityCheckFailedResponse(input: {
    reason: 'trial_expired' | 'subscription_inactive' | 'subscription_expired';
    message: string;
    expiresAt?: Date;
}): LimitViolationResponse {
    return {
        error: 'validity_check_failed',
        reason: input.reason,
        message: input.message,
        upgradeUrl: PRICING_UPGRADE_URL,
        expiresAt: input.expiresAt?.toISOString(),
    };
}

export function getQuotaLimitExceededResponse(input: {
    reason: 'daily_limit_exceeded' | 'monthly_limit_exceeded';
    estimated?: number;
    quota: QuotaInfo;
}): LimitViolationResponse {
    if (input.reason === 'daily_limit_exceeded') {
        return buildQuotaLimitExceededResponse({
            reason: input.reason,
            message: '今日额度不足，请升级后继续发送消息',
            estimated: input.estimated,
            remaining: input.quota.dailyRemaining,
            dailyLimit: input.quota.dailyLimit,
            dailyUsed: input.quota.dailyUsed,
        });
    }

    return buildQuotaLimitExceededResponse({
        reason: input.reason,
        message: '本月额度不足，请升级后继续发送消息',
        estimated: input.estimated,
        remaining: input.quota.monthlyRemaining,
        monthlyLimit: input.quota.monthlyLimit,
        monthlyUsed: input.quota.monthlyUsed,
    });
}

export async function checkSubscriptionValidity(userId: string): Promise<SubscriptionValidityResult> {
    const account = await db.account.findUnique({
        where: { id: userId },
        select: { createdAt: true }
    });

    if (!account) {
        throw new Error(`Account not found for user ${userId}`);
    }

    const subscription = await db.subscriptionPlan.findUnique({
        where: { accountId: userId },
    });

    if (!subscription) {
        const expiresAt = new Date(account.createdAt.getTime() + TRIAL_DURATION_MS);
        if (Date.now() > expiresAt.getTime()) {
            return {
                allowed: false,
                response: buildValidityCheckFailedResponse({
                    reason: 'trial_expired',
                    message: '7 天试用已到期，请升级后继续发送消息',
                    expiresAt,
                })
            };
        }
        return { allowed: true };
    }

    if (subscription.tier === 'free' || subscription.status !== 'active') {
        return {
            allowed: false,
            response: buildValidityCheckFailedResponse({
                reason: 'subscription_inactive',
                message: '当前订阅未激活，请升级或恢复订阅后继续发送消息',
                expiresAt: subscription.endDate ?? undefined,
            })
        };
    }

    const expiresAt = subscription.endDate ?? new Date(subscription.startDate.getTime() + DEFAULT_SUBSCRIPTION_DURATION_MS);
    if (Date.now() > expiresAt.getTime()) {
        return {
            allowed: false,
            response: buildValidityCheckFailedResponse({
                reason: 'subscription_expired',
                message: '当前订阅已过期，请续费后继续发送消息',
                expiresAt,
            })
        };
    }

    return { allowed: true };
}

export async function tokenQuotaMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
    next: (err?: Error) => void
) {
    try {
        const userId = (request as any).userId;
        if (!userId) {
            return reply.code(401).send({ error: 'Unauthorized' });
        }

        const quota = await getUserQuota(userId);
        if (!quota) {
            next();
            return;
        }

        if (quota.dailyUsed >= quota.dailyLimit) {
            return reply.code(429).send(getQuotaLimitExceededResponse({
                reason: 'daily_limit_exceeded',
                quota,
            }));
        }

        if (quota.monthlyUsed >= quota.monthlyLimit) {
            return reply.code(429).send(getQuotaLimitExceededResponse({
                reason: 'monthly_limit_exceeded',
                quota,
            }));
        }

        (request as any).quota = quota;

        next();
    } catch (error) {
        log({ module: 'middleware', level: 'error' }, `Token quota check failed: ${error}`);
        next(error as Error);
    }
}

/**
 * 更新用量记录
 *
 * 在用户完成一次 AI 请求调用后，更新其日用量统计
 */
export async function updateUsage(
    userId: string,
    tokensUsed: number,
    sessionId?: string
): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    await db.dailyUsage.upsert({
        where: {
            accountId_date: {
                accountId: userId,
                date: today,
            },
        },
        update: {
            tokensUsed: { increment: tokensUsed },
            requests: { increment: 1 },
        },
        create: {
            accountId: userId,
            date: today,
            tokensUsed,
            requests: 1,
        },
    });

    if (sessionId) {
        const usageKey = `session:${sessionId}:${today}`;
        await db.usageReport.upsert({
            where: {
                accountId_sessionId_key: {
                    accountId: userId,
                    sessionId,
                    key: usageKey,
                },
            },
            update: {
                data: {
                    tokens: { total: tokensUsed },
                    cost: { total: 0 },
                },
            },
            create: {
                accountId: userId,
                sessionId,
                key: usageKey,
                data: {
                    tokens: { total: tokensUsed },
                    cost: { total: 0 },
                },
            },
        });
    }
}

export async function getUserQuota(userId: string): Promise<QuotaInfo | null> {
    const subscription = await db.subscriptionPlan.findUnique({
        where: { accountId: userId },
    });

    const tier: QuotaTier = (subscription?.tier as QuotaTier) || 'free';
    const quota = QUOTA_TIERS[tier];

    if (!quota) {
        return null;
    }

    const today = new Date().toISOString().split('T')[0];
    const dailyUsage = await db.dailyUsage.findUnique({
        where: {
            accountId_date: {
                accountId: userId,
                date: today,
            },
        },
    });

    const firstDayOfMonth = new Date().toISOString().slice(0, 7) + '-01';
    const monthlyUsageResult = await db.dailyUsage.groupBy({
        by: ['accountId'],
        where: {
            accountId: userId,
            date: {
                gte: firstDayOfMonth,
            },
        },
        _sum: {
            tokensUsed: true,
        },
    });

    const dailyTokens = dailyUsage?.tokensUsed || 0;
    const monthlyTokens = monthlyUsageResult[0]?._sum.tokensUsed || 0;

    return {
        tier,
        dailyLimit: quota.dailyLimit,
        monthlyLimit: quota.monthlyLimit,
        rateLimit: quota.rateLimit,
        dailyUsed: dailyTokens,
        monthlyUsed: monthlyTokens,
        dailyRemaining: quota.dailyLimit - dailyTokens,
        monthlyRemaining: quota.monthlyLimit - monthlyTokens,
    };
}

/**
 * 估算文本的 token 数量
 *
 * 简单估算规则：
 * - 英文：每 4 个字符≈1 个 token
 * - 中文：每 1.5 个字符≈1 个 token
 */
export function estimateTokens(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;

    // 中文约 1.5 字符/token，英文约 4 字符/token
    return Math.ceil(chineseChars / 1.5) + Math.ceil(otherChars / 4);
}
