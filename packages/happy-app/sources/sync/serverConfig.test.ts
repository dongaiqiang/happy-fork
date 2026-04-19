import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();
const originalExpoPublicHelloVibeServerUrl = process.env.EXPO_PUBLIC_HELLOVIBE_SERVER_URL;
const originalExpoPublicHappyServerUrl = process.env.EXPO_PUBLIC_HAPPY_SERVER_URL;
const originalExpoPublicServerUrl = process.env.EXPO_PUBLIC_SERVER_URL;

vi.mock('react-native-mmkv', () => ({
    MMKV: class {
        getString(key: string) {
            return storage.get(key);
        }

        set(key: string, value: string) {
            storage.set(key, value);
        }

        delete(key: string) {
            storage.delete(key);
        }
    }
}));

describe('serverConfig', () => {
    beforeEach(() => {
        vi.resetModules();
        storage.clear();
        delete process.env.EXPO_PUBLIC_HELLOVIBE_SERVER_URL;
        delete process.env.EXPO_PUBLIC_HAPPY_SERVER_URL;
        delete process.env.EXPO_PUBLIC_SERVER_URL;
    });

    afterEach(() => {
        if (originalExpoPublicHelloVibeServerUrl === undefined) {
            delete process.env.EXPO_PUBLIC_HELLOVIBE_SERVER_URL;
        } else {
            process.env.EXPO_PUBLIC_HELLOVIBE_SERVER_URL = originalExpoPublicHelloVibeServerUrl;
        }

        if (originalExpoPublicHappyServerUrl === undefined) {
            delete process.env.EXPO_PUBLIC_HAPPY_SERVER_URL;
        } else {
            process.env.EXPO_PUBLIC_HAPPY_SERVER_URL = originalExpoPublicHappyServerUrl;
        }

        if (originalExpoPublicServerUrl === undefined) {
            delete process.env.EXPO_PUBLIC_SERVER_URL;
        } else {
            process.env.EXPO_PUBLIC_SERVER_URL = originalExpoPublicServerUrl;
        }
    });

    it('uses the stored custom server URL before environment variables', async () => {
        process.env.EXPO_PUBLIC_HAPPY_SERVER_URL = 'http://env-happy.example.com';
        process.env.EXPO_PUBLIC_SERVER_URL = 'http://env-generic.example.com';

        const { setServerUrl, getResolvedServerUrlInfo } = await import('./serverConfig');
        setServerUrl('http://stored.example.com');

        expect(getResolvedServerUrlInfo()).toEqual({
            url: 'http://stored.example.com',
            source: 'stored-custom-server-url',
            storedCustomServerUrl: 'http://stored.example.com',
            envHelloVibeServerUrl: null,
            envHappyServerUrl: 'http://env-happy.example.com',
            envServerUrl: 'http://env-generic.example.com',
            defaultServerUrl: 'https://api.hellovibe-ai.com'
        });
    });

    it('uses EXPO_PUBLIC_HELLOVIBE_SERVER_URL before compatibility envs', async () => {
        process.env.EXPO_PUBLIC_HELLOVIBE_SERVER_URL = 'http://env-hellovibe.example.com';
        process.env.EXPO_PUBLIC_HAPPY_SERVER_URL = 'http://env-happy.example.com';
        process.env.EXPO_PUBLIC_SERVER_URL = 'http://env-generic.example.com';

        const { getResolvedServerUrlInfo } = await import('./serverConfig');

        expect(getResolvedServerUrlInfo()).toEqual({
            url: 'http://env-hellovibe.example.com',
            source: 'env-expo-public-hellovibe-server-url',
            storedCustomServerUrl: null,
            envHelloVibeServerUrl: 'http://env-hellovibe.example.com',
            envHappyServerUrl: 'http://env-happy.example.com',
            envServerUrl: 'http://env-generic.example.com',
            defaultServerUrl: 'https://api.hellovibe-ai.com'
        });
    });

    it('uses EXPO_PUBLIC_HAPPY_SERVER_URL before EXPO_PUBLIC_SERVER_URL', async () => {
        process.env.EXPO_PUBLIC_HAPPY_SERVER_URL = 'http://env-happy.example.com';
        process.env.EXPO_PUBLIC_SERVER_URL = 'http://env-generic.example.com';

        const { getResolvedServerUrlInfo } = await import('./serverConfig');

        expect(getResolvedServerUrlInfo()).toEqual({
            url: 'http://env-happy.example.com',
            source: 'env-expo-public-happy-server-url',
            storedCustomServerUrl: null,
            envHelloVibeServerUrl: null,
            envHappyServerUrl: 'http://env-happy.example.com',
            envServerUrl: 'http://env-generic.example.com',
            defaultServerUrl: 'https://api.hellovibe-ai.com'
        });
    });

    it('falls back to EXPO_PUBLIC_SERVER_URL when the happy-specific env is missing', async () => {
        process.env.EXPO_PUBLIC_SERVER_URL = 'http://env-generic.example.com';

        const { getResolvedServerUrlInfo } = await import('./serverConfig');

        expect(getResolvedServerUrlInfo()).toEqual({
            url: 'http://env-generic.example.com',
            source: 'env-expo-public-server-url',
            storedCustomServerUrl: null,
            envHelloVibeServerUrl: null,
            envHappyServerUrl: null,
            envServerUrl: 'http://env-generic.example.com',
            defaultServerUrl: 'https://api.hellovibe-ai.com'
        });
    });

    it('uses the hellovibe-ai default when no stored or runtime value exists', async () => {
        const { getResolvedServerUrlInfo } = await import('./serverConfig');

        expect(getResolvedServerUrlInfo()).toEqual({
            url: 'https://api.hellovibe-ai.com',
            source: 'default-server-url',
            storedCustomServerUrl: null,
            envHelloVibeServerUrl: null,
            envHappyServerUrl: null,
            envServerUrl: null,
            defaultServerUrl: 'https://api.hellovibe-ai.com'
        });
    });
});
