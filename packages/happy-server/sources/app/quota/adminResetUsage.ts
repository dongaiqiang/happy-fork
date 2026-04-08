import { z } from "zod";
import { db } from "@/storage/db";

export const AdminResetUsageScopeSchema = z.enum(["daily", "monthly", "all"]);

export const AdminResetUsageInputSchema = z.object({
    accountId: z.string().optional(),
    username: z.string().optional(),
    scope: AdminResetUsageScopeSchema,
}).refine((value) => Boolean(value.accountId || value.username), {
    message: "accountId or username is required",
    path: ["accountId"],
});

export type AdminResetUsageInput = z.infer<typeof AdminResetUsageInputSchema>;
export type AdminResetUsageScope = z.infer<typeof AdminResetUsageScopeSchema>;

export async function executeAdminResetUsage(input: AdminResetUsageInput) {
    const account = await resolveAdminResetAccount(input);
    if (!account) {
        return null;
    }

    const usageRows = await db.dailyUsage.findMany({
        where: buildDailyUsageWhere(account.id, input.scope),
        orderBy: {
            date: "asc",
        },
        select: {
            date: true,
            tokensUsed: true,
            requests: true,
        },
    });

    const deleted = await db.dailyUsage.deleteMany({
        where: buildDailyUsageWhere(account.id, input.scope),
    });

    return {
        account,
        reset: {
            scope: input.scope,
            clearedUsageRows: deleted.count,
            clearedDates: usageRows.map((row) => row.date),
            clearedTokens: usageRows.reduce((sum, row) => sum + row.tokensUsed, 0),
            clearedRequests: usageRows.reduce((sum, row) => sum + row.requests, 0),
        },
    };
}

async function resolveAdminResetAccount(input: { accountId?: string; username?: string }) {
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

function buildDailyUsageWhere(accountId: string, scope: AdminResetUsageScope) {
    if (scope === "daily") {
        return {
            accountId,
            date: getTodayString(),
        };
    }

    if (scope === "monthly") {
        return {
            accountId,
            date: {
                gte: getFirstDayOfMonthString(),
            },
        };
    }

    return {
        accountId,
    };
}

function getTodayString() {
    return new Date().toISOString().split("T")[0];
}

function getFirstDayOfMonthString() {
    return `${new Date().toISOString().slice(0, 7)}-01`;
}
