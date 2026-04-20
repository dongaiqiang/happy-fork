import type { SessionControlState } from '@/sync/ops';
import type { Session } from '@/sync/storageTypes';

export function isSessionHandoffSwitching(state?: Pick<Session, 'handoffState'> | Pick<SessionControlState, 'handoffState'> | null): boolean {
    return state?.handoffState === 'switching';
}

export function isSessionReadOnlyOnMobile(session: Pick<Session, 'controller' | 'handoffState'>): boolean {
    return isSessionHandoffSwitching(session) || (session.controller === 'mac' && session.handoffState === 'idle');
}
