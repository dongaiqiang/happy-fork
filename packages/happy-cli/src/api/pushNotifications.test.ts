import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet, mockLoggerDebug, mockExpo } = vi.hoisted(() => ({
    mockGet: vi.fn(),
    mockLoggerDebug: vi.fn(),
    mockExpo: vi.fn(() => ({
        chunkPushNotifications: vi.fn(),
        sendPushNotificationsAsync: vi.fn(),
    })),
}));

vi.mock('axios', () => ({
    default: {
        get: mockGet,
    },
}));

vi.mock('@/ui/logger', () => ({
    logger: {
        debug: mockLoggerDebug,
    },
}));

vi.mock('expo-server-sdk', () => ({
    Expo: Object.assign(mockExpo, {
        isExpoPushToken: vi.fn(() => true),
    }),
}));

describe('PushNotificationClient defaults', () => {
    beforeEach(() => {
        mockGet.mockReset();
        mockLoggerDebug.mockReset();
        mockExpo.mockClear();
    });

    it('uses the hellovibe-ai api when no base url is provided', async () => {
        mockGet.mockResolvedValue({
            data: {
                tokens: [],
            },
        });

        const { PushNotificationClient } = await import('./pushNotifications');
        const client = new PushNotificationClient('test-token');

        await client.fetchPushTokens();

        expect(mockGet).toHaveBeenCalledWith(
            'https://api.hellovibe-ai.com/v1/push-tokens',
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer test-token',
                }),
            })
        );
    });
});
