import * as React from 'react';
import { Modal } from '@/modal';
import { t } from '@/text';
import { HappyError } from '@/utils/errors';
import { useRouter } from 'expo-router';

export function useHappyAction(action: () => Promise<void>) {
    const router = useRouter();
    const [loading, setLoading] = React.useState(false);
    const loadingRef = React.useRef(false);
    const doAction = React.useCallback(() => {
        if (loadingRef.current) {
            return;
        }
        loadingRef.current = true;
        setLoading(true);
        (async () => {
            try {
                while (true) {
                    try {
                        await action();
                        break;
                    } catch (e) {
                        if (e instanceof HappyError) {
                            // 配额超限处理
                            if (e.message === 'daily_limit_exceeded') {
                                Modal.alert(
                                    t('quota.limitExceeded'),
                                    t('quota.dailyLimitExceeded'),
                                    [
                                        { text: t('common.cancel'), style: 'cancel' },
                                        {
                                            text: t('quota.upgrade'),
                                            onPress: () => {
                                                router.push('/settings/usage');
                                            }
                                        }
                                    ]
                                );
                            } else if (e.message === 'monthly_limit_exceeded') {
                                Modal.alert(
                                    t('quota.limitExceeded'),
                                    t('quota.monthlyLimitExceeded'),
                                    [
                                        { text: t('common.cancel'), style: 'cancel' },
                                        {
                                            text: t('quota.upgrade'),
                                            onPress: () => {
                                                router.push('/settings/usage');
                                            }
                                        }
                                    ]
                                );
                            } else if (e.message === 'insufficient_quota') {
                                Modal.alert(
                                    t('quota.insufficientQuota'),
                                    t('quota.insufficientQuotaMessage'),
                                    [
                                        { text: t('common.cancel'), style: 'cancel' },
                                        {
                                            text: t('quota.upgrade'),
                                            onPress: () => {
                                                router.push('/settings/usage');
                                            }
                                        }
                                    ]
                                );
                            } else {
                                Modal.alert(t('common.error'), e.message, [{ text: t('common.ok'), style: 'cancel' }]);
                            }
                            break;
                        } else {
                            Modal.alert(t('common.error'), t('errors.unknownError'), [{ text: t('common.ok'), style: 'cancel' }]);
                            break;
                        }
                    }
                }
            } finally {
                loadingRef.current = false;
                setLoading(false);
            }
        })();
    }, [action, router]);
    return [loading, doAction] as const;
}
