import { Fastify } from "../types";
import { FastifyRequest } from "fastify";
import { z } from "zod";
import { db } from "@/storage/db";
import { QUOTA_TIERS, QuotaTier } from "@/app/api/middleware/tokenQuota";
import { AdminUpgradeInput, AdminUpgradeInputSchema, executeAdminUpgrade } from "@/app/quota/adminUpgrade";
import { AdminAccountQuotaQuery, AdminAccountQuotaQuerySchema, queryAdminAccountQuota } from "@/app/quota/adminAccountQuota";

const SubscriptionUpgradeBodySchema = z.object({
    tier: z.enum(['student', 'pro', 'team', 'enterprise']),
    billingPeriod: z.enum(['monthly', 'annual']),
    paymentMethod: z.enum(['wechat', 'alipay', 'stripe', 'paypal']),
});

/**
 * 配额管理路由
 *
 * 提供用户配额查询和订阅计划列表接口
 */
export function quotaRoutes(app: Fastify) {
    app.get('/admin/account-quota', {
        schema: {
            querystring: AdminAccountQuotaQuerySchema,
        },
    }, async (request, reply) => {
        if (!hasValidAdminToken(request, reply)) {
            return;
        }

        const quotaSnapshot = await queryAdminAccountQuota(request.query as AdminAccountQuotaQuery);
        if (!quotaSnapshot) {
            return reply.code(404).send({
                success: false,
                error: 'account_not_found',
                message: 'Target account was not found',
            });
        }

        return reply.send({
            success: true,
            ...quotaSnapshot,
        });
    });

    app.post('/admin/upgrade', {
        schema: {
            body: AdminUpgradeInputSchema,
        },
    }, async (request, reply) => {
        if (!hasValidAdminToken(request, reply)) {
            return;
        }

        const upgraded = await executeAdminUpgrade(request.body as AdminUpgradeInput);
        if (!upgraded) {
            return reply.code(404).send({
                success: false,
                error: 'account_not_found',
                message: 'Target account was not found',
            });
        }

        return reply.send({
            success: true,
            ...upgraded,
        });
    });

    /**
     * GET /quota
     * 获取当前用户的用量和配额信息
     */
    app.get('/quota', {
        preHandler: app.authenticate,
    }, async (request, reply) => {
        const userId = request.userId;

        // 获取订阅计划
        const subscription = await db.subscriptionPlan.findUnique({
            where: { accountId: userId },
        });

        const tier: QuotaTier = (subscription?.tier as QuotaTier) || 'free';
        const quota = QUOTA_TIERS[tier];

        // 计算今日用量
        const today = new Date().toISOString().split('T')[0];
        const dailyUsage = await db.dailyUsage.findUnique({
            where: {
                accountId_date: {
                    accountId: userId,
                    date: today,
                },
            },
        });

        // 计算本月用量
        const firstDayOfMonth = new Date().toISOString().slice(0, 7) + '-01';
        const monthlyUsageResult = await db.dailyUsage.groupBy({
            by: ['accountId'],
            where: {
                accountId: userId,
                date: { gte: firstDayOfMonth },
            },
            _sum: {
                tokensUsed: true,
            },
        });

        const dailyTokens = dailyUsage?.tokensUsed || 0;
        const monthlyTokens = monthlyUsageResult[0]?._sum.tokensUsed || 0;

        // 计算订阅到期时间
        let subscriptionStatus = subscription?.status || 'active';
        let subscriptionEndDate = subscription?.endDate;

        // 如果是免费版，设置特殊状态
        if (!subscription) {
            subscriptionStatus = 'free';
        }

        return reply.send({
            success: true,
            tier,
            subscription: {
                status: subscriptionStatus,
                endDate: subscriptionEndDate ? subscriptionEndDate.toISOString() : null,
            },
            quota: {
                dailyLimit: quota.dailyLimit,
                dailyUsed: dailyTokens,
                dailyRemaining: quota.dailyLimit - dailyTokens,
                dailyReset: '次日 0 点 (北京时间)',
                monthlyLimit: quota.monthlyLimit,
                monthlyUsed: monthlyTokens,
                monthlyRemaining: quota.monthlyLimit - monthlyTokens,
                monthlyReset: '次月 1 号 0 点 (北京时间)',
                rateLimit: quota.rateLimit,
                rateLimitUnit: 'requests/minute',
                storageLimit: quota.storageLimit.toString(),
            },
            usagePercentage: {
                daily: quota.dailyLimit > 0 ? Math.round((dailyTokens / quota.dailyLimit) * 100) : 0,
                monthly: quota.monthlyLimit > 0 ? Math.round((monthlyTokens / quota.monthlyLimit) * 100) : 0,
            },
        });
    });

    /**
     * GET /plans
     * 获取所有订阅计划列表
     */
    app.get('/plans', {
        preHandler: app.authenticate,
    }, async (request, reply) => {
        return reply.send({
            success: true,
            plans: [
                {
                    tier: 'free',
                    name: {
                        zh: '免费版',
                        en: 'Free',
                    },
                    description: {
                        zh: '适合体验用户，包含基础功能',
                        en: 'For trying out HelloVibe with basic features',
                    },
                    price: {
                        CNY: 0,
                        USD: 0,
                    },
                    billingPeriod: 'monthly',
                    features: {
                        dailyLimit: QUOTA_TIERS.free.dailyLimit,
                        monthlyLimit: QUOTA_TIERS.free.monthlyLimit,
                        rateLimit: QUOTA_TIERS.free.rateLimit,
                        storageLimit: QUOTA_TIERS.free.storageLimit.toString(),
                    },
                    modeAccess: {
                        localPro: true,
                        cloudHosted: 'limited', // 每天 30 分钟
                    },
                },
                {
                    tier: 'student',
                    name: {
                        zh: '学生版',
                        en: 'Student',
                    },
                    description: {
                        zh: '在校学生专享，需要学生证认证',
                        en: 'For verified students with student ID',
                    },
                    price: {
                        CNY: 9.9,
                        USD: 4.99,
                    },
                    billingPeriod: 'monthly',
                    requiresVerification: true,
                    verificationMethod: 'student_id',
                    features: {
                        dailyLimit: QUOTA_TIERS.student.dailyLimit,
                        monthlyLimit: QUOTA_TIERS.student.monthlyLimit,
                        rateLimit: QUOTA_TIERS.student.rateLimit,
                        storageLimit: QUOTA_TIERS.student.storageLimit.toString(),
                    },
                    modeAccess: {
                        localPro: true,
                        cloudHosted: 'full',
                    },
                },
                {
                    tier: 'pro',
                    name: {
                        zh: '专业版',
                        en: 'Pro',
                    },
                    description: {
                        zh: '个人开发者首选，解锁全部功能',
                        en: 'For indie developers with full access',
                    },
                    price: {
                        CNY: 49,
                        USD: 12,
                    },
                    billingPeriod: 'monthly',
                    annualDiscount: {
                        CNY: 490,
                        USD: 120,
                        savings: {
                            zh: '省 2 个月费用',
                            en: 'Save 2 months',
                        },
                    },
                    features: {
                        dailyLimit: QUOTA_TIERS.pro.dailyLimit,
                        monthlyLimit: QUOTA_TIERS.pro.monthlyLimit,
                        rateLimit: QUOTA_TIERS.pro.rateLimit,
                        storageLimit: QUOTA_TIERS.pro.storageLimit.toString(),
                    },
                    modeAccess: {
                        localPro: true,
                        cloudHosted: 'full',
                    },
                },
                {
                    tier: 'team',
                    name: {
                        zh: '团队版',
                        en: 'Team',
                    },
                    description: {
                        zh: '小团队协作，包含管理后台和优先支持',
                        en: 'For small teams with admin dashboard and priority support',
                    },
                    price: {
                        CNY: 199,
                        USD: 35,
                    },
                    billingPeriod: 'monthly',
                    perSeat: true,
                    minSeats: 3,
                    features: {
                        dailyLimit: QUOTA_TIERS.team.dailyLimit,
                        monthlyLimit: QUOTA_TIERS.team.monthlyLimit,
                        rateLimit: QUOTA_TIERS.team.rateLimit,
                        storageLimit: QUOTA_TIERS.team.storageLimit.toString(),
                    },
                    modeAccess: {
                        localPro: true,
                        cloudHosted: 'full',
                    },
                    additionalFeatures: {
                        zh: ['团队管理后台', '成员权限控制', '优先技术支持'],
                        en: ['Team admin dashboard', 'Member permission control', 'Priority support'],
                    },
                },
                {
                    tier: 'enterprise',
                    name: {
                        zh: '企业版',
                        en: 'Enterprise',
                    },
                    description: {
                        zh: '大型企业定制，支持私有化部署和 SLA 保障',
                        en: 'For enterprises with private deployment and SLA guarantee',
                    },
                    price: {
                        CNY: 999,
                        USD: 200,
                    },
                    pricingNote: {
                        zh: '起，根据规模定制',
                        en: 'starting, custom pricing based on scale',
                    },
                    billingPeriod: 'monthly',
                    features: {
                        dailyLimit: QUOTA_TIERS.enterprise.dailyLimit,
                        monthlyLimit: QUOTA_TIERS.enterprise.monthlyLimit,
                        rateLimit: QUOTA_TIERS.enterprise.rateLimit,
                        storageLimit: QUOTA_TIERS.enterprise.storageLimit.toString(),
                    },
                    modeAccess: {
                        localPro: true,
                        cloudHosted: 'full',
                    },
                    additionalFeatures: {
                        zh: ['私有化部署', 'SLA 99.9% 保障', '专属客户经理', '定制培训'],
                        en: ['Private deployment', 'SLA 99.9% guarantee', 'Dedicated account manager', 'Custom training'],
                    },
                    deploymentOptions: ['saas', 'vpc', 'on-premise'],
                },
            ],
            promotions: {
                newYear: {
                    zh: '新用户首月专业版仅需 ¥9.9',
                    en: 'New users: First month Pro only ¥9.9',
                },
                referral: {
                    zh: '邀请好友，各得 1 个月会员',
                    en: 'Refer a friend, both get 1 month free',
                },
                earlyBird: {
                    zh: '前 1000 名创始会员永久 5 折',
                    en: 'First 1000 founding members: 50% off forever',
                },
            },
        });
    });

    /**
     * POST /subscription/upgrade
     * 升级订阅计划
     */
    app.post('/subscription/upgrade', {
        preHandler: app.authenticate,
        schema: {
            body: SubscriptionUpgradeBodySchema,
        },
    }, async (request, reply) => {
        const userId = request.userId;
        const { tier, billingPeriod, paymentMethod } = request.body as {
            tier: QuotaTier;
            billingPeriod: 'monthly' | 'annual';
            paymentMethod: 'wechat' | 'alipay' | 'stripe' | 'paypal';
        };

        // 验证 tier 有效性
        if (!QUOTA_TIERS[tier]) {
            return reply.code(400).send({
                success: false,
                error: 'invalid_tier',
                message: 'Invalid subscription tier',
            });
        }

        // 学生版需要认证
        if (tier === 'student') {
            // TODO: 检查用户是否已完成学生认证
            // const verification = await db.studentVerification.findUnique({...})
            // if (!verification || !verification.verified) {
            //     return reply.code(400).send({
            //         success: false,
            //         error: 'verification_required',
            //         message: '学生版需要学生证认证',
            //         verificationUrl: '/verify/student',
            //     });
            // }
        }

        // 创建订阅订单
        const order = await createSubscriptionOrder(userId, tier, billingPeriod, paymentMethod);

        return reply.send({
            success: true,
            orderId: order.id,
            paymentUrl: order.paymentUrl,
            expiresAt: order.expiresAt,
        });
    });

    /**
     * GET /subscription/current
     * 获取当前订阅状态
     */
    app.get('/subscription/current', {
        preHandler: app.authenticate,
    }, async (request, reply) => {
        const userId = request.userId;

        const subscription = await db.subscriptionPlan.findUnique({
            where: { accountId: userId },
        });

        if (!subscription) {
            return reply.send({
                success: true,
                subscription: {
                    tier: 'free',
                    status: 'free',
                    features: QUOTA_TIERS.free,
                },
            });
        }

        return reply.send({
            success: true,
            subscription: {
                tier: subscription.tier,
                status: subscription.status,
                startDate: subscription.startDate.toISOString(),
                endDate: subscription.endDate?.toISOString() || null,
                features: QUOTA_TIERS[subscription.tier as QuotaTier],
            },
        });
    });
}

/**
 * 创建订阅订单（简化实现）
 * TODO: 实际实现需要对接支付系统（微信支付/支付宝/Stripe）
 */
async function createSubscriptionOrder(
    userId: string,
    tier: QuotaTier,
    billingPeriod: 'monthly' | 'annual',
    paymentMethod: string
) {
    const orderId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // TODO: 根据 tier 和 billingPeriod 计算价格
    // TODO: 调用支付 API 创建支付订单
    // TODO: 设置 webhooks 处理支付回调

    return {
        id: orderId,
        paymentUrl: `https://payment.example.com/pay?order=${orderId}`,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 分钟有效
    };
}

function getAdminTokenFromRequest(request: FastifyRequest): string | null {
    const adminTokenHeader = request.headers['x-admin-token'];
    if (typeof adminTokenHeader === 'string' && adminTokenHeader.length > 0) {
        return adminTokenHeader;
    }

    const authorizationHeader = request.headers.authorization;
    if (typeof authorizationHeader === 'string') {
        const [scheme, token] = authorizationHeader.split(' ');
        if (scheme?.toLowerCase() === 'bearer' && token) {
            return token;
        }
    }

    return null;
}

function hasValidAdminToken(request: FastifyRequest, reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } }) {
    const adminToken = process.env.ADMIN_TOKEN;

    if (!adminToken) {
        reply.code(503).send({
            success: false,
            error: 'admin_token_not_configured',
            message: 'ADMIN_TOKEN is not configured',
        });
        return false;
    }

    const requestToken = getAdminTokenFromRequest(request);
    if (requestToken !== adminToken) {
        reply.code(401).send({
            success: false,
            error: 'invalid_admin_token',
            message: 'Invalid admin token',
        });
        return false;
    }

    return true;
}
