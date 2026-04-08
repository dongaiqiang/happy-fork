import fastify from "fastify";
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from "fastify-type-provider-zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Fastify } from "../types";

type AccountRecord = {
    id: string;
    username: string | null;
};

type DailyUsageRecord = {
    accountId: string;
    date: string;
    tokensUsed: number;
    requests: number;
};

type SubscriptionPlanRecord = {
    accountId: string;
    tier: string;
    status: string;
    tokensLimit: number;
    dailyLimit: number;
    rateLimit: number;
    storageLimit: bigint;
    startDate: Date;
    endDate: Date | null;
};

const { state, resetState, dbMock } = vi.hoisted(() => {
    const state = {
        accounts: [] as AccountRecord[],
        dailyUsages: [] as DailyUsageRecord[],
        subscriptionPlans: [] as SubscriptionPlanRecord[],
    };

    const resetState = () => {
        state.accounts = [];
        state.dailyUsages = [];
        state.subscriptionPlans = [];
    };

    const selectFields = <T extends Record<string, unknown>>(row: T, select?: Record<string, boolean>) => {
        if (!select) {
            return { ...row };
        }

        const picked: Record<string, unknown> = {};
        for (const [key, enabled] of Object.entries(select)) {
            if (enabled) {
                picked[key] = row[key];
            }
        }
        return picked;
    };

    const dbMock = {
        account: {
            findUnique: vi.fn(async (args: any) => {
                const where = args?.where ?? {};
                const row = state.accounts.find((account) => {
                    if (where.id) {
                        return account.id === where.id;
                    }
                    if (where.username) {
                        return account.username === where.username;
                    }
                    return false;
                });

                if (!row) {
                    return null;
                }

                return selectFields(row as unknown as Record<string, unknown>, args?.select);
            }),
        },
        subscriptionPlan: {
            findUnique: vi.fn(async (args: any) => {
                const row = state.subscriptionPlans.find((item) => item.accountId === args?.where?.accountId);
                if (!row) {
                    return null;
                }

                return selectFields(row as unknown as Record<string, unknown>, args?.select);
            }),
            upsert: vi.fn(async (args: any) => {
                const existing = state.subscriptionPlans.find((item) => item.accountId === args?.where?.accountId);
                if (existing) {
                    existing.tier = args.update?.tier ?? existing.tier;
                    existing.status = args.update?.status ?? existing.status;
                    existing.tokensLimit = args.update?.tokensLimit ?? existing.tokensLimit;
                    existing.dailyLimit = args.update?.dailyLimit ?? existing.dailyLimit;
                    existing.rateLimit = args.update?.rateLimit ?? existing.rateLimit;
                    existing.storageLimit = args.update?.storageLimit ?? existing.storageLimit;
                    existing.startDate = args.update?.startDate ?? existing.startDate;
                    existing.endDate = args.update?.endDate ?? existing.endDate;
                    return { ...existing };
                }

                const created: SubscriptionPlanRecord = {
                    accountId: args.create.accountId,
                    tier: args.create.tier,
                    status: args.create.status,
                    tokensLimit: args.create.tokensLimit,
                    dailyLimit: args.create.dailyLimit,
                    rateLimit: args.create.rateLimit,
                    storageLimit: args.create.storageLimit,
                    startDate: args.create.startDate,
                    endDate: args.create.endDate,
                };
                state.subscriptionPlans.push(created);
                return { ...created };
            }),
            deleteMany: vi.fn(async (args: any) => {
                const before = state.subscriptionPlans.length;
                state.subscriptionPlans = state.subscriptionPlans.filter((item) => item.accountId !== args?.where?.accountId);
                return { count: before - state.subscriptionPlans.length };
            }),
        },
        dailyUsage: {
            findUnique: vi.fn(async (args: any) => {
                const target = args?.where?.accountId_date;
                const row = state.dailyUsages.find((item) => item.accountId === target?.accountId && item.date === target?.date);
                return row ? { ...row } : null;
            }),
            groupBy: vi.fn(async (args: any) => {
                const rows = state.dailyUsages.filter((item) => {
                    const matchesAccount = !args?.where?.accountId || item.accountId === args.where.accountId;
                    const lowerBound = args?.where?.date?.gte;
                    const matchesDate = !lowerBound || item.date >= lowerBound;
                    return matchesAccount && matchesDate;
                });

                if (rows.length === 0) {
                    return [];
                }

                const tokensUsed = rows.reduce((sum, item) => sum + item.tokensUsed, 0);
                return [{
                    accountId: rows[0].accountId,
                    _sum: {
                        tokensUsed,
                    },
                }];
            }),
        },
    };

    return {
        state,
        resetState,
        dbMock,
    };
});

vi.mock("@/storage/db", () => ({
    db: dbMock,
}));

function getTodayString() {
    return new Date().toISOString().split("T")[0];
}

function getFirstDayOfMonthString() {
    return `${new Date().toISOString().slice(0, 7)}-01`;
}

describe("quotaRoutes /admin/upgrade", () => {
    let app: Fastify;

    beforeEach(async () => {
        resetState();
        process.env.ADMIN_TOKEN = "admin-secret";

        const server = fastify();
        server.setValidatorCompiler(validatorCompiler);
        server.setSerializerCompiler(serializerCompiler);
        server.decorate("authenticate", async () => {});

        app = server.withTypeProvider<ZodTypeProvider>() as unknown as Fastify;

        const { quotaRoutes } = await import("./quotaRoutes");
        quotaRoutes(app);
        await app.ready();
    });

    afterEach(async () => {
        delete process.env.ADMIN_TOKEN;
        await app.close();
        vi.clearAllMocks();
    });

    it("returns 503 when ADMIN_TOKEN is not configured", async () => {
        state.accounts.push({ id: "user-1", username: "alice" });
        delete process.env.ADMIN_TOKEN;

        const response = await app.inject({
            method: "POST",
            url: "/admin/upgrade",
            headers: {
                "x-admin-token": "admin-secret",
            },
            payload: {
                accountId: "user-1",
                tier: "pro",
            },
        });

        expect(response.statusCode).toBe(503);
        expect(response.json()).toMatchObject({
            success: false,
            error: "admin_token_not_configured",
            message: "ADMIN_TOKEN is not configured",
        });
    });

    it("rejects requests when the admin token is missing or invalid", async () => {
        state.accounts.push({ id: "user-1", username: "alice" });

        const response = await app.inject({
            method: "POST",
            url: "/admin/upgrade",
            payload: {
                accountId: "user-1",
                tier: "pro",
            },
        });

        expect(response.statusCode).toBe(401);
        expect(response.json()).toMatchObject({
            success: false,
            error: "invalid_admin_token",
        });
    });

    it("upgrades a target account resolved by username", async () => {
        state.accounts.push({ id: "user-1", username: "alice" });

        const response = await app.inject({
            method: "POST",
            url: "/admin/upgrade",
            headers: {
                "x-admin-token": "admin-secret",
            },
            payload: {
                username: "alice",
                tier: "pro",
                billingPeriod: "annual",
            },
        });

        expect(response.statusCode).toBe(200);

        const body = response.json();
        expect(body).toMatchObject({
            success: true,
            account: {
                id: "user-1",
                username: "alice",
            },
            subscription: {
                tier: "pro",
                status: "active",
                features: {
                    dailyLimit: 100000,
                    monthlyLimit: 2000000,
                    rateLimit: 100,
                    storageLimit: "21474836480",
                },
            },
        });

        expect(state.subscriptionPlans).toHaveLength(1);
        expect(state.subscriptionPlans[0]).toMatchObject({
            accountId: "user-1",
            tier: "pro",
            status: "active",
            tokensLimit: 2000000,
            dailyLimit: 100000,
            rateLimit: 100,
        });
        expect(state.subscriptionPlans[0].endDate).toBeInstanceOf(Date);
    });

    it("upgrades a target account resolved by accountId with explicit status and endDate", async () => {
        state.accounts.push({ id: "user-2", username: "bob" });
        const endDate = "2026-12-31T00:00:00.000Z";

        const response = await app.inject({
            method: "POST",
            url: "/admin/upgrade",
            headers: {
                "x-admin-token": "admin-secret",
            },
            payload: {
                accountId: "user-2",
                tier: "team",
                status: "cancelled",
                endDate,
            },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            success: true,
            account: {
                id: "user-2",
                username: "bob",
            },
            subscription: {
                tier: "team",
                status: "cancelled",
                endDate,
                features: {
                    dailyLimit: 500000,
                    monthlyLimit: 10000000,
                    rateLimit: 300,
                    storageLimit: "107374182400",
                },
            },
        });

        expect(state.subscriptionPlans).toHaveLength(1);
        expect(state.subscriptionPlans[0]).toMatchObject({
            accountId: "user-2",
            tier: "team",
            status: "cancelled",
            tokensLimit: 10000000,
            dailyLimit: 500000,
            rateLimit: 300,
        });
        expect(state.subscriptionPlans[0].endDate?.toISOString()).toBe(endDate);
    });

    it("removes the paid subscription when switching back to free tier", async () => {
        state.accounts.push({ id: "user-1", username: "alice" });
        state.subscriptionPlans.push({
            accountId: "user-1",
            tier: "team",
            status: "active",
            tokensLimit: 10000000,
            dailyLimit: 500000,
            rateLimit: 300,
            storageLimit: BigInt(1024),
            startDate: new Date("2026-01-01T00:00:00.000Z"),
            endDate: new Date("2026-02-01T00:00:00.000Z"),
        });

        const response = await app.inject({
            method: "POST",
            url: "/admin/upgrade",
            headers: {
                authorization: "Bearer admin-secret",
            },
            payload: {
                accountId: "user-1",
                tier: "free",
            },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            success: true,
            subscription: {
                tier: "free",
                status: "free",
                endDate: null,
                features: {
                    dailyLimit: 5000,
                    monthlyLimit: 100000,
                    rateLimit: 10,
                    storageLimit: "104857600",
                },
            },
        });
        expect(state.subscriptionPlans).toHaveLength(0);
    });

    it("preserves the existing startDate when updating an existing subscription", async () => {
        state.accounts.push({ id: "user-1", username: "alice" });
        const originalStartDate = new Date("2026-01-01T00:00:00.000Z");

        state.subscriptionPlans.push({
            accountId: "user-1",
            tier: "student",
            status: "active",
            tokensLimit: 500000,
            dailyLimit: 20000,
            rateLimit: 30,
            storageLimit: BigInt(1024),
            startDate: originalStartDate,
            endDate: new Date("2026-02-01T00:00:00.000Z"),
        });

        const response = await app.inject({
            method: "POST",
            url: "/admin/upgrade",
            headers: {
                "x-admin-token": "admin-secret",
            },
            payload: {
                accountId: "user-1",
                tier: "pro",
                billingPeriod: "annual",
            },
        });

        expect(response.statusCode).toBe(200);
        expect(state.subscriptionPlans).toHaveLength(1);
        expect(state.subscriptionPlans[0].startDate).toEqual(originalStartDate);
        expect(response.json()).toMatchObject({
            success: true,
            subscription: {
                tier: "pro",
                startDate: originalStartDate.toISOString(),
            },
        });
    });
});

describe("quotaRoutes /admin/account-quota", () => {
    let app: Fastify;

    beforeEach(async () => {
        resetState();
        process.env.ADMIN_TOKEN = "admin-secret";

        const server = fastify();
        server.setValidatorCompiler(validatorCompiler);
        server.setSerializerCompiler(serializerCompiler);
        server.decorate("authenticate", async () => {});

        app = server.withTypeProvider<ZodTypeProvider>() as unknown as Fastify;

        const { quotaRoutes } = await import("./quotaRoutes");
        quotaRoutes(app);
        await app.ready();
    });

    afterEach(async () => {
        delete process.env.ADMIN_TOKEN;
        await app.close();
        vi.clearAllMocks();
    });

    it("returns 503 when ADMIN_TOKEN is not configured", async () => {
        state.accounts.push({ id: "user-1", username: "alice" });
        delete process.env.ADMIN_TOKEN;

        const response = await app.inject({
            method: "GET",
            url: "/admin/account-quota?accountId=user-1",
            headers: {
                "x-admin-token": "admin-secret",
            },
        });

        expect(response.statusCode).toBe(503);
        expect(response.json()).toMatchObject({
            success: false,
            error: "admin_token_not_configured",
            message: "ADMIN_TOKEN is not configured",
        });
    });

    it("rejects requests when the admin token is missing or invalid", async () => {
        state.accounts.push({ id: "user-1", username: "alice" });

        const response = await app.inject({
            method: "GET",
            url: "/admin/account-quota?accountId=user-1",
        });

        expect(response.statusCode).toBe(401);
        expect(response.json()).toMatchObject({
            success: false,
            error: "invalid_admin_token",
        });
    });

    it("returns free subscription and quota snapshot when the target account has no paid subscription", async () => {
        state.accounts.push({ id: "user-1", username: "alice" });
        state.dailyUsages.push(
            {
                accountId: "user-1",
                date: getFirstDayOfMonthString(),
                tokensUsed: 1200,
                requests: 2,
            },
            {
                accountId: "user-1",
                date: getTodayString(),
                tokensUsed: 3200,
                requests: 5,
            },
        );

        const response = await app.inject({
            method: "GET",
            url: "/admin/account-quota?username=alice",
            headers: {
                "x-admin-token": "admin-secret",
            },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            success: true,
            account: {
                id: "user-1",
                username: "alice",
            },
            subscription: {
                tier: "free",
                status: "free",
                startDate: null,
                endDate: null,
                features: {
                    dailyLimit: 5000,
                    monthlyLimit: 100000,
                    rateLimit: 10,
                    storageLimit: "104857600",
                },
            },
            quota: {
                tier: "free",
                dailyLimit: 5000,
                dailyUsed: 3200,
                dailyRemaining: 1800,
                monthlyLimit: 100000,
                monthlyUsed: 4400,
                monthlyRemaining: 95600,
                rateLimit: 10,
                storageLimit: "104857600",
            },
        });
    });

    it("returns paid subscription and quota snapshot when the target account is resolved by accountId", async () => {
        state.accounts.push({ id: "user-2", username: "bob" });
        state.subscriptionPlans.push({
            accountId: "user-2",
            tier: "team",
            status: "active",
            tokensLimit: 10000000,
            dailyLimit: 500000,
            rateLimit: 300,
            storageLimit: BigInt(1024),
            startDate: new Date("2026-01-01T00:00:00.000Z"),
            endDate: new Date("2026-12-31T00:00:00.000Z"),
        });
        state.dailyUsages.push(
            {
                accountId: "user-2",
                date: getFirstDayOfMonthString(),
                tokensUsed: 120000,
                requests: 8,
            },
            {
                accountId: "user-2",
                date: getTodayString(),
                tokensUsed: 50000,
                requests: 3,
            },
        );

        const response = await app.inject({
            method: "GET",
            url: "/admin/account-quota?accountId=user-2",
            headers: {
                authorization: "Bearer admin-secret",
            },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            success: true,
            account: {
                id: "user-2",
                username: "bob",
            },
            subscription: {
                tier: "team",
                status: "active",
                startDate: "2026-01-01T00:00:00.000Z",
                endDate: "2026-12-31T00:00:00.000Z",
                features: {
                    dailyLimit: 500000,
                    monthlyLimit: 10000000,
                    rateLimit: 300,
                    storageLimit: "107374182400",
                },
            },
            quota: {
                tier: "team",
                dailyLimit: 500000,
                dailyUsed: 50000,
                dailyRemaining: 450000,
                monthlyLimit: 10000000,
                monthlyUsed: 170000,
                monthlyRemaining: 9830000,
                rateLimit: 300,
                storageLimit: "107374182400",
            },
        });
    });

    it("returns 404 when the target account does not exist", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/admin/account-quota?username=missing-user",
            headers: {
                "x-admin-token": "admin-secret",
            },
        });

        expect(response.statusCode).toBe(404);
        expect(response.json()).toMatchObject({
            success: false,
            error: "account_not_found",
            message: "Target account was not found",
        });
    });
});
