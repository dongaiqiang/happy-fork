import { describe, expect, it } from 'vitest';
import { clearPendingRequestsForTmuxHostedLocalStart, isTmuxInjectableMobileTextMessage } from './runClaude';

describe('isTmuxInjectableMobileTextMessage', () => {
    it('accepts standard mobile text messages with default metadata envelope', () => {
        expect(isTmuxInjectableMobileTextMessage({
            content: {
                type: 'text',
                text: '你好'
            },
            meta: {
                sentFrom: 'ios',
                permissionMode: 'default',
                model: null,
                fallbackModel: null,
                appendSystemPrompt: 'default prompt'
            } as any
        })).toBe(true);
    });

    it('rejects messages with custom system prompt overrides', () => {
        expect(isTmuxInjectableMobileTextMessage({
            content: {
                type: 'text',
                text: '你好'
            },
            meta: {
                sentFrom: 'ios',
                customSystemPrompt: 'override'
            }
        })).toBe(false);
    });

    it('rejects non-mobile sources', () => {
        expect(isTmuxInjectableMobileTextMessage({
            content: {
                type: 'text',
                text: '你好'
            },
            meta: {
                sentFrom: 'cli'
            }
        })).toBe(false);
    });
});

describe('clearPendingRequestsForTmuxHostedLocalStart', () => {
    it('moves pending requests into completed canceled requests', () => {
        const nextState = clearPendingRequestsForTmuxHostedLocalStart({
            requests: {
                req1: {
                    tool: 'Bash',
                    arguments: { command: 'mkdir ttt' },
                    createdAt: 1000
                }
            }
        });

        expect(nextState.requests).toEqual({});
        expect(nextState.completedRequests?.req1?.status).toBe('canceled');
        expect(nextState.completedRequests?.req1?.completedAt).toBeTypeOf('number');
    });
});
