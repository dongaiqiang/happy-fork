import fastify from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { verifyGithubTokenMock, logMock } = vi.hoisted(() => ({
    verifyGithubTokenMock: vi.fn(),
    logMock: vi.fn(),
}));

vi.mock('@/app/auth/auth', () => ({
    auth: {
        createGithubToken: vi.fn(),
        verifyGithubToken: verifyGithubTokenMock,
    },
}));

vi.mock('@/utils/log', () => ({
    log: logMock,
}));

vi.mock('@/app/events/eventRouter', () => ({
    eventRouter: vi.fn(),
}));

vi.mock('@/modules/encrypt', () => ({
    decryptString: vi.fn(),
    encryptString: vi.fn(),
}));

vi.mock('@/app/github/githubConnect', () => ({
    githubConnect: vi.fn(),
}));

vi.mock('@/app/github/githubDisconnect', () => ({
    githubDisconnect: vi.fn(),
}));

vi.mock('@/context', () => ({
    Context: {
        create: vi.fn(),
    },
}));

vi.mock('@/storage/db', () => ({
    db: {},
}));

describe('connectRoutes redirect defaults', () => {
    const originalHelloVibeWebappUrl = process.env.HELLOVIBE_WEBAPP_URL;
    const originalHappyWebappUrl = process.env.HAPPY_WEBAPP_URL;

    beforeEach(() => {
        delete process.env.HELLOVIBE_WEBAPP_URL;
        delete process.env.HAPPY_WEBAPP_URL;
        verifyGithubTokenMock.mockReset();
        logMock.mockReset();
    });

    afterEach(() => {
        if (originalHelloVibeWebappUrl === undefined) {
            delete process.env.HELLOVIBE_WEBAPP_URL;
        } else {
            process.env.HELLOVIBE_WEBAPP_URL = originalHelloVibeWebappUrl;
        }

        if (originalHappyWebappUrl === undefined) {
            delete process.env.HAPPY_WEBAPP_URL;
        } else {
            process.env.HAPPY_WEBAPP_URL = originalHappyWebappUrl;
        }
    });

    it('redirects invalid github oauth state to app.hellovibe-ai.com by default', async () => {
        verifyGithubTokenMock.mockResolvedValue(null);
        const { connectRoutes } = await import('./connectRoutes');
        const app = fastify().withTypeProvider<ZodTypeProvider>();
        app.setValidatorCompiler(validatorCompiler);
        app.setSerializerCompiler(serializerCompiler);
        app.decorate('authenticate', async () => {});

        connectRoutes(app as any);

        const response = await app.inject({
            method: 'GET',
            url: '/v1/connect/github/callback?code=test-code&state=bad-state',
        });

        expect(response.statusCode).toBe(302);
        expect(response.headers.location).toBe('https://app.hellovibe-ai.com?error=invalid_state');

        await app.close();
    });
});
