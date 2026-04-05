import { describe, expect, it, vi } from 'vitest';
import { RpcHandlerManager } from './RpcHandlerManager';

function encodePlaintextPayload(payload: unknown): string {
    return Buffer.from(`PLAINTEXT:${JSON.stringify(payload)}`, 'utf8').toString('base64');
}

function decodePlaintextPayload(payload: string): any {
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
}

describe('RpcHandlerManager', () => {
    it('handles plaintext rpc-request payloads without ENABLE_PLAINTEXT_MODE', async () => {
        const manager = new RpcHandlerManager({
            scopePrefix: 'machine-1',
            encryptionKey: new Uint8Array(32).fill(1),
            encryptionVariant: 'dataKey',
            logger: vi.fn()
        });

        manager.registerHandler('spawn-happy-session', async (params: any) => ({
            ok: true,
            sessionId: params.happySessionId
        }));

        const response = await manager.handleRequest({
            method: 'machine-1:spawn-happy-session',
            params: encodePlaintextPayload({
                happySessionId: 'session-1',
                tmuxSessionId: 'happy:window-1'
            })
        });

        expect(decodePlaintextPayload(response)).toEqual({
            ok: true,
            sessionId: 'session-1'
        });
    });

    it('returns plaintext error payloads for plaintext rpc-request failures', async () => {
        const manager = new RpcHandlerManager({
            scopePrefix: 'machine-1',
            encryptionKey: new Uint8Array(32).fill(1),
            encryptionVariant: 'dataKey',
            logger: vi.fn()
        });

        const response = await manager.handleRequest({
            method: 'machine-1:missing-handler',
            params: encodePlaintextPayload({
                happySessionId: 'session-1'
            })
        });

        expect(decodePlaintextPayload(response)).toEqual({
            error: 'Method not found'
        });
    });
});
