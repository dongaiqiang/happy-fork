import { MMKV } from 'react-native-mmkv';

// Separate MMKV instance for server config that persists across logouts
const serverConfigStorage = new MMKV({ id: 'server-config' });

const SERVER_KEY = 'custom-server-url';
const DEFAULT_SERVER_URL = 'https://api.easycode-ai.xyz';

export type ServerUrlSource =
    | 'stored-custom-server-url'
    | 'env-expo-public-hellovibe-server-url'
    | 'env-expo-public-happy-server-url'
    | 'env-expo-public-server-url'
    | 'default-server-url';

export interface ResolvedServerUrlInfo {
    url: string;
    source: ServerUrlSource;
    storedCustomServerUrl: string | null;
    envHelloVibeServerUrl: string | null;
    envHappyServerUrl: string | null;
    envServerUrl: string | null;
    defaultServerUrl: string;
}

export function getResolvedServerUrlInfo(): ResolvedServerUrlInfo {
    const storedCustomServerUrl = serverConfigStorage.getString(SERVER_KEY)?.trim() || null;
    const envHelloVibeServerUrl = process.env.EXPO_PUBLIC_HELLOVIBE_SERVER_URL?.trim() || null;
    const envHappyServerUrl = process.env.EXPO_PUBLIC_HAPPY_SERVER_URL?.trim() || null;
    const envServerUrl = process.env.EXPO_PUBLIC_SERVER_URL?.trim() || null;

    if (storedCustomServerUrl) {
        return {
            url: storedCustomServerUrl,
            source: 'stored-custom-server-url',
            storedCustomServerUrl,
            envHelloVibeServerUrl,
            envHappyServerUrl,
            envServerUrl,
            defaultServerUrl: DEFAULT_SERVER_URL
        };
    }

    if (envHelloVibeServerUrl) {
        return {
            url: envHelloVibeServerUrl,
            source: 'env-expo-public-hellovibe-server-url',
            storedCustomServerUrl: null,
            envHelloVibeServerUrl,
            envHappyServerUrl,
            envServerUrl,
            defaultServerUrl: DEFAULT_SERVER_URL
        };
    }

    if (envHappyServerUrl) {
        return {
            url: envHappyServerUrl,
            source: 'env-expo-public-happy-server-url',
            storedCustomServerUrl: null,
            envHelloVibeServerUrl,
            envHappyServerUrl,
            envServerUrl,
            defaultServerUrl: DEFAULT_SERVER_URL
        };
    }

    if (envServerUrl) {
        return {
            url: envServerUrl,
            source: 'env-expo-public-server-url',
            storedCustomServerUrl: null,
            envHelloVibeServerUrl,
            envHappyServerUrl,
            envServerUrl,
            defaultServerUrl: DEFAULT_SERVER_URL
        };
    }

    return {
        url: DEFAULT_SERVER_URL,
        source: 'default-server-url',
        storedCustomServerUrl: null,
        envHelloVibeServerUrl,
        envHappyServerUrl,
        envServerUrl,
        defaultServerUrl: DEFAULT_SERVER_URL
    };
}

export function getServerUrl(): string {
    return getResolvedServerUrlInfo().url;
}

export function setServerUrl(url: string | null): void {
    if (url && url.trim()) {
        serverConfigStorage.set(SERVER_KEY, url.trim());
    } else {
        serverConfigStorage.delete(SERVER_KEY);
    }
}

export function isUsingCustomServer(): boolean {
    return getServerUrl() !== DEFAULT_SERVER_URL;
}

export function getServerInfo(): { hostname: string; port?: number; isCustom: boolean } {
    const url = getServerUrl();
    const isCustom = isUsingCustomServer();
    
    try {
        const parsed = new URL(url);
        const port = parsed.port ? parseInt(parsed.port) : undefined;
        return {
            hostname: parsed.hostname,
            port,
            isCustom
        };
    } catch {
        // Fallback if URL parsing fails
        return {
            hostname: url,
            port: undefined,
            isCustom
        };
    }
}

export function validateServerUrl(url: string): { valid: boolean; error?: string } {
    if (!url || !url.trim()) {
        return { valid: false, error: 'Server URL cannot be empty' };
    }
    
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return { valid: false, error: 'Server URL must use HTTP or HTTPS protocol' };
        }
        return { valid: true };
    } catch {
        return { valid: false, error: 'Invalid URL format' };
    }
}
