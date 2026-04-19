import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

vi.mock('./serverConfig', () => ({
    getServerUrl: () => 'https://api.hellovibe-ai.com',
}));

describe('apiAdminQuotaOps', () => {
    beforeEach(() => {
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('queries admin account quota with admin token and locator', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                success: true,
                account: {
                    id: 'account-1',
                    username: 'alice',
                },
                subscription: {
                    tier: 'pro',
                    status: 'active',
                    startDate: '2026-04-08T00:00:00.000Z',
                    endDate: '2027-04-08T00:00:00.000Z',
                    features: {
                        dailyLimit: 100000,
                        monthlyLimit: 2000000,
                        rateLimit: 100,
                        storageLimit: '20GB',
                    },
                },
                quota: {
                    tier: 'pro',
                    dailyLimit: 100000,
                    dailyUsed: 3200,
                    dailyRemaining: 96800,
                    monthlyLimit: 2000000,
                    monthlyUsed: 4400,
                    monthlyRemaining: 1995600,
                    rateLimit: 100,
                    storageLimit: '20GB',
                },
            }),
        });

        const { queryAdminAccountQuota } = await import('./apiAdminQuotaOps');

        await expect(queryAdminAccountQuota({
            adminToken: 'admin-secret',
            username: 'alice',
        })).resolves.toMatchObject({
            account: {
                id: 'account-1',
            },
            quota: {
                dailyRemaining: 96800,
            },
        });

        expect(fetchMock).toHaveBeenCalledWith('https://api.hellovibe-ai.com/admin/account-quota?username=alice', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-token': 'admin-secret',
            },
        });
    });

    it('surfaces structured server errors for upgrade requests', async () => {
        fetchMock.mockResolvedValue({
            ok: false,
            status: 404,
            json: async () => ({
                success: false,
                error: 'account_not_found',
                message: 'Target account was not found',
            }),
        });

        const { upgradeAdminAccount, AdminQuotaOpsError } = await import('./apiAdminQuotaOps');

        await expect(upgradeAdminAccount({
            adminToken: 'admin-secret',
            accountId: 'missing-account',
            tier: 'team',
            billingPeriod: 'annual',
        })).rejects.toBeInstanceOf(AdminQuotaOpsError);
    });

    it('posts reset scope and parses the reset summary', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                success: true,
                account: {
                    id: 'account-1',
                    username: 'alice',
                },
                reset: {
                    scope: 'monthly',
                    clearedUsageRows: 2,
                    clearedDates: ['2026-04-01', '2026-04-08'],
                    clearedTokens: 4400,
                    clearedRequests: 7,
                },
            }),
        });

        const { resetAdminUsage } = await import('./apiAdminQuotaOps');

        await expect(resetAdminUsage({
            adminToken: 'admin-secret',
            accountId: 'account-1',
            scope: 'monthly',
        })).resolves.toMatchObject({
            reset: {
                clearedUsageRows: 2,
                clearedTokens: 4400,
            },
        });

        expect(fetchMock).toHaveBeenCalledWith('https://api.hellovibe-ai.com/admin/quota/reset-usage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-token': 'admin-secret',
            },
            body: JSON.stringify({
                accountId: 'account-1',
                scope: 'monthly',
            }),
        });
    });
});
