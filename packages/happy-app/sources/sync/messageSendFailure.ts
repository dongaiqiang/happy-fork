export type MessageSendFailurePayload = {
    error?: string;
    reason?: string;
    message?: string;
};

export type NormalizedMessageSendFailure = {
    shouldStopRetry: boolean;
    reasonText: string;
    shouldRefreshSessions: boolean;
};

const NON_RETRYABLE_ERRORS = new Set([
    'quota_limit_exceeded',
    'validity_check_failed'
]);

const NON_RETRYABLE_REASONS = new Set([
    'daily_limit_exceeded',
    'monthly_limit_exceeded',
    'trial_expired',
    'subscription_inactive',
    'subscription_expired'
]);

const CONTROL_STATE_FAILURES: Record<string, { reasonText: string; shouldRefreshSessions: boolean }> = {
    'mobile-controller-required': {
        reasonText: 'This session is currently controlled by Mac. Switch it back to mobile before sending more messages.',
        shouldRefreshSessions: true
    },
    'switching-in-progress': {
        reasonText: 'This session is currently switching control. Wait a moment and try again.',
        shouldRefreshSessions: true
    }
};

export function normalizeMessageSendFailure(status: number, payload: MessageSendFailurePayload | null, sessionId: string): NormalizedMessageSendFailure {
    const message = payload?.message?.trim();
    const error = payload?.error?.trim();
    const reason = payload?.reason?.trim();

    if (status === 429 && ((error && NON_RETRYABLE_ERRORS.has(error)) || (reason && NON_RETRYABLE_REASONS.has(reason)))) {
        return {
            shouldStopRetry: true,
            reasonText: message || reason || error || `Failed to send messages for ${sessionId}: ${status}`,
            shouldRefreshSessions: false
        };
    }

    if (status === 409 && error && CONTROL_STATE_FAILURES[error]) {
        return {
            shouldStopRetry: true,
            reasonText: message || CONTROL_STATE_FAILURES[error].reasonText,
            shouldRefreshSessions: CONTROL_STATE_FAILURES[error].shouldRefreshSessions
        };
    }

    return {
        shouldStopRetry: false,
        reasonText: message || `Failed to send messages for ${sessionId}: ${status}`,
        shouldRefreshSessions: false
    };
}
