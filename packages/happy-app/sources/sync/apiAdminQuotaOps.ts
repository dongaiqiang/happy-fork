import { z } from 'zod';
import { getServerUrl } from './serverConfig';

const AdminQuotaTierSchema = z.enum(['free', 'student', 'pro', 'team', 'enterprise']);
const AdminBillingPeriodSchema = z.enum(['monthly', 'annual']);
const AdminResetScopeSchema = z.enum(['daily', 'monthly', 'all']);

const AdminAccountSchema = z.object({
    id: z.string(),
    username: z.string().nullable(),
});

const AdminQuotaFeaturesSchema = z.object({
    dailyLimit: z.number(),
    monthlyLimit: z.number(),
    rateLimit: z.number(),
    storageLimit: z.string(),
});

const AdminAccountLocatorSchema = z.object({
    accountId: z.string().trim().optional(),
    username: z.string().trim().optional(),
}).transform((value) => ({
    accountId: value.accountId || undefined,
    username: value.username || undefined,
})).refine((value) => Boolean(value.accountId || value.username), {
    message: 'accountId or username is required',
    path: ['accountId'],
});

const AdminAccountQuotaResponseSchema = z.object({
    success: z.literal(true),
    account: AdminAccountSchema,
    subscription: z.object({
        tier: AdminQuotaTierSchema,
        status: z.string(),
        startDate: z.string().nullable(),
        endDate: z.string().nullable(),
        features: AdminQuotaFeaturesSchema,
    }),
    quota: z.object({
        tier: AdminQuotaTierSchema,
        dailyLimit: z.number(),
        dailyUsed: z.number(),
        dailyRemaining: z.number(),
        monthlyLimit: z.number(),
        monthlyUsed: z.number(),
        monthlyRemaining: z.number(),
        rateLimit: z.number(),
        storageLimit: z.string(),
    }),
});

const AdminUpgradeResponseSchema = z.object({
    success: z.literal(true),
    account: AdminAccountSchema,
    subscription: z.object({
        tier: AdminQuotaTierSchema,
        status: z.string(),
        startDate: z.string().nullable().optional(),
        endDate: z.string().nullable(),
        features: AdminQuotaFeaturesSchema,
    }),
});

const AdminResetUsageResponseSchema = z.object({
    success: z.literal(true),
    account: AdminAccountSchema,
    reset: z.object({
        scope: AdminResetScopeSchema,
        clearedUsageRows: z.number(),
        clearedDates: z.array(z.string()),
        clearedTokens: z.number(),
        clearedRequests: z.number(),
    }),
});

const AdminErrorResponseSchema = z.object({
    success: z.literal(false).optional(),
    error: z.string().optional(),
    message: z.string().optional(),
});

export type AdminQuotaTier = z.infer<typeof AdminQuotaTierSchema>;
export type AdminBillingPeriod = z.infer<typeof AdminBillingPeriodSchema>;
export type AdminResetScope = z.infer<typeof AdminResetScopeSchema>;
export type AdminAccountLocator = z.input<typeof AdminAccountLocatorSchema>;
export type AdminAccountQuotaResponse = z.infer<typeof AdminAccountQuotaResponseSchema>;
export type AdminUpgradeResponse = z.infer<typeof AdminUpgradeResponseSchema>;
export type AdminResetUsageResponse = z.infer<typeof AdminResetUsageResponseSchema>;

export class AdminQuotaOpsError extends Error {
    readonly status: number;
    readonly errorCode?: string;

    constructor(message: string, status: number, errorCode?: string) {
        super(message);
        this.name = 'AdminQuotaOpsError';
        this.status = status;
        this.errorCode = errorCode;
    }
}

export async function queryAdminAccountQuota(input: AdminAccountLocator & { adminToken: string }) {
    const locator = AdminAccountLocatorSchema.parse(input);
    const query = new URLSearchParams();

    if (locator.accountId) {
        query.set('accountId', locator.accountId);
    }

    if (locator.username) {
        query.set('username', locator.username);
    }

    return await requestAdminJson(
        `/admin/account-quota?${query.toString()}`,
        {
            method: 'GET',
            headers: buildAdminHeaders(input.adminToken),
        },
        AdminAccountQuotaResponseSchema,
    );
}

export async function upgradeAdminAccount(input: AdminAccountLocator & {
    adminToken: string;
    tier: AdminQuotaTier;
    billingPeriod?: AdminBillingPeriod;
}) {
    const locator = AdminAccountLocatorSchema.parse(input);
    const body = {
        ...locator,
        tier: input.tier,
        ...(input.tier === 'free' ? {} : { billingPeriod: input.billingPeriod ?? 'monthly' }),
    };

    return await requestAdminJson(
        '/admin/upgrade',
        {
            method: 'POST',
            headers: buildAdminHeaders(input.adminToken),
            body: JSON.stringify(body),
        },
        AdminUpgradeResponseSchema,
    );
}

export async function resetAdminUsage(input: AdminAccountLocator & {
    adminToken: string;
    scope: AdminResetScope;
}) {
    const locator = AdminAccountLocatorSchema.parse(input);

    return await requestAdminJson(
        '/admin/quota/reset-usage',
        {
            method: 'POST',
            headers: buildAdminHeaders(input.adminToken),
            body: JSON.stringify({
                ...locator,
                scope: input.scope,
            }),
        },
        AdminResetUsageResponseSchema,
    );
}

function buildAdminHeaders(adminToken: string) {
    return {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken.trim(),
    };
}

async function requestAdminJson<T>(path: string, init: RequestInit, schema: z.ZodType<T>) {
    const response = await fetch(`${getServerUrl()}${path}`, init);
    const payload = await readJson(response);

    if (!response.ok) {
        const parsed = AdminErrorResponseSchema.safeParse(payload);
        throw new AdminQuotaOpsError(
            parsed.success ? (parsed.data.message || parsed.data.error || `Request failed: ${response.status}`) : `Request failed: ${response.status}`,
            response.status,
            parsed.success ? parsed.data.error : undefined,
        );
    }

    return schema.parse(payload);
}

async function readJson(response: Response) {
    try {
        return await response.json();
    } catch {
        return null;
    }
}
