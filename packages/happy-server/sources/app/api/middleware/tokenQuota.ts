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

function isQuotaSchemaMissingError(error: unknown) {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const record = error as { code?: unknown; message?: unknown };
    if (record.code === 'P2021' || record.code === 'P2022') {
        return true;
    }

    if (typeof record.message !== 'string') {
        return false;
    }

    const message = record.message.toLowerCase();
    const referencesQuotaTable = (
        message.includes('subscriptionplan') ||
        message.includes('dailyusage') ||
        message.includes('usagereport')
    );

    return referencesQuotaTable && (
        message.includes('does not exist') ||
        message.includes('does not exist in the current database')
    );
}

function logQuotaSchemaFallback(operation: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log({ module: 'quota', level: 'warn', operation }, `Quota storage unavailable, skipping quota enforcement: ${message}`);
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
            return reply.code(429).send({
                error: 'daily_limit_exceeded',
                message: '今日免费额度已用完，明日 0 点重置',
                currentUsage: {
                    dailyTokens: quota.dailyUsed,
                    dailyLimit: quota.dailyLimit,
                },
            });
        }

        if (quota.monthlyUsed >= quota.monthlyLimit) {
            return reply.code(429).send({
                error: 'monthly_limit_exceeded',
                message: '本月免费额度已用完，下月 1 号重置',
                currentUsage: {
                    monthlyTokens: quota.monthlyUsed,
                    monthlyLimit: quota.monthlyLimit,
                },
            });
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

    try {
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
    } catch (error) {
        if (isQuotaSchemaMissingError(error)) {
            logQuotaSchemaFallback('updateUsage', error);
            return;
        }
        throw error;
    }
}

export async function getUserQuota(userId: string): Promise<QuotaInfo | null> {
    try {
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
    } catch (error) {
        if (isQuotaSchemaMissingError(error)) {
            logQuotaSchemaFallback('getUserQuota', error);
            return null;
        }
        throw error;
    }
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
