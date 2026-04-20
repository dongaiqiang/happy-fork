import { describe, expect, it } from 'vitest';

import { isSessionHandoffSwitching, isSessionReadOnlyOnMobile } from './sessionControlUtils';

describe('sessionControlUtils', () => {
    it('detects switching from session-shaped or control-state-shaped objects', () => {
        expect(isSessionHandoffSwitching({ handoffState: 'switching' })).toBe(true);
        expect(isSessionHandoffSwitching({ handoffState: 'idle' })).toBe(false);
        expect(isSessionHandoffSwitching(undefined)).toBe(false);
        expect(isSessionHandoffSwitching(null)).toBe(false);
    });

    it('treats switching sessions as mobile read-only', () => {
        expect(isSessionReadOnlyOnMobile({
            controller: 'mobile',
            handoffState: 'switching'
        })).toBe(true);
    });

    it('treats mac-controlled idle sessions as mobile read-only', () => {
        expect(isSessionReadOnlyOnMobile({
            controller: 'mac',
            handoffState: 'idle'
        })).toBe(true);
    });

    it('keeps mobile writable when handoff is idle on mobile or failed on mac', () => {
        expect(isSessionReadOnlyOnMobile({
            controller: 'mobile',
            handoffState: 'idle'
        })).toBe(false);

        expect(isSessionReadOnlyOnMobile({
            controller: 'mac',
            handoffState: 'failed'
        })).toBe(false);
    });
});
