import React, { useCallback } from 'react';
import { View, Text, Animated } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@/constants/Typography';
import { Item } from '@/components/Item';
import { ItemGroup } from '@/components/ItemGroup';
import { ItemList } from '@/components/ItemList';
import { Avatar } from '@/components/Avatar';
import { storage, useSession, useIsDataReady, useMachine, useAllMachines } from '@/sync/storage';
import { getSessionName, useSessionStatus, formatOSPlatform, formatPathRelativeToHome, getSessionAvatarId } from '@/utils/sessionUtils';
import * as Clipboard from 'expo-clipboard';
import { Modal } from '@/modal';
import { machineSpawnNewSession, sessionKill, sessionStop, sessionDelete, sessionGetControlState, sessionHandoffToMac, sessionSwitch, sessionSwitchController, type SessionControlState } from '@/sync/ops';
import { useUnistyles } from 'react-native-unistyles';
import { layout } from '@/components/layout';
import { t } from '@/text';
import { isVersionSupported, MINIMUM_CLI_VERSION } from '@/utils/versionUtils';
import { CodeView } from '@/components/CodeView';
import { Session } from '@/sync/storageTypes';
import { useHappyAction } from '@/hooks/useHappyAction';
import { HappyError } from '@/utils/errors';
import { isMachineOnline } from '@/utils/machineUtils';
import { sync } from '@/sync/sync';

// Animated status dot component
function StatusDot({ color, isPulsing, size = 8 }: { color: string; isPulsing?: boolean; size?: number }) {
    const pulseAnim = React.useRef(new Animated.Value(1)).current;

    React.useEffect(() => {
        if (isPulsing) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 0.3,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [isPulsing, pulseAnim]);

    return (
        <Animated.View
            style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: color,
                opacity: pulseAnim,
                marginRight: 4,
            }}
        />
    );
}

function formatSandboxMetadata(sandbox: unknown, homeDir?: string): string {
    if (sandbox === null || sandbox === undefined) {
        return t('sessionInfo.disabled');
    }


function normalizeOpenInMacReason(reason: string): string {
    const normalized = reason.trim().toLowerCase();
    if (normalized === 'not found' || normalized.includes('no conversation found')) {
        return 'claude-session-not-found';
    }
    return reason;
}

function buildOpenInMacErrorMessage(reason: string, claudeSessionId: string, directory: string): string {
    const normalizedReason = normalizeOpenInMacReason(reason);
    if (normalizedReason === 'open-in-mac-route-not-found') {
        return t('sessionInfo.openOnMacRouteMissing', { claudeSessionId, directory });
    }
    const reasonHint = normalizedReason.includes('claude-session-not-found')
        ? t('sessionInfo.openOnMacAuthHint')
        : undefined;
    return t('sessionInfo.openOnMacFailedWithReason', {
        reason: normalizedReason,
        claudeSessionId,
        directory,
        hint: reasonHint
    });
}

    if (typeof sandbox === 'string') {
        return sandbox;
    }

    if (typeof sandbox !== 'object') {
        return String(sandbox);
    }

    const value = sandbox as Record<string, unknown>;
    if (value.enabled === false) {
        return t('sessionInfo.disabled');
    }

    const parts: string[] = [t('sessionInfo.enabled')];
    const isolation = typeof value.sessionIsolation === 'string' ? value.sessionIsolation : undefined;
    const networkMode = typeof value.networkMode === 'string' ? value.networkMode : undefined;
    const workspaceRoot = typeof value.workspaceRoot === 'string' ? value.workspaceRoot : undefined;

    if (isolation) {
        parts.push(t('sessionInfo.sandboxIsolation', { value: isolation }));
    }
    if (networkMode) {
        parts.push(t('sessionInfo.sandboxNetwork', { value: networkMode }));
    }
    if (workspaceRoot) {
        parts.push(t('sessionInfo.sandboxWorkspace', { value: formatPathRelativeToHome(workspaceRoot, homeDir) }));
    }

    return parts.join(' | ');
}

function formatDangerouslySkipPermissionsMetadata(
    value: unknown,
    flavor: string | null | undefined,
    permissionMode: Session['permissionMode'],
    sandbox: unknown,
): string {
    if (typeof value === 'boolean') {
        return value ? t('sessionInfo.enabled') : t('sessionInfo.disabled');
    }

    if (permissionMode === 'bypassPermissions' || permissionMode === 'yolo') {
        return t('sessionInfo.enabled');
    }

    if (flavor === 'claude' && sandbox && typeof sandbox === 'object') {
        const sandboxValue = sandbox as Record<string, unknown>;
        if (sandboxValue.enabled === true) {
            return t('sessionInfo.enabled');
        }
    }

    return t('status.unknown');
}

function normalizeOpenInMacReason(reason: string): string {
    const normalized = reason.trim().toLowerCase();
    if (normalized === 'not found' || normalized.includes('no conversation found')) {
        return 'claude-session-not-found';
    }
    return reason;
}

function buildOpenInMacErrorMessage(reason: string, claudeSessionId: string, directory: string): string {
    const normalizedReason = normalizeOpenInMacReason(reason);
    if (normalizedReason === 'open-in-mac-route-not-found') {
        return t('sessionInfo.openOnMacRouteMissing', { claudeSessionId, directory });
    }
    const reasonHint = normalizedReason.includes('claude-session-not-found')
        ? t('sessionInfo.openOnMacAuthHint')
        : undefined;
    return t('sessionInfo.openOnMacFailedWithReason', {
        reason: normalizedReason,
        claudeSessionId,
        directory,
        hint: reasonHint
    });
}

function SessionInfoContent({ session }: { session: Session }) {
    const { theme } = useUnistyles();
    const router = useRouter();
    const devModeEnabled = __DEV__;
    const sessionName = getSessionName(session);
    const sessionStatus = useSessionStatus(session);
    const machine = useMachine(session.metadata?.machineId ?? '');
    const allMachines = useAllMachines();
    
    // Check if CLI version is outdated
    const isCliOutdated = session.metadata?.version && !isVersionSupported(session.metadata.version, MINIMUM_CLI_VERSION);
    const [controlState, setControlState] = React.useState<SessionControlState | null>(null);

    const refreshControlState = useCallback(async () => {
        const result = await sessionGetControlState(session.id);
        if (result.success && result.state) {
            setControlState(result.state);
        }
    }, [session.id]);

    React.useEffect(() => {
        void refreshControlState();
    }, [refreshControlState]);
    const effectiveControlState: SessionControlState | null = session.controllerLeaseVersion !== undefined ? {
        sessionId: session.id,
        controller: session.controller ?? 'mobile',
        leaseVersion: session.controllerLeaseVersion ?? 0,
        handoffState: session.handoffState ?? 'idle',
        handoffReason: session.handoffReason ?? null,
        controllerUpdatedAt: session.controllerUpdatedAt ?? session.updatedAt
    } : controlState;

    const handleCopySessionId = useCallback(async () => {
        if (!session) return;
        try {
            await Clipboard.setStringAsync(session.id);
            Modal.alert(t('common.success'), t('sessionInfo.happySessionIdCopied'));
        } catch (error) {
            Modal.alert(t('common.error'), t('sessionInfo.failedToCopySessionId'));
        }
    }, [session]);

    const handleCopyMetadata = useCallback(async () => {
        if (!session?.metadata) return;
        try {
            await Clipboard.setStringAsync(JSON.stringify(session.metadata, null, 2));
            Modal.alert(t('common.success'), t('sessionInfo.metadataCopied'));
        } catch (error) {
            Modal.alert(t('common.error'), t('sessionInfo.failedToCopyMetadata'));
        }
    }, [session]);

    // Use HappyAction for archiving - it handles errors automatically
    const [archivingSession, performArchive] = useHappyAction(async () => {
        const result = await sessionKill(session.id);
        if (!result.success) {
            throw new HappyError(result.message || t('sessionInfo.failedToArchiveSession'), false);
        }
        // Success - navigate back
        router.back();
        router.back();
    });

    const handleArchiveSession = useCallback(() => {
        Modal.alert(
            t('sessionInfo.archiveSession'),
            t('sessionInfo.archiveSessionConfirm'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('sessionInfo.archiveSession'),
                    style: 'destructive',
                    onPress: performArchive
                }
            ]
        );
    }, [performArchive]);

    const [stoppingSession, performStop] = useHappyAction(async () => {
        const result = await sessionStop(session.id);
        if (!result.success) {
            throw new HappyError(result.message || t('sessionInfo.failedToStopSession'), false);
        }
        router.back();
        router.back();
    });

    const handleStopSession = useCallback(() => {
        Modal.alert(
            t('sessionInfo.stopSession'),
            t('sessionInfo.stopSessionConfirm'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('sessionInfo.stopSession'),
                    style: 'destructive',
                    onPress: performStop
                }
            ]
        );
    }, [performStop]);

    // Use HappyAction for deletion - it handles errors automatically
    const [deletingSession, performDelete] = useHappyAction(async () => {
        const result = await sessionDelete(session.id);
        if (!result.success) {
            throw new HappyError(result.message || t('sessionInfo.failedToDeleteSession'), false);
        }
        // Success - no alert needed, UI will update to show deleted state
    });

    const handleDeleteSession = useCallback(() => {
        Modal.alert(
            t('sessionInfo.deleteSession'),
            t('sessionInfo.deleteSessionWarning'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('sessionInfo.deleteSession'),
                    style: 'destructive',
                    onPress: performDelete
                }
            ]
        );
    }, [performDelete]);

    const getCandidateMachineIds = useCallback(async () => {
        const machineId = session.metadata?.machineId;
        const directory = session.metadata?.path;
        const sessionHost = session.metadata?.host;
        const sessionHomeDir = session.metadata?.homeDir;

        if (!machineId || !directory) {
            return [];
        }

        await sync.refreshMachines();
        const latestMachines = Object.values(storage.getState().machines);
        const visibleMachines = latestMachines.length > 0 ? latestMachines : allMachines;
        const onlineMachinesWithEncryption = visibleMachines.filter((candidate) => (
            isMachineOnline(candidate) && !!sync.encryption.getMachineEncryption(candidate.id)
        ));
        const exactMachineMatch = onlineMachinesWithEncryption.filter((candidate) => candidate.id === machineId);
        const hostMatchedMachines = onlineMachinesWithEncryption.filter((candidate) => (
            !!sessionHost && candidate.metadata?.host === sessionHost
        ));
        const homeDirMatchedMachines = onlineMachinesWithEncryption.filter((candidate) => (
            !!sessionHomeDir && candidate.metadata?.homeDir === sessionHomeDir
        ));
        const pathMatchedMachines = onlineMachinesWithEncryption.filter((candidate) => (
            !!candidate.metadata?.homeDir && directory.startsWith(candidate.metadata.homeDir)
        ));

        return Array.from(new Set([
            ...exactMachineMatch.map((candidate) => candidate.id),
            ...hostMatchedMachines.map((candidate) => candidate.id),
            ...homeDirMatchedMachines.map((candidate) => candidate.id),
            ...pathMatchedMachines.map((candidate) => candidate.id),
            ...onlineMachinesWithEncryption.map((candidate) => candidate.id),
            sync.encryption.getMachineEncryption(machineId) ? machineId : null
        ].filter((value): value is string => !!value)));
    }, [allMachines, session.metadata?.homeDir, session.metadata?.host, session.metadata?.machineId, session.metadata?.path]);

    const resumeSession = useCallback(async (approvedNewDirectoryCreation: boolean = false) => {
        const machineId = session.metadata?.machineId;
        const directory = session.metadata?.path;
        const claudeSessionId = session.metadata?.claudeSessionId;
        if (!machineId || !directory || !claudeSessionId) {
            Modal.alert(t('common.error'), t('sessionInfo.resumeMissingMetadata'));
            return;
        }
        const candidateMachineIds = await getCandidateMachineIds();

        if (candidateMachineIds.length === 0) {
            Modal.alert(t('common.error'), t('sessionInfo.resumeNoAvailableMachine', { machineId }));
            return;
        }

        let lastErrorMessage = '';
        for (const candidateMachineId of candidateMachineIds) {
            let allowDirectoryCreation = approvedNewDirectoryCreation;
            while (true) {
                const result = await machineSpawnNewSession({
                    machineId: candidateMachineId,
                    directory,
                    sessionId: claudeSessionId,
                    openTerminal: false,
                    terminalCarrierMode: 'hosted',
                    approvedNewDirectoryCreation: allowDirectoryCreation,
                    agent: 'claude'
                });
                switch (result.type) {
                    case 'success':
                        router.push(`/session/${result.sessionId}`);
                        return;
                    case 'requestToApproveDirectoryCreation': {
                        const approved = await Modal.confirm(
                            t('sessionInfo.createDirectoryTitle'),
                            t('sessionInfo.createDirectoryMessage', { directory: result.directory }),
                            { cancelText: t('common.cancel'), confirmText: t('common.create') }
                        );
                        if (!approved) {
                            return;
                        }
                        allowDirectoryCreation = true;
                        continue;
                    }
                    case 'error':
                        lastErrorMessage = result.errorMessage;
                        break;
                }
                break;
            }
        }
        if (lastErrorMessage === 'RPC method not available') {
            Modal.alert(t('common.error'), t('sessionInfo.resumeRpcUnavailable'));
            return;
        }
        Modal.alert(t('common.error'), lastErrorMessage || t('sessionInfo.resumeMachineOffline'));
    }, [getCandidateMachineIds, machine, router, session.metadata?.claudeSessionId, session.metadata?.machineId, session.metadata?.path]);

    const isResumeCapableSession = (!!session.metadata?.machineId)
        && (!!session.metadata?.path)
        && (!!session.metadata?.claudeSessionId)
        && ((session.metadata?.flavor ?? 'claude') === 'claude');

    const canResumeSession = !sessionStatus.isConnected
        && !session.active
        && isResumeCapableSession;
    const canOpenInMac = isResumeCapableSession;
    const hasTmuxOpenInMacSupport = session.metadata?.terminalCarrier === 'tmux' && !!session.metadata?.tmuxSessionId;
    const openInMacResumeCommand = session.metadata?.claudeSessionId
        ? `claude resume ${session.metadata.claudeSessionId}`
        : 'claude resume <claude-session-id>';
    const openInMacDebugDetails = [
        `machineId: ${session.metadata?.machineId || '(missing)'}`,
        `claudeSessionId: ${session.metadata?.claudeSessionId || '(missing)'}`,
        `terminalCarrier: ${session.metadata?.terminalCarrier || '(missing)'}`,
        `tmuxSessionId: ${session.metadata?.tmuxSessionId || '(missing)'}`,
        `path: ${session.metadata?.path || '(missing)'}`,
        `active: ${session.active ? 'true' : 'false'}`,
        `connected: ${sessionStatus.isConnected ? 'true' : 'false'}`,
        `controller: ${effectiveControlState?.controller || '(unknown)'}`,
        `handoffState: ${effectiveControlState?.handoffState || '(unknown)'}`
    ].join('\n');
    const isSwitchingControl = effectiveControlState?.handoffState === 'switching';
    const isMacController = effectiveControlState?.controller === 'mac' && effectiveControlState?.handoffState === 'idle';
    const canSwitchControlToMac = canOpenInMac && hasTmuxOpenInMacSupport && !isSwitchingControl && !isMacController;
    const canSwitchControlToMobile = !isSwitchingControl && isMacController;

    const [handingOffToMac, performHandoffToMac] = useHappyAction(async () => {
        const machineId = session.metadata?.machineId;
        const directory = session.metadata?.path;
        const claudeSessionId = session.metadata?.claudeSessionId;
        const syncToResumedSession = async (resumedHappySessionId?: string) => {
            await sync.refreshSessions();
            await refreshControlState();
            if (resumedHappySessionId && resumedHappySessionId !== session.id) {
                router.replace(`/session/${resumedHappySessionId}`);
            }
        };
        if (!machineId || !directory || !claudeSessionId) {
            throw new HappyError(t('sessionInfo.openOnMacMissingMetadata'), false);
        }
        const candidateMachineIds = await getCandidateMachineIds();
        if (candidateMachineIds.length === 0) {
            throw new HappyError(t('sessionInfo.openOnMacNoAvailableMachine', { machineId }), false);
        }

        let result: Awaited<ReturnType<typeof sessionHandoffToMac>> | null = null;
        let attemptedMachineId = machineId;
        for (const candidateMachineId of candidateMachineIds) {
            attemptedMachineId = candidateMachineId;
            result = await sessionHandoffToMac({
                sessionId: session.id,
                machineId: candidateMachineId,
                directory,
                claudeSessionId,
                tmuxSessionId: session.metadata?.tmuxSessionId ?? undefined,
                expectedLeaseVersion: effectiveControlState?.leaseVersion ?? 0,
                openTerminal: true,
                terminalCarrierMode: 'hosted'
            });
            const reason = result.message || result.error || 'handoff-failed';
            if (result.success || (!reason.includes('machine-offline-or-missing-key') && !reason.includes('machine-rpc-unavailable'))) {
                break;
            }
        }

        if (!result || !result.success) {
            const reason = result?.message || result?.error || 'handoff-failed';
            const shouldUseDirectRpcFallback = reason.includes('machine-rpc-unavailable')
                || reason.includes('machine-offline-or-missing-key')
                || reason.includes('Invalid key length');
            if (shouldUseDirectRpcFallback) {
                let spawnResult = await machineSpawnNewSession({
                    machineId: attemptedMachineId,
                    directory,
                    sessionId: claudeSessionId,
                    happySessionId: session.id,
                    tmuxSessionId: session.metadata?.tmuxSessionId ?? undefined,
                    openTerminal: true,
                    terminalCarrierMode: 'hosted',
                    approvedNewDirectoryCreation: false,
                    agent: 'claude'
                });
                if (spawnResult.type === 'requestToApproveDirectoryCreation') {
                    spawnResult = await machineSpawnNewSession({
                        machineId: attemptedMachineId,
                        directory,
                        sessionId: claudeSessionId,
                        happySessionId: session.id,
                        tmuxSessionId: session.metadata?.tmuxSessionId ?? undefined,
                        openTerminal: true,
                        terminalCarrierMode: 'hosted',
                        approvedNewDirectoryCreation: true,
                        agent: 'claude'
                    });
                }
                if (spawnResult.type !== 'success') {
                    const fallbackReason = spawnResult.type === 'error'
                        ? spawnResult.errorMessage
                        : 'directory-approval-required';
                    throw new HappyError(
                        buildOpenInMacErrorMessage(fallbackReason || reason, claudeSessionId, directory),
                        false
                    );
                }
                await syncToResumedSession(spawnResult.sessionId);
                const switchedController = await sessionSwitchController({
                    sessionId: spawnResult.sessionId ?? session.id,
                    targetController: 'mac',
                    expectedLeaseVersion: effectiveControlState?.leaseVersion ?? 0
                });
                if (!switchedController.success) {
                    throw new HappyError(switchedController.message || switchedController.error || 'controller-switch-failed', false);
                }
                await refreshControlState();
                Modal.alert(t('common.success'), spawnResult.sessionId && spawnResult.sessionId !== session.id
                    ? t('sessionInfo.openOnMacSuccessNewSession')
                    : t('sessionInfo.openOnMacSuccessSameSession'));
                return;
            }
            throw new HappyError(
                buildOpenInMacErrorMessage(reason, claudeSessionId, directory),
                false
            );
        }
        await syncToResumedSession(result.resumedHappySessionId);
        Modal.alert(t('common.success'), result.resumedHappySessionId && result.resumedHappySessionId !== session.id
            ? t('sessionInfo.openOnMacSuccessNewSession')
            : t('sessionInfo.openOnMacSuccessSameSession'));
    });

    const switchController = useCallback(async (targetController: 'mobile' | 'mac') => {
        const expectedLeaseVersion = effectiveControlState?.leaseVersion ?? 0;

        if (targetController === 'mac') {
            const switched = await sessionSwitch(session.id, 'local');
            if (!switched) {
                throw new HappyError(t('sessionInfo.switchControlToMacFailed'), false);
            }
        } else {
            const switched = await sessionSwitch(session.id, 'remote');
            if (!switched) {
                throw new HappyError(t('sessionInfo.switchControlToMobileFailed'), false);
            }
        }

        const result = await sessionSwitchController({
            sessionId: session.id,
            targetController,
            expectedLeaseVersion
        });
        if (!result.success) {
            throw new HappyError(result.message || result.error || 'controller-switch-failed', false);
        }

        await sync.refreshSessions();
        await refreshControlState();

        Modal.alert(
            t('common.success'),
            targetController === 'mac'
                ? t('sessionInfo.switchControlToMacSuccess')
                : t('sessionInfo.switchControlToMobileSuccess')
        );
    }, [effectiveControlState?.leaseVersion, refreshControlState, session.id]);

    const [switchingToMac, performSwitchToMac] = useHappyAction(async () => {
        await switchController('mac');
    });

    const [switchingToMobile, performSwitchToMobile] = useHappyAction(async () => {
        await switchController('mobile');
    });

    const switchingControl = switchingToMac || switchingToMobile;

    const handleOpenInMac = useCallback(() => {
        if (handingOffToMac) {
            Modal.alert(t('common.loading'), t('sessionInfo.openOnMacOpeningSubtitle'));
            return;
        }
        Modal.alert(
            t('sessionInfo.openOnMacTitle'),
            hasTmuxOpenInMacSupport
                ? t('sessionInfo.openOnMacDescription')
                : t('sessionInfo.openOnMacSetupDescription', { debugDetails: openInMacDebugDetails }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('sessionInfo.openOnMacConfirm'),
                    onPress: performHandoffToMac
                }
            ]
        );
    }, [effectiveControlState?.controller, effectiveControlState?.handoffState, handingOffToMac, hasTmuxOpenInMacSupport, openInMacDebugDetails, openInMacResumeCommand, performHandoffToMac, session.active, session.metadata?.claudeSessionId, session.metadata?.machineId, session.metadata?.path, session.metadata?.terminalCarrier, session.metadata?.tmuxSessionId, sessionStatus.isConnected]);

    const resumableReasonText = (() => {
        if (sessionStatus.isConnected) return t('sessionInfo.resumableReasonSessionOnline');
        if (session.active) return t('sessionInfo.resumableReasonSessionActive');
        if ((session.metadata?.flavor ?? 'claude') !== 'claude') return t('sessionInfo.resumableReasonUnsupportedProvider');
        if (!session.metadata?.machineId || !session.metadata?.path || !session.metadata?.claudeSessionId) {
            return t('sessionInfo.resumableReasonMissingMetadata');
        }
        return t('sessionInfo.resumableReasonReady');
    })();

    const formatDate = useCallback((timestamp: number) => {
        return new Date(timestamp).toLocaleString();
    }, []);

    const handleCopyUpdateCommand = useCallback(async () => {
        const updateCommand = 'npm install -g happy-coder@latest';
        try {
            await Clipboard.setStringAsync(updateCommand);
            Modal.alert(t('common.success'), updateCommand);
        } catch (error) {
            Modal.alert(t('common.error'), t('common.error'));
        }
    }, []);

    return (
        <>
            <ItemList>
                {/* Session Header */}
                <View style={{ maxWidth: layout.maxWidth, alignSelf: 'center', width: '100%' }}>
                    <View style={{ alignItems: 'center', paddingVertical: 24, backgroundColor: theme.colors.surface, marginBottom: 8, borderRadius: 12, marginHorizontal: 16, marginTop: 16 }}>
                        <Avatar id={getSessionAvatarId(session)} size={80} monochrome={!sessionStatus.isConnected} flavor={session.metadata?.flavor} />
                        <Text style={{
                            fontSize: 20,
                            fontWeight: '600',
                            marginTop: 12,
                            textAlign: 'center',
                            color: theme.colors.text,
                            ...Typography.default('semiBold')
                        }}>
                            {sessionName}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                            <StatusDot color={sessionStatus.statusDotColor} isPulsing={sessionStatus.isPulsing} size={10} />
                            <Text style={{
                                fontSize: 15,
                                color: sessionStatus.statusColor,
                                fontWeight: '500',
                                ...Typography.default()
                            }}>
                                {sessionStatus.statusText}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* CLI Version Warning */}
                {isCliOutdated && (
                    <ItemGroup>
                        <Item
                            title={t('sessionInfo.cliVersionOutdated')}
                            subtitle={t('sessionInfo.updateCliInstructions')}
                            icon={<Ionicons name="warning-outline" size={29} color="#FF9500" />}
                            showChevron={false}
                            onPress={handleCopyUpdateCommand}
                        />
                    </ItemGroup>
                )}

                {/* Session Details */}
                <ItemGroup>
                    <Item
                        title={t('sessionInfo.happySessionId')}
                        subtitle={`${session.id.substring(0, 8)}...${session.id.substring(session.id.length - 8)}`}
                        icon={<Ionicons name="finger-print-outline" size={29} color="#007AFF" />}
                        onPress={handleCopySessionId}
                    />
                    {session.metadata?.claudeSessionId && (
                        <Item
                            title={t('sessionInfo.claudeCodeSessionId')}
                            subtitle={`${session.metadata.claudeSessionId.substring(0, 8)}...${session.metadata.claudeSessionId.substring(session.metadata.claudeSessionId.length - 8)}`}
                            icon={<Ionicons name="code-outline" size={29} color="#9C27B0" />}
                            onPress={async () => {
                                try {
                                    await Clipboard.setStringAsync(session.metadata!.claudeSessionId!);
                                    Modal.alert(t('common.success'), t('sessionInfo.claudeCodeSessionIdCopied'));
                                } catch (error) {
                                    Modal.alert(t('common.error'), t('sessionInfo.failedToCopyClaudeCodeSessionId'));
                                }
                            }}
                        />
                    )}
                    <Item
                        title={t('sessionInfo.connectionStatus')}
                        detail={sessionStatus.isConnected ? t('status.online') : t('status.offline')}
                        icon={<Ionicons name="pulse-outline" size={29} color={sessionStatus.isConnected ? "#34C759" : "#8E8E93"} />}
                        showChevron={false}
                    />
                    <Item
                        title={t('sessionInfo.resumableStatus')}
                        subtitle={effectiveControlState
                            ? `${resumableReasonText} | controller=${effectiveControlState.controller} | handoff=${effectiveControlState.handoffState}`
                            : resumableReasonText}
                        detail={canResumeSession ? t('sessionInfo.resumableAvailable') : t('sessionInfo.resumableUnavailable')}
                        icon={<Ionicons name="refresh-circle-outline" size={29} color={canResumeSession ? "#34C759" : "#8E8E93"} />}
                        showChevron={false}
                    />
                    <Item
                        title={t('sessionInfo.created')}
                        subtitle={formatDate(session.createdAt)}
                        icon={<Ionicons name="calendar-outline" size={29} color="#007AFF" />}
                        showChevron={false}
                    />
                    <Item
                        title={t('sessionInfo.lastUpdated')}
                        subtitle={formatDate(session.updatedAt)}
                        icon={<Ionicons name="time-outline" size={29} color="#007AFF" />}
                        showChevron={false}
                    />
                    <Item
                        title={t('sessionInfo.sequence')}
                        detail={session.seq.toString()}
                        icon={<Ionicons name="git-commit-outline" size={29} color="#007AFF" />}
                        showChevron={false}
                    />
                </ItemGroup>

                {/* Quick Actions */}
                <ItemGroup title={t('sessionInfo.quickActions')}>
                    {session.metadata?.machineId && (
                        <Item
                            title={t('sessionInfo.viewMachine')}
                            subtitle={t('sessionInfo.viewMachineSubtitle')}
                            icon={<Ionicons name="server-outline" size={29} color="#007AFF" />}
                            onPress={() => router.push(`/machine/${session.metadata?.machineId}`)}
                        />
                    )}
                    {sessionStatus.isConnected && (
                        <Item
                            title={t('sessionInfo.stopSession')}
                            subtitle={t('sessionInfo.stopSessionSubtitle')}
                            icon={<Ionicons name="pause-circle-outline" size={29} color="#FF3B30" />}
                            onPress={handleStopSession}
                        />
                    )}
                    {devModeEnabled && sessionStatus.isConnected && (
                        <Item
                            title={t('sessionInfo.killSession')}
                            subtitle={t('sessionInfo.killSessionSubtitle')}
                            icon={<Ionicons name="skull-outline" size={29} color="#FF3B30" />}
                            onPress={handleArchiveSession}
                        />
                    )}
                    {canResumeSession && (
                        <Item
                            title={t('sessionInfo.resumeSession')}
                            subtitle={t('sessionInfo.resumeSessionSubtitle')}
                            icon={<Ionicons name="play-circle-outline" size={29} color="#34C759" />}
                            onPress={() => {
                                void resumeSession();
                            }}
                        />
                    )}
                    {canOpenInMac && (
                        <Item
                            title={t('sessionInfo.openOnMacTitle')}
                            subtitle={handingOffToMac
                                ? t('sessionInfo.openOnMacOpeningSubtitle')
                                : hasTmuxOpenInMacSupport
                                    ? t('sessionInfo.openOnMacReadySubtitle')
                                    : t('sessionInfo.openOnMacSetupSubtitle')
                            }
                            icon={<Ionicons name="desktop-outline" size={29} color="#5856D6" />}
                            onPress={handleOpenInMac}
                        />
                    )}
                    {canSwitchControlToMac && (
                        <Item
                            title={t('sessionInfo.switchControlToMac')}
                            subtitle={switchingControl ? t('sessionInfo.switchControlToMacLoading') : t('sessionInfo.switchControlToMacSubtitle')}
                            icon={<Ionicons name="swap-horizontal-outline" size={29} color="#5856D6" />}
                            onPress={performSwitchToMac}
                        />
                    )}
                    {canSwitchControlToMobile && (
                        <Item
                            title={t('sessionInfo.switchControlToMobile')}
                            subtitle={switchingControl ? t('sessionInfo.switchControlToMobileLoading') : t('sessionInfo.switchControlToMobileSubtitle')}
                            icon={<Ionicons name="phone-portrait-outline" size={29} color="#34C759" />}
                            onPress={performSwitchToMobile}
                        />
                    )}
                    {!sessionStatus.isConnected && !session.active && (
                        <Item
                            title={t('sessionInfo.deleteSession')}
                            subtitle={t('sessionInfo.deleteSessionSubtitle')}
                            icon={<Ionicons name="trash-outline" size={29} color="#FF3B30" />}
                            onPress={handleDeleteSession}
                        />
                    )}
                </ItemGroup>

                {/* Metadata */}
                {session.metadata && (
                    <ItemGroup title={t('sessionInfo.metadata')}>
                        <Item
                            title={t('sessionInfo.host')}
                            subtitle={session.metadata.host}
                            icon={<Ionicons name="desktop-outline" size={29} color="#5856D6" />}
                            showChevron={false}
                        />
                        <Item
                            title={t('sessionInfo.path')}
                            subtitle={formatPathRelativeToHome(session.metadata.path, session.metadata.homeDir)}
                            icon={<Ionicons name="folder-outline" size={29} color="#5856D6" />}
                            showChevron={false}
                        />
                        {session.metadata.version && (
                            <Item
                                title={t('sessionInfo.cliVersion')}
                                subtitle={session.metadata.version}
                                detail={isCliOutdated ? '⚠️' : undefined}
                                icon={<Ionicons name="git-branch-outline" size={29} color={isCliOutdated ? "#FF9500" : "#5856D6"} />}
                                showChevron={false}
                            />
                        )}
                        {session.metadata.os && (
                            <Item
                                title={t('sessionInfo.operatingSystem')}
                                subtitle={formatOSPlatform(session.metadata.os)}
                                icon={<Ionicons name="hardware-chip-outline" size={29} color="#5856D6" />}
                                showChevron={false}
                            />
                        )}
                        <Item
                            title={t('sessionInfo.aiProvider')}
                            subtitle={(() => {
                                const flavor = session.metadata.flavor || 'claude';
                                if (flavor === 'claude') return 'Claude';
                                if (flavor === 'gpt' || flavor === 'openai') return 'Codex';
                                if (flavor === 'gemini') return 'Gemini';
                                return flavor;
                            })()}
                            icon={<Ionicons name="sparkles-outline" size={29} color="#5856D6" />}
                            showChevron={false}
                        />
                        <Item
                            title={t('sessionInfo.sandbox')}
                            subtitle={formatSandboxMetadata(session.metadata.sandbox, session.metadata.homeDir)}
                            icon={<Ionicons name="shield-outline" size={29} color="#5856D6" />}
                            showChevron={false}
                        />
                        <Item
                            title={t('sessionInfo.permissionBypass')}
                            subtitle={formatDangerouslySkipPermissionsMetadata(
                                session.metadata.dangerouslySkipPermissions,
                                session.metadata.flavor,
                                session.permissionMode,
                                session.metadata.sandbox,
                            )}
                            icon={<Ionicons name="warning-outline" size={29} color="#5856D6" />}
                            showChevron={false}
                        />
                        {session.metadata.hostPid && (
                            <Item
                                title={t('sessionInfo.processId')}
                                subtitle={session.metadata.hostPid.toString()}
                                icon={<Ionicons name="terminal-outline" size={29} color="#5856D6" />}
                                showChevron={false}
                            />
                        )}
                        {session.metadata.happyHomeDir && (
                            <Item
                                title={t('sessionInfo.happyHome')}
                                subtitle={formatPathRelativeToHome(session.metadata.happyHomeDir, session.metadata.homeDir)}
                                icon={<Ionicons name="home-outline" size={29} color="#5856D6" />}
                                showChevron={false}
                            />
                        )}
                        <Item
                            title={t('sessionInfo.copyMetadata')}
                            icon={<Ionicons name="copy-outline" size={29} color="#007AFF" />}
                            onPress={handleCopyMetadata}
                        />
                    </ItemGroup>
                )}

                {/* Agent State */}
                {session.agentState && (
                    <ItemGroup title={t('sessionInfo.agentState')}>
                        <Item
                            title={t('sessionInfo.controlledByUser')}
                            detail={session.agentState.controlledByUser ? t('common.yes') : t('common.no')}
                            icon={<Ionicons name="person-outline" size={29} color="#FF9500" />}
                            showChevron={false}
                        />
                        {session.agentState.requests && Object.keys(session.agentState.requests).length > 0 && (
                            <Item
                                title={t('sessionInfo.pendingRequests')}
                                detail={Object.keys(session.agentState.requests).length.toString()}
                                icon={<Ionicons name="hourglass-outline" size={29} color="#FF9500" />}
                                showChevron={false}
                            />
                        )}
                    </ItemGroup>
                )}

                {/* Activity */}
                <ItemGroup title={t('sessionInfo.activity')}>
                    <Item
                        title={t('sessionInfo.thinking')}
                        detail={session.thinking ? t('common.yes') : t('common.no')}
                        icon={<Ionicons name="bulb-outline" size={29} color={session.thinking ? "#FFCC00" : "#8E8E93"} />}
                        showChevron={false}
                    />
                    {session.thinking && (
                        <Item
                            title={t('sessionInfo.thinkingSince')}
                            subtitle={formatDate(session.thinkingAt)}
                            icon={<Ionicons name="timer-outline" size={29} color="#FFCC00" />}
                            showChevron={false}
                        />
                    )}
                </ItemGroup>

                {/* Raw JSON (Dev Mode Only) */}
                {devModeEnabled && (
                    <ItemGroup title={t('tools.fullView.rawJsonDevMode')}>
                        {session.agentState && (
                            <>
                                <Item
                                    title={t('sessionInfo.agentState')}
                                    icon={<Ionicons name="code-working-outline" size={29} color="#FF9500" />}
                                    showChevron={false}
                                />
                                <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
                                    <CodeView 
                                        code={JSON.stringify(session.agentState, null, 2)}
                                        language="json"
                                    />
                                </View>
                            </>
                        )}
                        {session.metadata && (
                            <>
                                <Item
                                    title={t('sessionInfo.metadata')}
                                    icon={<Ionicons name="information-circle-outline" size={29} color="#5856D6" />}
                                    showChevron={false}
                                />
                                <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
                                    <CodeView 
                                        code={JSON.stringify(session.metadata, null, 2)}
                                        language="json"
                                    />
                                </View>
                            </>
                        )}
                        {sessionStatus && (
                            <>
                                <Item
                                    title={t('sessionInfo.sessionStatus')}
                                    icon={<Ionicons name="analytics-outline" size={29} color="#007AFF" />}
                                    showChevron={false}
                                />
                                <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
                                    <CodeView 
                                        code={JSON.stringify({
                                            isConnected: sessionStatus.isConnected,
                                            statusText: sessionStatus.statusText,
                                            statusColor: sessionStatus.statusColor,
                                            statusDotColor: sessionStatus.statusDotColor,
                                            isPulsing: sessionStatus.isPulsing
                                        }, null, 2)}
                                        language="json"
                                    />
                                </View>
                            </>
                        )}
                        {/* Full Session Object */}
                        <Item
                            title={t('sessionInfo.fullSessionObject')}
                            icon={<Ionicons name="document-text-outline" size={29} color="#34C759" />}
                            showChevron={false}
                        />
                        <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
                            <CodeView 
                                code={JSON.stringify(session, null, 2)}
                                language="json"
                            />
                        </View>
                    </ItemGroup>
                )}
            </ItemList>
        </>
    );
}

export default React.memo(() => {
    const { theme } = useUnistyles();
    const { id } = useLocalSearchParams<{ id: string }>();
    const session = useSession(id);
    const isDataReady = useIsDataReady();

    // Handle three states: loading, deleted, and exists
    if (!isDataReady) {
        // Still loading data
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="hourglass-outline" size={48} color={theme.colors.textSecondary} />
                <Text style={{ color: theme.colors.textSecondary, fontSize: 17, marginTop: 16, ...Typography.default('semiBold') }}>{t('common.loading')}</Text>
            </View>
        );
    }

    if (!session) {
        // Session has been deleted or doesn't exist
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="trash-outline" size={48} color={theme.colors.textSecondary} />
                <Text style={{ color: theme.colors.text, fontSize: 20, marginTop: 16, ...Typography.default('semiBold') }}>{t('errors.sessionDeleted')}</Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 15, marginTop: 8, textAlign: 'center', paddingHorizontal: 32, ...Typography.default() }}>{t('errors.sessionDeletedDescription')}</Text>
            </View>
        );
    }

    return <SessionInfoContent session={session} />;
});
