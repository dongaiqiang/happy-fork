import { describe, expect, it } from 'vitest';
import { normalizeMessageSendFailure } from './messageSendFailure';

describe('normalizeMessageSendFailure', () => {
    it('stops retrying when quota limit is exceeded', () => {
        expect(normalizeMessageSendFailure(429, {
            error: 'quota_limit_exceeded',
            reason: 'daily_limit_exceeded',
            message: '今日额度不足，请升级后继续发送消息'
        }, 'session-1')).toEqual({
            shouldStopRetry: true,
            reasonText: '今日额度不足，请升级后继续发送消息',
            shouldRefreshSessions: false
        });
    });

    it('stops retrying when subscription validity fails', () => {
        expect(normalizeMessageSendFailure(429, {
            error: 'validity_check_failed',
            reason: 'trial_expired',
            message: '7 天试用已到期，请升级后继续发送消息'
        }, 'session-1')).toEqual({
            shouldStopRetry: true,
            reasonText: '7 天试用已到期，请升级后继续发送消息',
            shouldRefreshSessions: false
        });
    });

    it('stops retrying and refreshes sessions when mobile is not the controller', () => {
        expect(normalizeMessageSendFailure(409, {
            error: 'mobile-controller-required',
        }, 'session-1')).toEqual({
            shouldStopRetry: true,
            reasonText: 'This session is currently controlled by Mac. Switch it back to mobile before sending more messages.',
            shouldRefreshSessions: true
        });
    });

    it('stops retrying and refreshes sessions while controller handoff is switching', () => {
        expect(normalizeMessageSendFailure(409, {
            error: 'switching-in-progress',
        }, 'session-1')).toEqual({
            shouldStopRetry: true,
            reasonText: 'This session is currently switching control. Wait a moment and try again.',
            shouldRefreshSessions: true
        });
    });

    it('keeps retryable failures on the backoff path', () => {
        expect(normalizeMessageSendFailure(500, {
            error: 'internal_error'
        }, 'session-1')).toEqual({
            shouldStopRetry: false,
            reasonText: 'Failed to send messages for session-1: 500',
            shouldRefreshSessions: false
        });
    });
});
