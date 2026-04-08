import * as React from 'react';
import { View, Text, TextInput } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Typography } from '@/constants/Typography';
import { Item } from '@/components/Item';
import { ItemGroup } from '@/components/ItemGroup';
import { ItemList } from '@/components/ItemList';
import { Modal } from '@/modal';
import { getServerUrl } from '@/sync/serverConfig';
import { storage } from '@/sync/storage';
import {
    AdminBillingPeriod,
    AdminQuotaOpsError,
    AdminQuotaTier,
    AdminResetScope,
    AdminAccountQuotaResponse,
    queryAdminAccountQuota,
    resetAdminUsage,
    upgradeAdminAccount,
} from '@/sync/apiAdminQuotaOps';

const stylesheet = StyleSheet.create((theme) => ({
    inputWrapper: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: theme.colors.surface,
    },
    inputLabel: {
        ...Typography.default('semiBold'),
        fontSize: 13,
        color: theme.colors.textSecondary,
        marginBottom: 8,
    },
    input: {
        ...Typography.default(),
        backgroundColor: theme.colors.input.background,
        color: theme.colors.input.text,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: 16,
    },
    helperText: {
        ...Typography.default(),
        fontSize: 13,
        color: theme.colors.textSecondary,
        marginTop: 8,
    },
}));

export default function QuotaOpsDevScreen() {
    const { theme } = useUnistyles();
    const currentAccountId = storage((state) => state.profile.id);
    const [adminToken, setAdminToken] = React.useState('');
    const [accountId, setAccountId] = React.useState('');
    const [username, setUsername] = React.useState('');
    const [billingPeriod, setBillingPeriod] = React.useState<AdminBillingPeriod>('monthly');
    const [snapshot, setSnapshot] = React.useState<AdminAccountQuotaResponse | null>(null);
    const [busyAction, setBusyAction] = React.useState<string | null>(null);
    const [lastOperationTitle, setLastOperationTitle] = React.useState('No action yet');
    const [lastOperationDetail, setLastOperationDetail] = React.useState('Enter an ADMIN_TOKEN and target account, then query the current snapshot.');

    React.useEffect(() => {
        if (currentAccountId && !accountId && !username) {
            setAccountId(currentAccountId);
        }
    }, [currentAccountId, accountId, username]);

    const setResult = React.useCallback((title: string, detail: string) => {
        setLastOperationTitle(title);
        setLastOperationDetail(detail);
    }, []);

    const buildTarget = React.useCallback(() => {
        const trimmedAccountId = accountId.trim();
        const trimmedUsername = username.trim();

        if (!trimmedAccountId && !trimmedUsername) {
            throw new Error('Please enter account ID or username.');
        }

        return {
            accountId: trimmedAccountId || undefined,
            username: trimmedUsername || undefined,
        };
    }, [accountId, username]);

    const requireAdminToken = React.useCallback(() => {
        const trimmedToken = adminToken.trim();
        if (!trimmedToken) {
            throw new Error('Please enter ADMIN_TOKEN.');
        }
        return trimmedToken;
    }, [adminToken]);

    const loadSnapshot = React.useCallback(async (showSuccessAlert = true) => {
        setBusyAction('query');
        try {
            const result = await queryAdminAccountQuota({
                adminToken: requireAdminToken(),
                ...buildTarget(),
            });
            setSnapshot(result);
            setResult(
                'Snapshot loaded',
                [
                    `Account: ${formatAccountLabel(result.account.id, result.account.username)}`,
                    `Tier: ${result.subscription.tier}`,
                    `Daily: ${formatUsage(result.quota.dailyUsed, result.quota.dailyLimit)}`,
                    `Monthly: ${formatUsage(result.quota.monthlyUsed, result.quota.monthlyLimit)}`,
                ].join('\n'),
            );

            if (showSuccessAlert) {
                Modal.alert('Snapshot loaded', `Loaded ${formatAccountLabel(result.account.id, result.account.username)}.`);
            }

            return result;
        } catch (error) {
            const message = formatAdminOpsError(error);
            setResult('Snapshot failed', message);
            Modal.alert('Query failed', message);
            return null;
        } finally {
            setBusyAction(null);
        }
    }, [buildTarget, requireAdminToken, setResult]);

    const applyUpgrade = React.useCallback(async (tier: AdminQuotaTier) => {
        try {
            const target = buildTarget();
            const token = requireAdminToken();
            const confirmed = await Modal.confirm(
                'Apply upgrade',
                tier === 'free'
                    ? `Set ${formatTargetLabel(target.accountId, target.username)} to free?`
                    : `Set ${formatTargetLabel(target.accountId, target.username)} to ${tier} (${billingPeriod})?`,
                {
                    confirmText: 'Apply',
                    destructive: tier === 'free',
                },
            );

            if (!confirmed) {
                return;
            }

            setBusyAction(`upgrade-${tier}`);
            const result = await upgradeAdminAccount({
                adminToken: token,
                ...target,
                tier,
                ...(tier === 'free' ? {} : { billingPeriod }),
            });

            const refreshed = await queryAdminAccountQuota({
                adminToken: token,
                ...target,
            }).catch(() => null);

            if (refreshed) {
                setSnapshot(refreshed);
            }

            setResult(
                'Upgrade applied',
                [
                    `Account: ${formatAccountLabel(result.account.id, result.account.username)}`,
                    `Tier: ${result.subscription.tier}`,
                    `Status: ${result.subscription.status}`,
                    `End date: ${formatDate(result.subscription.endDate)}`,
                    refreshed ? `Snapshot refreshed: ${formatUsage(refreshed.quota.dailyUsed, refreshed.quota.dailyLimit)} daily` : 'Snapshot refresh skipped',
                ].join('\n'),
            );

            Modal.alert(
                'Upgrade applied',
                `${formatAccountLabel(result.account.id, result.account.username)} is now ${result.subscription.tier}.`,
            );
        } catch (error) {
            const message = formatAdminOpsError(error);
            setResult('Upgrade failed', message);
            Modal.alert('Upgrade failed', message);
        } finally {
            setBusyAction(null);
        }
    }, [billingPeriod, buildTarget, requireAdminToken, setResult]);

    const applyReset = React.useCallback(async (scope: AdminResetScope) => {
        try {
            const target = buildTarget();
            const token = requireAdminToken();
            const confirmed = await Modal.confirm(
                'Reset usage',
                `Reset ${scope} usage for ${formatTargetLabel(target.accountId, target.username)}?`,
                {
                    confirmText: 'Reset',
                    destructive: true,
                },
            );

            if (!confirmed) {
                return;
            }

            setBusyAction(`reset-${scope}`);
            const result = await resetAdminUsage({
                adminToken: token,
                ...target,
                scope,
            });

            const refreshed = await queryAdminAccountQuota({
                adminToken: token,
                ...target,
            }).catch(() => null);

            if (refreshed) {
                setSnapshot(refreshed);
            }

            setResult(
                'Usage reset applied',
                [
                    `Account: ${formatAccountLabel(result.account.id, result.account.username)}`,
                    `Scope: ${result.reset.scope}`,
                    `Rows cleared: ${result.reset.clearedUsageRows.toString()}`,
                    `Tokens cleared: ${result.reset.clearedTokens.toLocaleString()}`,
                    refreshed ? `Snapshot refreshed: ${formatUsage(refreshed.quota.dailyUsed, refreshed.quota.dailyLimit)} daily` : 'Snapshot refresh skipped',
                ].join('\n'),
            );

            Modal.alert(
                'Usage reset applied',
                `Cleared ${result.reset.clearedUsageRows} row(s) for ${formatAccountLabel(result.account.id, result.account.username)}.`,
            );
        } catch (error) {
            const message = formatAdminOpsError(error);
            setResult('Usage reset failed', message);
            Modal.alert('Usage reset failed', message);
        } finally {
            setBusyAction(null);
        }
    }, [buildTarget, requireAdminToken, setResult]);

    return (
        <>
            <Stack.Screen
                options={{
                    title: 'Quota Ops',
                    headerShown: true,
                }}
            />

            <ItemList>
                <ItemGroup
                    title="Context"
                    footer="ADMIN_TOKEN is entered only for the current session. When both account ID and username are filled, account ID is used first."
                >
                    <Item
                        title="API Endpoint"
                        detail={getServerUrl()}
                        showChevron={false}
                    />
                    <Item
                        title="Signed-in Account ID"
                        detail={currentAccountId || 'Unavailable'}
                        showChevron={false}
                        copy={Boolean(currentAccountId)}
                    />
                    <Item
                        title="Use Signed-in Account ID"
                        subtitle="Copy the current app account into the target field"
                        icon={<Ionicons name="person-circle-outline" size={28} color="#007AFF" />}
                        onPress={() => {
                            if (!currentAccountId) {
                                Modal.alert('Unavailable', 'The current signed-in account ID is not available yet.');
                                return;
                            }
                            setAccountId(currentAccountId);
                            setUsername('');
                            setResult('Target updated', `Target account ID set to ${currentAccountId}.`);
                        }}
                    />
                    <InputBlock
                        label="ADMIN_TOKEN"
                        value={adminToken}
                        onChangeText={setAdminToken}
                        placeholder="Paste ADMIN_TOKEN"
                        secureTextEntry={true}
                        helperText="This page sends admin-only requests with the x-admin-token header."
                        theme={theme}
                    />
                    <InputBlock
                        label="Target Account ID"
                        value={accountId}
                        onChangeText={setAccountId}
                        placeholder="cmxxxxxxxx"
                        theme={theme}
                    />
                    <InputBlock
                        label="Target Username"
                        value={username}
                        onChangeText={setUsername}
                        placeholder="alice"
                        theme={theme}
                    />
                </ItemGroup>

                <ItemGroup
                    title="Snapshot"
                    footer="Query first, then use upgrade or reset actions, then query again to verify the latest quota state."
                >
                    <Item
                        title={busyAction === 'query' ? 'Loading Snapshot...' : 'Query Account Snapshot'}
                        subtitle="Loads account, subscription, and quota state from /admin/account-quota"
                        icon={busyAction === 'query'
                            ? <Ionicons name="hourglass-outline" size={28} color="#007AFF" />
                            : <Ionicons name="search-outline" size={28} color="#007AFF" />}
                        onPress={() => {
                            void loadSnapshot(true);
                        }}
                        loading={busyAction === 'query'}
                    />

                    {snapshot ? (
                        <>
                            <Item title="Account" detail={formatAccountLabel(snapshot.account.id, snapshot.account.username)} showChevron={false} copy={snapshot.account.id} />
                            <Item title="Subscription Tier" detail={snapshot.subscription.tier} showChevron={false} />
                            <Item title="Subscription Status" detail={snapshot.subscription.status} showChevron={false} />
                            <Item title="Start Date" detail={formatDate(snapshot.subscription.startDate)} showChevron={false} />
                            <Item title="End Date" detail={formatDate(snapshot.subscription.endDate)} showChevron={false} />
                            <Item title="Daily Usage" detail={formatUsage(snapshot.quota.dailyUsed, snapshot.quota.dailyLimit)} showChevron={false} />
                            <Item title="Daily Remaining" detail={snapshot.quota.dailyRemaining.toLocaleString()} showChevron={false} />
                            <Item title="Monthly Usage" detail={formatUsage(snapshot.quota.monthlyUsed, snapshot.quota.monthlyLimit)} showChevron={false} />
                            <Item title="Monthly Remaining" detail={snapshot.quota.monthlyRemaining.toLocaleString()} showChevron={false} />
                            <Item title="Rate Limit" detail={`${snapshot.quota.rateLimit}/minute`} showChevron={false} />
                            <Item title="Storage Limit" detail={snapshot.quota.storageLimit} showChevron={false} />
                        </>
                    ) : (
                        <Item
                            title="No snapshot loaded"
                            subtitle="Run the query action above after entering an admin token and target account."
                            icon={<Ionicons name="information-circle-outline" size={28} color="#8E8E93" />}
                            showChevron={false}
                        />
                    )}
                </ItemGroup>

                <ItemGroup
                    title="Upgrade Actions"
                    footer="This section only consumes the existing /admin/upgrade baseline. Billing period applies to non-free tiers."
                >
                    <Item
                        title="Billing Period"
                        detail={billingPeriod}
                        subtitle="Tap to switch between monthly and annual"
                        icon={<Ionicons name="calendar-outline" size={28} color="#007AFF" />}
                        onPress={() => {
                            setBillingPeriod((value) => value === 'monthly' ? 'annual' : 'monthly');
                        }}
                    />
                    {(['student', 'pro', 'team', 'enterprise', 'free'] as const).map((tier) => (
                        <Item
                            key={tier}
                            title={`Set ${tier}`}
                            subtitle={tier === 'free' ? 'Remove subscription and fall back to free quota' : `Apply ${tier} with ${billingPeriod} billing`}
                            icon={<Ionicons name={tier === 'free' ? 'arrow-down-circle-outline' : 'rocket-outline'} size={28} color={tier === 'free' ? '#FF9500' : '#34C759'} />}
                            onPress={() => {
                                void applyUpgrade(tier);
                            }}
                            loading={busyAction === `upgrade-${tier}`}
                            destructive={tier === 'free'}
                        />
                    ))}
                </ItemGroup>

                <ItemGroup
                    title="Reset Usage"
                    footer="This section only consumes the existing /admin/quota/reset-usage baseline. Current reset facts still only clear DailyUsage."
                >
                    {([
                        {
                            scope: 'daily' as const,
                            title: 'Reset Daily Usage',
                            subtitle: 'Clear only today’s usage rows',
                        },
                        {
                            scope: 'monthly' as const,
                            title: 'Reset Monthly Usage',
                            subtitle: 'Clear current-month usage rows',
                        },
                        {
                            scope: 'all' as const,
                            title: 'Reset All Usage',
                            subtitle: 'Clear all DailyUsage rows for the target account',
                        },
                    ]).map((item) => (
                        <Item
                            key={item.scope}
                            title={item.title}
                            subtitle={item.subtitle}
                            icon={<Ionicons name="refresh-circle-outline" size={28} color="#FF3B30" />}
                            onPress={() => {
                                void applyReset(item.scope);
                            }}
                            loading={busyAction === `reset-${item.scope}`}
                            destructive={true}
                        />
                    ))}
                </ItemGroup>

                <ItemGroup title="Latest Result">
                    <Item
                        title={lastOperationTitle}
                        subtitle={lastOperationDetail}
                        subtitleLines={0}
                        icon={<Ionicons name="document-text-outline" size={28} color="#007AFF" />}
                        showChevron={false}
                    />
                </ItemGroup>
            </ItemList>
        </>
    );
}

function InputBlock(props: {
    label: string;
    value: string;
    onChangeText: (value: string) => void;
    placeholder: string;
    helperText?: string;
    secureTextEntry?: boolean;
    theme: { colors: { input: { placeholder: string } } };
}) {
    const styles = stylesheet;

    return (
        <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>{props.label}</Text>
            <TextInput
                value={props.value}
                onChangeText={props.onChangeText}
                placeholder={props.placeholder}
                placeholderTextColor={props.theme.colors.input.placeholder}
                secureTextEntry={props.secureTextEntry}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
            />
            {props.helperText ? (
                <Text style={styles.helperText}>{props.helperText}</Text>
            ) : null}
        </View>
    );
}

function formatAccountLabel(accountId: string, username: string | null) {
    return username ? `${username} (${accountId})` : accountId;
}

function formatTargetLabel(accountId?: string, username?: string) {
    if (accountId && username) {
        return `${accountId} / ${username}`;
    }
    return accountId || username || 'unknown target';
}

function formatUsage(used: number, limit: number) {
    return `${used.toLocaleString()} / ${limit.toLocaleString()}`;
}

function formatDate(value: string | null | undefined) {
    if (!value) {
        return '—';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString();
}

function formatAdminOpsError(error: unknown) {
    if (error instanceof AdminQuotaOpsError) {
        return error.errorCode ? `${error.message} (${error.errorCode}, ${error.status})` : `${error.message} (${error.status})`;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return 'Unknown error';
}
