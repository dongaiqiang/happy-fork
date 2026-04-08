import { z } from "zod";
import { db } from "@/storage/db";
import { QUOTA_TIERS, QuotaTier } from "@/app/api/middleware/tokenQuota";

export const AdminUpgradeTierSchema = z.enum(["free", "student", "pro", "team", "enterprise"]);
export const AdminUpgradeBillingPeriodSchema = z.enum(["monthly", "annual"]);
export const AdminUpgradeStatusSchema = z.enum(["free", "active", "cancelled", "expired"]);

export const AdminUpgradeInputSchema = z.object({
    accountId: z.string().optional(),
    username: z.string().optional(),
    tier: AdminUpgradeTierSchema,
    billingPeriod: AdminUpgradeBillingPeriodSchema.optional(),
    status: AdminUpgradeStatusSchema.optional(),
    endDate: z.string().datetime().nullable().optional(),
}).refine((value) => Boolean(value.accountId || value.username), {
    message: "accountId or username is required",
    path: ["accountId"],
});

export type AdminUpgradeInput = z.infer<typeof AdminUpgradeInputSchema>;
export type AdminUpgradeStatus = z.infer<typeof AdminUpgradeStatusSchema>;

export async function executeAdminUpgrade(input: AdminUpgradeInput) {
    const { accountId, username, tier, billingPeriod = "monthly", status, endDate } = input;

    const account = await resolveAdminUpgradeAccount({ accountId, username });
    if (!account) {
        return null;
    }

    if (tier === "free") {
        await db.subscriptionPlan.deleteMany({
            where: { accountId: account.id },
        });

        return {
            account,
            subscription: {
                tier: "free" as const,
                status: "free" as const,
                endDate: null,
                features: getQuotaFeatures("free"),
            },
        };
    }

    const quota = QUOTA_TIERS[tier];
    const effectiveStatus: AdminUpgradeStatus = status ?? "active";
    const effectiveEndDate = endDate === undefined
        ? getSubscriptionEndDate(billingPeriod)
        : (endDate ? new Date(endDate) : null);

    const subscription = await db.subscriptionPlan.upsert({
        where: { accountId: account.id },
        create: {
            accountId: account.id,
            tier,
            status: effectiveStatus,
            tokensLimit: quota.monthlyLimit,
            dailyLimit: quota.dailyLimit,
            rateLimit: quota.rateLimit,
            storageLimit: quota.storageLimit,
            startDate: new Date(),
            endDate: effectiveEndDate,
        },
        update: {
            tier,
            status: effectiveStatus,
            tokensLimit: quota.monthlyLimit,
            dailyLimit: quota.dailyLimit,
            rateLimit: quota.rateLimit,
            storageLimit: quota.storageLimit,
            endDate: effectiveEndDate,
        },
    });

    return {
        account,
        subscription: {
            tier: subscription.tier,
            status: subscription.status,
            startDate: subscription.startDate.toISOString(),
            endDate: subscription.endDate?.toISOString() || null,
            features: getQuotaFeatures(tier),
        },
    };
}

export function getQuotaFeatures(tier: QuotaTier) {
    const quota = QUOTA_TIERS[tier];

    return {
        dailyLimit: quota.dailyLimit,
        monthlyLimit: quota.monthlyLimit,
        rateLimit: quota.rateLimit,
        storageLimit: quota.storageLimit.toString(),
    };
}

async function resolveAdminUpgradeAccount(input: { accountId?: string; username?: string }) {
    if (input.accountId) {
        const account = await db.account.findUnique({
            where: { id: input.accountId },
            select: {
                id: true,
                username: true,
            },
        });

        if (account) {
            return account;
        }
    }

    if (input.username) {
        return await db.account.findUnique({
            where: { username: input.username },
            select: {
                id: true,
                username: true,
            },
        });
    }

    return null;
}

function getSubscriptionEndDate(billingPeriod: "monthly" | "annual") {
    const next = new Date();
    if (billingPeriod === "annual") {
        next.setFullYear(next.getFullYear() + 1);
        return next;
    }

    next.setMonth(next.getMonth() + 1);
    return next;
}
