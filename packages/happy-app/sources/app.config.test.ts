import { afterEach, describe, expect, it, vi } from 'vitest';

const originalAppEnv = process.env.APP_ENV;

async function loadConfig(appEnv?: string) {
    if (appEnv == null) {
        delete process.env.APP_ENV;
    } else {
        process.env.APP_ENV = appEnv;
    }

    vi.resetModules();
    const suffix = (appEnv ?? 'default') + '-' + Date.now();
    return (await import('../app.config.js?case=' + suffix)).default;
}

afterEach(() => {
    if (originalAppEnv === undefined) {
        delete process.env.APP_ENV;
    } else {
        process.env.APP_ENV = originalAppEnv;
    }
    vi.resetModules();
});

describe('app.config deep links', () => {
    it('uses the hellovibe-ai host for production deep links', async () => {
        const config = await loadConfig('production');

        expect(config.expo.ios.associatedDomains).toEqual(['applinks:app.hellovibe-ai.com']);
        expect(config.expo.android.intentFilters[0].data[0].host).toBe('app.hellovibe-ai.com');
    });

    it('keeps deep links disabled outside production', async () => {
        const config = await loadConfig('development');

        expect(config.expo.ios.associatedDomains).toEqual([]);
        expect(config.expo.android.intentFilters).toEqual([]);
    });
});
