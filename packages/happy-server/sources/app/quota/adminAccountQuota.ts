import { z } from "zod";
import { db } from "@/storage/db";
import { getUserQuota, QuotaTier } from "@/app/api/middleware/tokenQuota";
import { getQuotaFeatures } from "@/app/quota/adminUpgrade";

export const AdminAccountQuotaQuerySchema = z.object({
    accountId: z.string().optional(),
    username: z.string().optional(),
}).refine((value) => Boolean(value.accountId || value.username), {
    message: "accountId or username is required",
    path: ["accountId"],
});

export type AdminAccountQuotaQuery = z.infer<typeof AdminAccountQuotaQuerySchema>;

export async function queryAdminAccountQuota(input: AdminAccountQuotaQuery) {
    const account = await resolveAdminAccount(input);
    if (!account) {
        return null;
    }

    const subscription = await db.subscriptionPlan.findUnique({
        where: { accountId: account.id },
        select: {
            tier: true,
            status: true,
            startDate: true,
            endDate: true,
        },
    });

    const quota = await getUserQuota(account.id);
    if (!quota) {
        return null;
    }

    const features = getQuotaFeatures(quota.tier);

    return {
        account,
        subscription: subscription ? {
            tier: subscription.tier,
            status: subscription.status,
            startDate: subscription.startDate.toISOString(),
            endDate: subscription.endDate?.toISOString() || null,
            features: getQuotaFeatures(subscription.tier as QuotaTier),
        } : {
            tier: "free" as const,
            status: "free" as const,
            startDate: null,
            endDate: null,
            features: getQuotaFeatures("free"),
        },
        quota: {
            tier: quota.tier,
            dailyLimit: quota.dailyLimit,
            dailyUsed: quota.dailyUsed,
            dailyRemaining: quota.dailyRemaining,
            monthlyLimit: quota.monthlyLimit,
            monthlyUsed: quota.monthlyUsed,
            monthlyRemaining: quota.monthlyRemaining,
            rateLimit: quota.rateLimit,
            storageLimit: features.storageLimit,
        },
    };
}

async function resolveAdminAccount(input: { accountId?: string; username?: string }) {
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
