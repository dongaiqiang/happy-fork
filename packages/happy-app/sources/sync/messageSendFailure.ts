export type MessageSendFailurePayload = {
    error?: string;
    reason?: string;
    message?: string;
};

export type NormalizedMessageSendFailure = {
    shouldStopRetry: boolean;
    reasonText: string;
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

export function normalizeMessageSendFailure(status: number, payload: MessageSendFailurePayload | null, sessionId: string): NormalizedMessageSendFailure {
    const message = payload?.message?.trim();
    const error = payload?.error?.trim();
    const reason = payload?.reason?.trim();

    if (status === 429 && ((error && NON_RETRYABLE_ERRORS.has(error)) || (reason && NON_RETRYABLE_REASONS.has(reason)))) {
        return {
            shouldStopRetry: true,
            reasonText: message || reason || error || `Failed to send messages for ${sessionId}: ${status}`
        };
    }

    return {
        shouldStopRetry: false,
        reasonText: message || `Failed to send messages for ${sessionId}: ${status}`
    };
}
