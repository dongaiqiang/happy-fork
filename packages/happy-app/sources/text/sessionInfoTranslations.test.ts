import fs from 'node:fs';
import { describe, it, expect } from 'vitest';

import { en } from './_default';
import { zhHans } from './translations/zh-Hans';
import { zhHant } from './translations/zh-Hant';

const runtimeTranslations = {
    en,
    'zh-Hans': zhHans,
    'zh-Hant': zhHant,
} as const;

const sessionInfoKeys = [
    'resumeSession',
    'resumeSessionSubtitle',
    'resumeMissingMetadata',
    'resumeNoAvailableMachine',
    'createDirectoryTitle',
    'createDirectoryMessage',
    'resumeRpcUnavailable',
    'resumeMachineOffline',
    'openOnMacTitle',
    'openOnMacConfirm',
    'openOnMacDescription',
    'openOnMacSetupDescription',
    'openOnMacOpeningSubtitle',
    'openOnMacReadySubtitle',
    'openOnMacSetupSubtitle',
    'openOnMacMissingMetadata',
    'openOnMacNoAvailableMachine',
    'openOnMacSuccessNewSession',
    'openOnMacSuccessSameSession',
    'openOnMacAuthHint',
    'openOnMacRouteMissing',
    'openOnMacFailedWithReason',
    'switchControlToMac',
    'switchControlToMacSubtitle',
    'switchControlToMacLoading',
    'switchControlToMobile',
    'switchControlToMobileSubtitle',
    'switchControlToMobileLoading',
    'switchControlToMacFailed',
    'switchControlToMobileFailed',
    'switchControlToMacSuccess',
    'switchControlToMobileSuccess',
    'sandbox',
    'permissionBypass',
    'enabled',
    'disabled',
    'sandboxIsolation',
    'sandboxNetwork',
    'sandboxWorkspace',
    'sessionStatus',
    'fullSessionObject',
] as const;

const machineKeys = [
    'daemonLikelyAlive',
    'daemonStoppedState',
    'stopDaemonConfirmTitle',
    'stopDaemonConfirmMessage',
    'daemonStopped',
    'stopDaemonFailed',
    'machineNotFound',
    'unknownMachine',
    'multipleMachines',
    'renameMachineTitle',
    'renameMachineMessage',
    'renameMachinePlaceholder',
    'renameMachineSuccess',
    'renameMachineFailed',
    'createDirectoryTitle',
    'createDirectoryMessage',
    'startSessionFailed',
    'unknownPath',
    'previousSessionsTitle',
] as const;

const restoreKeys = [
    'linkDeviceSteps',
    'restoreWithSecretKeyInstead',
    'enterSecretKeyInstructions',
    'secretKeyPlaceholder',
] as const;

const welcomeKeys = [
    'createAccountFailedInvalidResponse',
    'createAccountFailedWithReason',
] as const;

const settingsAppearanceKeys = [
    'theme',
    'themeDescription',
    'display',
    'displayDescription',
    'inlineToolCalls',
    'inlineToolCallsDescription',
    'expandTodoLists',
    'expandTodoListsDescription',
    'showLineNumbersInDiffs',
    'showLineNumbersInDiffsDescription',
    'showLineNumbersInToolViews',
    'showLineNumbersInToolViewsDescription',
    'wrapLinesInDiffs',
    'wrapLinesInDiffsDescription',
    'alwaysShowContextSize',
    'alwaysShowContextSizeDescription',
    'avatarStyle',
    'avatarStyleDescription',
    'showFlavorIcons',
    'showFlavorIconsDescription',
    'compactSessionView',
    'compactSessionViewDescription',
] as const;

const settingsAccountKeys = [
    'accountInformation',
    'status',
    'statusActive',
    'statusNotAuthenticated',
    'anonymousId',
    'publicId',
    'notAvailable',
    'linkNewDevice',
    'linkNewDeviceSubtitle',
    'profile',
    'name',
    'github',
    'tapToDisconnect',
    'backup',
    'backupDescription',
    'secretKey',
    'tapToReveal',
    'tapToHide',
    'secretKeyLabel',
    'secretKeyCopied',
    'secretKeyCopyFailed',
    'privacy',
    'privacyDescription',
    'analytics',
    'analyticsDisabled',
    'analyticsEnabled',
    'dangerZone',
    'logout',
    'logoutSubtitle',
    'logoutConfirm',
] as const;

const settingsVoiceKeys = [
    'languageTitle',
    'languageDescription',
    'inputModeTitle',
    'inputModeDescription',
    'recognitionEngine',
    'recognitionEngineElevenLabs',
    'recognitionEngineStreamingAsr',
    'preferredLanguage',
    'preferredLanguageSubtitle',
] as const;

const terminalKeys = [
    'webBrowserRequired',
    'webBrowserRequiredDescription',
    'processingConnection',
    'invalidConnectionLink',
    'invalidConnectionLinkDescription',
    'loginRequiredTitle',
    'loginRequiredDescription',
    'loginFirst',
    'connectTerminal',
    'terminalRequestDescription',
    'connectionDetails',
    'publicKey',
    'encryption',
    'endToEndEncrypted',
    'acceptConnection',
    'connecting',
    'reject',
    'security',
    'securityFooter',
    'clientSideProcessing',
    'linkProcessedLocally',
] as const;

const newSessionMachinePickerKeys = [
    'title',
    'searchPlaceholder',
    'recentSectionTitle',
    'favoritesSectionTitle',
    'allSectionTitle',
    'noItemsMessage',
    'removeFavoriteTitle',
    'removeFavoriteMessage',
] as const;

const newSessionEmptyStateKeys = [
    'emptySessionsTitle',
    'emptySessionsDescriptionWithMachines',
    'emptySessionsDescriptionWithoutMachines',
] as const;

const newSessionPathPickerKeys = [
    'title',
    'noMachineSelected',
    'workingDirectoryTitle',
    'enterPathTitle',
    'placeholder',
    'recentPathsTitle',
    'suggestedPathsTitle',
    'searchPlaceholder',
    'recentDirectoriesTitle',
    'favoriteDirectoriesTitle',
    'allSectionTitle',
    'noRecentDirectories',
    'removeFavoriteTitle',
    'removeFavoriteMessage',
] as const;

const newSessionProfileSectionKeys = [
    'title',
    'description',
    'builtIn',
    'copySuffix',
    'cliLabel',
    'requiresAgentOnly',
    'cliNotDetected',
    'addButton',
    'duplicateButton',
    'deleteButton',
    'permissionModeTitle',
    'advancedOptions',
    'warningHideFor',
    'dismissThisMachine',
    'dismissAnyMachine',
    'claudeCliNotDetected',
    'codexCliNotDetected',
    'geminiCliNotDetected',
    'claudeInstallCommand',
    'codexInstallCommand',
    'geminiInstallCommand',
    'installationGuide',
    'geminiDocs',
] as const;

const newSessionWizardKeys = [
    'headerTitle',
    'selectedProfileUnknown',
    'createSessionButton',
    'createProfilePromptTitle',
    'createProfilePromptMessage',
    'defaultProfileName',
    'customProfileDescription',
    'duplicateProfilePromptTitle',
    'duplicateProfilePromptMessage',
    'duplicateProfileDefaultName',
    'copyOfProfileDescription',
    'sessionTypeTitle',
    'sessionTypeDescription',
    'aiBackendTitle',
    'agentTitle',
    'agentDescription',
    'optionsTitle',
    'optionsDescription',
    'machineDescription',
    'availableMachinesTitle',
    'pathDescription',
    'promptTitle',
    'promptDescription',
] as const;

const newSessionWizardBuiltInProfileKeys = [
    'anthropicName',
    'anthropicDescription',
    'deepseekName',
    'deepseekDescription',
    'openaiName',
    'openaiDescription',
    'azureOpenAiCodexName',
    'azureOpenAiCodexDescription',
    'azureOpenAiName',
    'azureOpenAiDescription',
    'zAiName',
    'zAiDescription',
    'microsoftName',
    'microsoftDescription',
] as const;

const newSessionWizardProfileKeys = [
    'useAsIs',
    'builtInProfilesTitle',
    'customProfilesTitle',
    'createNewProfileDescription',
    'manualConfigurationGroupTitle',
    'manualConfigurationTitle',
    'manualConfigurationDescription',
    'useCliVars',
    'configureButton',
    'selectionOptionsTitle',
    'selectionOptionsUseAsIs',
    'selectionOptionsEdit',
    'selectionOptionsManual',
] as const;

const newSessionWizardProfileConfigKeys = [
    'title',
    'fallbackProfileName',
    'description',
    'requiredConfigurationTitle',
    'apiKeyTip',
    'emptyFieldsNote',
    'deepseekApiKeyLabel',
    'deepseekApiKeyPlaceholder',
    'openAiApiKeyLabel',
    'openAiApiKeyPlaceholder',
    'azureOpenAiApiKeyLabel',
    'azureOpenAiApiKeyPlaceholder',
    'azureApiKeyLabel',
    'azureApiKeyPlaceholder',
    'azureEndpointLabel',
    'azureEndpointPlaceholder',
    'deploymentNameLabel',
    'deploymentNamePlaceholder',
    'zAiApiKeyLabel',
    'zAiApiKeyPlaceholder',
] as const;

const newSessionWizardBackendKeys = [
    'anthropicName',
    'anthropicDescription',
    'openAiName',
    'openAiDescription',
    'deepseekName',
    'deepseekDescription',
    'zAiName',
    'zAiDescription',
    'microsoftName',
    'microsoftDescription',
] as const;

const newSessionWizardAgentKeys = [
    'selectedProfileLabel',
    'claudeDescription',
    'codexDescription',
    'notCompatibleWithSelectedProfile',
] as const;

const newSessionWizardOptionsKeys = [
    'usingProfileLabel',
    'environmentVariablesApplied',
    'modelModeTitle',
    'defaultLabel',
    'defaultDescription',
    'adaptiveUsageLabel',
    'adaptiveUsageDescription',
    'sonnetLabel',
    'sonnetDescription',
    'opusLabel',
    'opusDescription',
    'gpt5CodexHighLabel',
    'gpt5CodexHighDescription',
    'gpt5CodexMediumLabel',
    'gpt5CodexMediumDescription',
    'gpt5CodexLowLabel',
    'gpt5CodexLowDescription',
] as const;

const newSessionWizardPathKeys = [
    'recentlyUsed',
    'commonDirectoriesTitle',
    'homeDirectory',
    'projectsFolder',
    'documentsFolder',
    'desktopFolder',
    'customDirectoryTitle',
    'enterCustomPathTitle',
    'customPathDescription',
    'customPathPlaceholder',
] as const;

const profileKeys = [
    'addProfile',
    'editProfile',
    'profileName',
    'enterName',
    'tmuxSession',
    'tmuxTempDir',
    'setupInstructions',
    'viewOfficialSetupGuide',
    'defaultSessionType',
    'defaultPermissionMode',
    'spawnSessionsInTmux',
    'tmuxEnabledDescription',
    'tmuxDisabledDescription',
    'tmuxSessionHelp',
    'tmuxSessionPlaceholder',
    'tmuxTempDirHelp',
    'tmuxTempDirPlaceholder',
    'disabledPlaceholder',
    'startupBashScript',
    'startupScriptEnabledDescription',
    'startupScriptDisabledDescription',
    'startupScriptPlaceholder',
    'environmentVariablesTitle',
    'addVariable',
    'envVarNamePlaceholder',
    'envVarValuePlaceholder',
    'remoteVariableToggle',
    'remoteVariableNamePlaceholder',
    'checkingRemoteMachine',
    'valueNotFound',
    'selectMachineToCheckVariableExists',
    'secretValueNotRetrievedForSecurity',
    'defaultValue',
    'valuePlaceholder',
    'hiddenForSecuritySuffix',
    'hiddenValue',
    'emptyValue',
] as const;

const profilePermissionModeKeys = [
    'defaultLabel',
    'defaultDescription',
    'acceptEditsLabel',
    'acceptEditsDescription',
    'planLabel',
    'planDescription',
    'bypassPermissionsLabel',
    'bypassPermissionsDescription',
] as const;

const markdownKeys = [
    'codeCopied',
    'copyFailed',
    'mermaidRenderFailed',
    'textSelectionOpenFailed',
] as const;

const usageKeys = [
    'today',
    'last7Days',
    'last30Days',
    'totalTokens',
    'totalCost',
    'tokens',
    'cost',
    'usageOverTime',
    'byModel',
    'noData',
] as const;

const requiredInfoTsxUsages = [
    "t('sessionInfo.resumeSession')",
    "t('sessionInfo.resumeSessionSubtitle')",
    "t('sessionInfo.openOnMacTitle')",
    "t('sessionInfo.openOnMacOpeningSubtitle')",
    "t('sessionInfo.openOnMacReadySubtitle')",
    "t('sessionInfo.openOnMacSetupSubtitle')",
    "t('sessionInfo.switchControlToMac')",
    "t('sessionInfo.switchControlToMacSubtitle')",
    "t('sessionInfo.switchControlToMacLoading')",
    "t('sessionInfo.switchControlToMobile')",
    "t('sessionInfo.switchControlToMobileSubtitle')",
    "t('sessionInfo.switchControlToMobileLoading')",
    "t('sessionInfo.sandbox')",
    "t('sessionInfo.permissionBypass')",
    "t('tools.fullView.rawJsonDevMode')",
    "t('sessionInfo.sessionStatus')",
    "t('sessionInfo.fullSessionObject')",
] as const;

const forbiddenStringLiterals = [
    'Resume Session',
    'Open on Mac',
    'Switch Control to Mac',
    'Switch Control to Mobile',
    'Dangerously Skip Permissions',
    'Sandbox',
    'Raw JSON (Dev Mode)',
    'Session Status',
    'Full Session Object',
] as const;

const requiredEmptySessionsTabletUsages = [
    "t('newSession.emptySessionsTitle')",
    "t('newSession.emptySessionsDescriptionWithMachines')",
    "t('newSession.emptySessionsDescriptionWithoutMachines')",
    "t('newSession.title')",
] as const;

const forbiddenEmptySessionsTabletLiterals = [
    'No active sessions',
    'Start a new session on any of your connected machines.',
    'Open a new terminal on your computer to start a session.',
    'Start New Session',
] as const;

const requiredActiveSessionsGroupUsages = [
    "t('machine.unknownMachine')",
    "t('machine.multipleMachines'",
] as const;

const requiredActiveSessionsGroupCompactUsages = [
    "t('machine.unknownMachine')",
] as const;

const forbiddenActiveSessionsGroupLiterals = [
    'unknown',
    '<unknown>',
    'machines',
] as const;

const requiredUsageChartUsages = [
    "t('usage.noData')",
] as const;

const forbiddenUsageChartLiterals = [
    'No usage data available',
    'en-US',
] as const;

const requiredMermaidRendererUsages = [
    "t('markdown.mermaidRenderFailed')",
] as const;

const forbiddenMermaidRendererLiterals = [
    'Mermaid diagram syntax error',
] as const;

const requiredSearchableListSelectorUsages = [
    'config.removeFavoriteTitle',
    'config.removeFavoriteMessage',
    'config.removeFavoriteConfirmText',
    'config.allItemsSectionTitle',
    "t('common.remove')",
] as const;

const forbiddenSearchableListSelectorLiterals = [
    'Remove Favorite',
    'Remove "',
    "replace('Recent ', 'All ')",
] as const;

const requiredMarkdownViewUsages = [
    "t('common.error')",
    "t('markdown.textSelectionOpenFailed')",
    "t('common.ok')",
] as const;

const forbiddenMarkdownViewLiterals = [
    'Failed to open text selection. Please try again.',
] as const;

const requiredUseHappyActionUsages = [
    "t('common.error')",
    "t('errors.unknownError')",
    "t('common.ok')",
] as const;

const forbiddenUseHappyActionLiterals = [
    'Unknown error',
    "Modal.alert('Error'",
] as const;

const requiredMachineUsages = [
    "t('machine.stopDaemonConfirmTitle')",
    "t('machine.stopDaemonConfirmMessage')",
    "t('machine.daemonStopped')",
    "t('machine.stopDaemonFailed')",
    "t('machine.renameMachineTitle')",
    "t('machine.renameMachineMessage')",
    "t('machine.renameMachinePlaceholder')",
    "t('machine.renameMachineSuccess')",
    "t('machine.renameMachineFailed')",
    "t('machine.createDirectoryTitle')",
    "t('machine.createDirectoryMessage', { directory: result.directory })",
    "t('machine.startSessionFailed')",
    "t('machine.machineNotFound')",
    "t('machine.unknownMachine')",
    "t('machine.unknownPath')",
    "t('machine.previousSessionsTitle')",
    "t('machineLauncher.enterCustomPath')",
] as const;

const forbiddenMachineLiterals = [
    'Stop Daemon?',
    'Rename Machine',
    'Create Directory?',
    'Machine not found',
    'Previous Sessions (up to 5 most recent)',
    'Enter custom path',
] as const;

const requiredRestoreIndexUsages = [
    "t('restore.linkDeviceSteps')",
    "t('restore.restoreWithSecretKeyInstead')",
] as const;

const forbiddenRestoreIndexLiterals = [
    'Open HelloVibe on your mobile device',
    'Go to Settings → Account',
    'Link New Device',
    'Restore with Secret Key Instead',
] as const;

const requiredRestoreManualUsages = [
    "t('restore.enterSecretKeyInstructions')",
    "t('restore.secretKeyPlaceholder')",
] as const;

const forbiddenRestoreManualLiterals = [
    'Enter your secret key to restore access to your account.',
    'XXXXX-XXXXX-XXXXX...',
] as const;

const requiredWelcomeUsages = [
    "t('welcome.createAccountFailedInvalidResponse')",
    "t('welcome.createAccountFailedWithReason'",
] as const;

const forbiddenWelcomeLiterals = [
    '创建账户失败：服务器没有返回有效登录信息。请先确认右上角服务器地址已改成 https://api.hellovibe.com，然后再重试。',
    '创建账户失败：${message || \'未知错误\'}。请先确认右上角服务器地址已改成 https://api.hellovibe.com，然后再重试。',
] as const;

const requiredSettingsUsages = [
    "t('settings.account')",
    "t('settings.appearance')",
    "t('settings.voiceAssistant')",
    "t('settings.featuresTitle')",
    "t('settings.whatsNew')",
    "t('settings.privacyPolicy')",
] as const;

const requiredSettingsAccountUsages = [
    "t('settingsAccount.accountInformation')",
    "t('settingsAccount.status')",
    "t('settingsAccount.anonymousId')",
    "t('settingsAccount.publicId')",
    "t('settingsAccount.linkNewDevice')",
    "t('settingsAccount.linkNewDeviceSubtitle')",
    "t('settingsAccount.profile')",
    "t('settingsAccount.name')",
    "t('settingsAccount.github')",
    "t('settingsAccount.tapToDisconnect')",
    "t('settings.connectedAccounts')",
    "t('settingsAccount.backup')",
    "t('settingsAccount.secretKey')",
    "t('settingsAccount.secretKeyLabel')",
    "t('settingsAccount.privacy')",
    "t('settingsAccount.analytics')",
    "t('settingsAccount.dangerZone')",
    "t('settingsAccount.logout')",
    "t('settingsAccount.logoutSubtitle')",
    "t('settingsAccount.logoutConfirm')",
] as const;

const requiredSettingsAppearanceUsages = [
    "t('settingsAppearance.theme')",
    "t('settingsAppearance.themeDescription')",
    "t('settings.appearance')",
    "t('settingsAppearance.themeDescriptions.adaptive')",
    "t('settingsAppearance.themeDescriptions.light')",
    "t('settingsAppearance.themeDescriptions.dark')",
    "t('settingsAppearance.themeOptions.adaptive')",
    "t('settingsAppearance.themeOptions.light')",
    "t('settingsAppearance.themeOptions.dark')",
    "t('settingsLanguage.title')",
    "t('settingsLanguage.description')",
    "t('settingsAppearance.display')",
    "t('settingsAppearance.compactSessionView')",
    "t('settingsAppearance.inlineToolCalls')",
    "t('settingsAppearance.expandTodoLists')",
    "t('settingsAppearance.showLineNumbersInDiffs')",
    "t('settingsAppearance.showLineNumbersInToolViews')",
    "t('settingsAppearance.wrapLinesInDiffs')",
    "t('settingsAppearance.alwaysShowContextSize')",
    "t('settingsAppearance.avatarStyle')",
    "t('settingsAppearance.avatarOptions.pixelated')",
    "t('settingsAppearance.avatarOptions.gradient')",
    "t('settingsAppearance.avatarOptions.brutalist')",
    "t('settingsAppearance.showFlavorIcons')",
] as const;

const requiredSettingsVoiceUsages = [
    "t('settingsVoice.inputModeTitle')",
    "t('settingsVoice.inputModeDescription')",
    "t('settingsVoice.recognitionEngine')",
    "t('settingsVoice.recognitionEngineElevenLabs')",
    "t('settingsVoice.recognitionEngineStreamingAsr')",
    "t('settingsVoice.languageTitle')",
    "t('settingsVoice.languageDescription')",
    "t('settingsVoice.preferredLanguage')",
    "t('settingsVoice.preferredLanguageSubtitle')",
] as const;

const forbiddenSettingsVoiceLiterals = [
    '语音输入模式',
    '点击切换：默认使用 ElevenLabs 进行英文对话，或使用流式 ASR 进行极速中文识别。',
    '语音识别引擎',
    '自定义云端 ASR (实时出字)',
] as const;

const requiredTerminalConnectUsages = [
    "t('terminal.webBrowserRequired')",
    "t('terminal.webBrowserRequiredDescription')",
    "t('terminal.processingConnection')",
    "t('terminal.invalidConnectionLink')",
    "t('terminal.invalidConnectionLinkDescription')",
    "t('terminal.loginRequiredTitle')",
    "t('terminal.loginRequiredDescription')",
    "t('terminal.loginFirst')",
    "t('terminal.connectTerminal')",
    "t('terminal.terminalRequestDescription')",
    "t('terminal.connectionDetails')",
    "t('terminal.publicKey')",
    "t('terminal.encryption')",
    "t('terminal.endToEndEncrypted')",
    "t('terminal.acceptConnection')",
    "t('terminal.connecting')",
    "t('terminal.reject')",
    "t('terminal.security')",
    "t('terminal.securityFooter')",
    "t('terminal.clientSideProcessing')",
    "t('terminal.linkProcessedLocally')",
] as const;

const forbiddenTerminalConnectLiterals = [
    '先登录当前浏览器',
    '当前这个浏览器还没有登录账号，所以还不能同意这台 Mac 接入。请先在这个浏览器里创建账号或恢复旧账号，然后再回到这里点“接受连接”。',
    '先去登录账号',
] as const;

const requiredNewSessionIndexUsages = [
    "t('status.online')",
    "t('status.offline')",
    "t('newSession.promptPlaceholder')",
    "t('newSession.failedToStart')",
    "t('newSession.sessionTimeout')",
    "t('newSession.notConnectedToServer')",
    "t('newSession.sessionSpawningFailed')",
    "t('machine.machineGroup')",
    "t('newSession.machinePicker.title')",
    "t('newSession.machinePicker.searchPlaceholder')",
    "t('newSession.machinePicker.recentSectionTitle')",
    "t('newSession.machinePicker.favoritesSectionTitle')",
    "t('newSession.machinePicker.allSectionTitle')",
    "t('newSession.machinePicker.noItemsMessage')",
    "t('newSession.machinePicker.removeFavoriteTitle')",
    "t('newSession.machinePicker.removeFavoriteMessage'",
    "t('newSession.pathPicker.workingDirectoryTitle')",
    "t('newSession.pathPicker.searchPlaceholder')",
    "t('newSession.pathPicker.recentDirectoriesTitle')",
    "t('newSession.pathPicker.favoriteDirectoriesTitle')",
    "t('newSession.pathPicker.allSectionTitle')",
    "t('newSession.pathPicker.noRecentDirectories')",
    "t('newSession.pathPicker.removeFavoriteTitle')",
    "t('newSession.pathPicker.removeFavoriteMessage'",
    "t('newSession.profileSection.title')",
    "t('newSession.profileSection.description')",
    "t('newSession.profileSection.copySuffix')",
    "t('newSession.profileSection.builtIn')",
    "t('newSession.profileSection.cliLabel'",
    "t('newSession.profileSection.requiresAgentOnly'",
    "t('newSession.profileSection.cliNotDetected'",
    "t('newSession.profileSection.addButton')",
    "t('newSession.profileSection.duplicateButton')",
    "t('newSession.profileSection.deleteButton')",
    "t('newSession.profileSection.permissionModeTitle')",
    "t('newSession.profileSection.advancedOptions')",
    "t('newSession.profileSection.warningHideFor')",
    "t('newSession.profileSection.dismissThisMachine')",
    "t('newSession.profileSection.dismissAnyMachine')",
    "t('newSession.profileSection.claudeCliNotDetected')",
    "t('newSession.profileSection.codexCliNotDetected')",
    "t('newSession.profileSection.geminiCliNotDetected')",
    "t('newSession.profileSection.claudeInstallCommand')",
    "t('newSession.profileSection.codexInstallCommand')",
    "t('newSession.profileSection.geminiInstallCommand')",
    "t('newSession.profileSection.installationGuide')",
    "t('newSession.profileSection.geminiDocs')",
    "t('errors.unknownError')",
    "t('agentInput.agent.claude')",
    "t('agentInput.agent.codex')",
    "t('agentInput.agent.gemini')",
] as const;

const forbiddenNewSessionIndexLiterals = [
    'What would you like to work on?',
    'Select Machine',
    'Select Working Directory',
    'Type to filter machines...',
    'Recent Machines',
    'Favorite Machines',
    'No machines available',
    'Type to filter or enter custom directory...',
    'Recent Directories',
    'Favorite Directories',
    'No recent directories',
    'Choose AI Profile',
    'Built-in',
    'Claude CLI Not Detected',
    'Codex CLI Not Detected',
    'Gemini CLI Not Detected',
    "Don't show this popup for",
    'this machine',
    'any machine',
    'Install: npm install -g @anthropic-ai/claude-code',
    'Install: npm install -g codex-cli',
    'Install Gemini CLI if available',
    'View Installation Guide →',
    'View Gemini Docs →',
    'Add',
    'Duplicate',
    'Delete',
    'Permission Mode',
    'Advanced Options',
] as const;

const requiredNewSessionMachinePickerUsages = [
    "t('newSession.machinePicker.title')",
    "t('status.offline')",
    "t('status.online')",
    "t('newSession.machinePicker.searchPlaceholder')",
    "t('newSession.machinePicker.recentSectionTitle')",
    "t('newSession.machinePicker.favoritesSectionTitle')",
    "t('newSession.machinePicker.allSectionTitle')",
    "t('newSession.machinePicker.noItemsMessage')",
] as const;

const forbiddenNewSessionMachinePickerLiterals = [
    'Select Machine',
    'Type to filter machines...',
    'Recent Machines',
    'Favorite Machines',
    'No machines available',
] as const;

const requiredNewSessionPathPickerUsages = [
    "t('newSession.pathPicker.title')",
    "t('newSession.pathPicker.noMachineSelected')",
    "t('newSession.pathPicker.enterPathTitle')",
    "t('newSession.pathPicker.placeholder')",
    "t('newSession.pathPicker.recentPathsTitle')",
    "t('newSession.pathPicker.suggestedPathsTitle')",
] as const;

const forbiddenNewSessionPathPickerLiterals = [
    'Select Path',
    'No machine selected',
    'Enter Path',
    'Enter path (e.g. /home/user/projects)',
    'Recent Paths',
    'Suggested Paths',
] as const;

const requiredNewSessionWizardUsages = [
    "t('newSession.wizard.headerTitle')",
    "t('newSession.profileSection.title')",
    "t('newSession.wizardProfile.useAsIs')",
    "t('newSession.wizardProfile.manualConfigurationTitle')",
    "t('newSession.wizardProfileConfig.deepseekApiKeyLabel')",
    "t('newSession.wizardProfileConfig.azureEndpointLabel')",
    "t('newSession.wizard.sessionTypeTitle')",
    "t('newSession.wizardBackends.anthropicName')",
    "t('newSession.wizardAgent.selectedProfileLabel'",
    "t('newSession.wizardAgent.claudeDescription')",
    "t('newSession.wizardOptions.modelModeTitle')",
    "t('newSession.wizardPath.commonDirectoriesTitle')",
    "t('newSession.wizardPath.customPathPlaceholder')",
    "t('newSession.wizard.createSessionButton')",
] as const;

const forbiddenNewSessionWizardLiterals = [
    'Use As-Is',
    'Manual Configuration',
    'Use CLI Vars',
    'Enter a name for your new profile:',
    'DeepSeek API Key',
    'Azure Endpoint',
    'Choose AI Backend & Session Type',
    'AI Backend',
    'Not compatible with selected profile',
    'Available Machines',
    'Home directory',
    'Enter custom path',
    'Initial Message',
    'Create Session',
] as const;

const requiredProfileEditScreenUsages = [
    "t('profiles.editProfile')",
    "t('profiles.addProfile')",
    "t('common.back')",
] as const;

const requiredProfileEditFormUsages = [
    "t('profiles.setupInstructions')",
    "t('profiles.viewOfficialSetupGuide')",
    "t('profiles.defaultSessionType')",
    "t('profiles.defaultPermissionMode')",
    "t('profiles.permissionModes.defaultLabel')",
    "t('profiles.permissionModes.acceptEditsLabel')",
    "t('profiles.permissionModes.planLabel')",
    "t('profiles.permissionModes.bypassPermissionsLabel')",
    "t('profiles.spawnSessionsInTmux')",
    "t('profiles.tmuxEnabledDescription')",
    "t('profiles.tmuxDisabledDescription')",
    "t('profiles.tmuxSession')",
    "t('profiles.tmuxSessionHelp')",
    "t('profiles.tmuxSessionPlaceholder')",
    "t('profiles.tmuxTempDir')",
    "t('profiles.tmuxTempDirHelp')",
    "t('profiles.tmuxTempDirPlaceholder')",
    "t('profiles.disabledPlaceholder')",
    "t('profiles.startupBashScript')",
    "t('profiles.startupScriptEnabledDescription')",
    "t('profiles.startupScriptDisabledDescription')",
    "t('profiles.startupScriptPlaceholder')",
] as const;

const forbiddenProfileEditFormLiterals = [
    'Disabled - tmux not enabled',
    'Empty = first existing session',
    '/tmp (optional)',
] as const;

const requiredEnvironmentVariablesListUsages = [
    "t('profiles.environmentVariablesTitle')",
    "t('profiles.addVariable')",
    "t('profiles.envVarNamePlaceholder')",
    "t('profiles.envVarValuePlaceholder')",
    "t('common.cancel')",
    "t('common.create')",
] as const;

const forbiddenEnvironmentVariablesListLiterals = [
    'Variable name (e.g., MY_CUSTOM_VAR)',
    'Value (e.g., my-value or ${MY_VAR})',
] as const;

const requiredEnvironmentVariableCardUsages = [
    "t('profiles.hiddenForSecuritySuffix')",
    "t('profiles.hiddenValue')",
    "t('profiles.emptyValue')",
    "t('profiles.remoteVariableToggle')",
    "t('profiles.remoteVariableNamePlaceholder')",
    "t('profiles.checkingRemoteMachine')",
    "t('profiles.valueNotFound')",
    "t('profiles.valueFound'",
    "t('profiles.differsFromDocumentedValue'",
    "t('profiles.selectMachineToCheckVariableExists')",
    "t('profiles.secretValueNotRetrievedForSecurity')",
    "t('profiles.defaultValue')",
    "t('profiles.valuePlaceholder')",
    "t('profiles.overridingDocumentedDefault'",
    "t('profiles.sessionWillReceive'",
 ] as const;

const forbiddenEnvironmentVariableCardLiterals = [
    'Variable name (e.g., Z_AI_MODEL)',
    '⏳ Checking remote machine...',
    '✗ Value not found',
    '🔒 Secret value - not retrieved for security',
    'Default value:',
    'Value',
    '***hidden***',
    '(empty)',
] as const;

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function expectSourceToUseTranslations(
    source: string,
    requiredUsages: readonly string[],
    forbiddenLiterals: readonly string[] = [],
): void {
    for (const usage of requiredUsages) {
        expect(source).toContain(usage);
    }

    for (const text of forbiddenLiterals) {
        const singleOrDoubleQuotedLiteral = new RegExp(`(['"])${escapeRegExp(text)}\\1`);
        expect(source).not.toMatch(singleOrDoubleQuotedLiteral);
    }
}

describe('sessionInfo translation regression', () => {
    it('keeps the new sessionInfo keys present in all runtime languages', () => {
        for (const translation of Object.values(runtimeTranslations)) {
            for (const key of sessionInfoKeys) {
                const value = translation.sessionInfo[key];
                expect(value).toBeDefined();
                expect(['string', 'function']).toContain(typeof value);
            }
        }
    });

    it('renders dynamic sessionInfo translations with expected parameters', () => {
        const machineId = 'machine-123';
        const directory = '/tmp/hello-vibe';
        const debugDetails = 'tmux unavailable';
        const reason = 'rpc not available';
        const claudeSessionId = 'claude-session-123';

        for (const translation of Object.values(runtimeTranslations)) {
            expect(translation.sessionInfo.resumeNoAvailableMachine({ machineId })).toContain(machineId);
            expect(translation.sessionInfo.createDirectoryMessage({ directory })).toContain(directory);
            expect(translation.sessionInfo.openOnMacSetupDescription({ debugDetails })).toContain(debugDetails);
            expect(translation.sessionInfo.openOnMacNoAvailableMachine({ machineId })).toContain(machineId);
            expect(translation.sessionInfo.sandboxIsolation({ value: 'workspace-write' })).toContain('workspace-write');
            expect(translation.sessionInfo.sandboxNetwork({ value: 'enabled' })).toContain('enabled');
            expect(translation.sessionInfo.sandboxWorkspace({ value: '/tmp/demo' })).toContain('/tmp/demo');
            expect(translation.sessionInfo.openOnMacRouteMissing({ claudeSessionId, directory })).toContain(claudeSessionId);
            expect(translation.sessionInfo.openOnMacRouteMissing({ claudeSessionId, directory })).toContain(directory);
            expect(
                translation.sessionInfo.openOnMacFailedWithReason({
                    reason,
                    claudeSessionId,
                    directory,
                    hint: translation.sessionInfo.openOnMacAuthHint,
                }),
            ).toContain(reason);
        }
    });

    it('keeps session info screen wired to translation keys instead of hardcoded UI strings', () => {
        const source = fs.readFileSync(new URL('../app/(app)/session/[id]/info.tsx', import.meta.url), 'utf8');

        expectSourceToUseTranslations(source, requiredInfoTsxUsages, forbiddenStringLiterals);
    });
});

describe('screen copy translation regression', () => {
    it('keeps machine, restore, welcome, settings, terminal, and new-session regression keys present in all runtime languages', () => {
        for (const translation of Object.values(runtimeTranslations)) {
            for (const key of machineKeys) {
                const value = translation.machine[key];
                expect(value).toBeDefined();
                expect(['string', 'function']).toContain(typeof value);
            }

            for (const key of restoreKeys) {
                const value = translation.restore[key];
                expect(value).toBeDefined();
                expect(['string', 'function']).toContain(typeof value);
            }

            for (const key of welcomeKeys) {
                const value = translation.welcome[key];
                expect(value).toBeDefined();
                expect(['string', 'function']).toContain(typeof value);
            }

            for (const key of settingsAppearanceKeys) {
                const value = translation.settingsAppearance[key];
                expect(value).toBeDefined();
                expect(['string', 'function']).toContain(typeof value);
            }

            for (const key of settingsAccountKeys) {
                const value = translation.settingsAccount[key];
                expect(value).toBeDefined();
                expect(['string', 'function']).toContain(typeof value);
            }

            for (const key of settingsVoiceKeys) {
                const value = translation.settingsVoice[key];
                expect(value).toBeDefined();
                expect(['string', 'function']).toContain(typeof value);
            }

            for (const key of newSessionEmptyStateKeys) {
                const value = translation.newSession[key];
                expect(value).toBeDefined();
                expect(['string', 'function']).toContain(typeof value);
            }

            for (const key of profileKeys) {
                const value = translation.profiles[key];
                expect(value).toBeDefined();
                expect(['string', 'function']).toContain(typeof value);
            }

            for (const key of profilePermissionModeKeys) {
                const value = translation.profiles.permissionModes[key];
                expect(value).toBeDefined();
                expect(['string']).toContain(typeof value);
            }

            for (const key of markdownKeys) {
                const value = translation.markdown[key];
                expect(value).toBeDefined();
                expect(['string', 'function']).toContain(typeof value);
            }

            for (const key of usageKeys) {
                const value = translation.usage[key];
                expect(value).toBeDefined();
                expect(['string', 'function']).toContain(typeof value);
            }

            for (const key of terminalKeys) {
                const value = translation.terminal[key];
                expect(value).toBeDefined();
                expect(['string', 'function']).toContain(typeof value);
            }

            expect(translation.newSession.promptPlaceholder).toBeDefined();
            expect(typeof translation.newSession.promptPlaceholder).toBe('string');

            for (const key of newSessionMachinePickerKeys) {
                const value = translation.newSession.machinePicker[key];
                expect(value).toBeDefined();
                expect(['string', 'function']).toContain(typeof value);
            }

            for (const key of newSessionPathPickerKeys) {
                const value = translation.newSession.pathPicker[key];
                expect(value).toBeDefined();
                expect(['string', 'function']).toContain(typeof value);
            }

            for (const key of newSessionProfileSectionKeys) {
                const value = translation.newSession.profileSection[key];
                expect(value).toBeDefined();
                expect(['string', 'function']).toContain(typeof value);
            }

            for (const key of newSessionWizardKeys) {
                const value = translation.newSession.wizard[key];
                expect(value).toBeDefined();
                expect(['string', 'function']).toContain(typeof value);
            }

            for (const key of newSessionWizardBuiltInProfileKeys) {
                const value = translation.newSession.wizardBuiltInProfiles[key];
                expect(value).toBeDefined();
                expect(['string', 'function']).toContain(typeof value);
            }

            for (const key of newSessionWizardProfileKeys) {
                const value = translation.newSession.wizardProfile[key];
                expect(value).toBeDefined();
                expect(['string', 'function']).toContain(typeof value);
            }

            for (const key of newSessionWizardProfileConfigKeys) {
                const value = translation.newSession.wizardProfileConfig[key];
                expect(value).toBeDefined();
                expect(['string', 'function']).toContain(typeof value);
            }

            for (const key of newSessionWizardBackendKeys) {
                const value = translation.newSession.wizardBackends[key];
                expect(value).toBeDefined();
                expect(['string', 'function']).toContain(typeof value);
            }

            for (const key of newSessionWizardAgentKeys) {
                const value = translation.newSession.wizardAgent[key];
                expect(value).toBeDefined();
                expect(['string', 'function']).toContain(typeof value);
            }

            for (const key of newSessionWizardOptionsKeys) {
                const value = translation.newSession.wizardOptions[key];
                expect(value).toBeDefined();
                expect(['string', 'function']).toContain(typeof value);
            }

            for (const key of newSessionWizardPathKeys) {
                const value = translation.newSession.wizardPath[key];
                expect(value).toBeDefined();
                expect(['string', 'function']).toContain(typeof value);
            }
        }
    });

    it('renders the new dynamic machine and welcome translations with expected parameters', () => {
        const directory = '/tmp/hello-vibe';
        const reason = 'rpc unavailable';

        for (const translation of Object.values(runtimeTranslations)) {
            expect(translation.machine.createDirectoryMessage({ directory })).toContain(directory);
            expect(translation.welcome.createAccountFailedWithReason({ reason })).toContain(reason);
            expect(translation.newSession.profileSection.cliLabel({ agents: 'Claude / Codex' })).toContain('Claude / Codex');
            expect(translation.newSession.profileSection.requiresAgentOnly({ agent: 'Claude' })).toContain('Claude');
            expect(translation.newSession.profileSection.cliNotDetected({ agent: 'Codex' })).toContain('Codex');
            expect(translation.newSession.wizard.duplicateProfilePromptMessage({ name: 'Demo Profile' })).toContain('Demo Profile');
            expect(translation.newSession.wizard.duplicateProfileDefaultName({ name: 'Demo Profile' })).toContain('Demo Profile');
            expect(translation.newSession.wizard.copyOfProfileDescription({ description: 'OpenAI GPT-4 profile' })).toContain('OpenAI GPT-4 profile');
            expect(translation.newSession.wizardProfileConfig.title({ name: 'OpenAI' })).toContain('OpenAI');
            expect(translation.newSession.wizardAgent.selectedProfileLabel({ name: 'DeepSeek' })).toContain('DeepSeek');
            expect(translation.newSession.wizardOptions.usingProfileLabel({ name: 'Claude Default' })).toContain('Claude Default');
            expect(translation.profiles.delete.message({ name: 'Demo Profile' })).toContain('Demo Profile');
            expect(translation.profiles.valueFound({ value: 'abc123' })).toContain('abc123');
            expect(translation.profiles.differsFromDocumentedValue({ value: 'claude-3-7' })).toContain('claude-3-7');
            expect(translation.profiles.overridingDocumentedDefault({ value: 'codex-mini' })).toContain('codex-mini');
            expect(translation.profiles.sessionWillReceive({ variableName: 'Z_AI_MODEL', value: 'claude-sonnet' })).toContain('Z_AI_MODEL');
            expect(translation.profiles.sessionWillReceive({ variableName: 'Z_AI_MODEL', value: 'claude-sonnet' })).toContain('claude-sonnet');
            expect(translation.machine.multipleMachines({ count: 3 })).toContain('3');
        }
    });

    it('keeps machine detail screen wired to translation keys instead of hardcoded copy', () => {
        const source = fs.readFileSync(new URL('../app/(app)/machine/[id].tsx', import.meta.url), 'utf8');

        expectSourceToUseTranslations(source, requiredMachineUsages, forbiddenMachineLiterals);
    });

    it('keeps restore screens wired to translation keys instead of hardcoded copy', () => {
        const restoreIndexSource = fs.readFileSync(new URL('../app/(app)/restore/index.tsx', import.meta.url), 'utf8');
        const restoreManualSource = fs.readFileSync(new URL('../app/(app)/restore/manual.tsx', import.meta.url), 'utf8');

        expectSourceToUseTranslations(restoreIndexSource, requiredRestoreIndexUsages, forbiddenRestoreIndexLiterals);
        expectSourceToUseTranslations(restoreManualSource, requiredRestoreManualUsages, forbiddenRestoreManualLiterals);
    });

    it('keeps new-session machine and path flows wired to translation keys', () => {
        const newSessionSource = fs.readFileSync(new URL('../app/(app)/new/index.tsx', import.meta.url), 'utf8');
        const newSessionMachinePickerSource = fs.readFileSync(new URL('../app/(app)/new/pick/machine.tsx', import.meta.url), 'utf8');
        const newSessionPathPickerSource = fs.readFileSync(new URL('../app/(app)/new/pick/path.tsx', import.meta.url), 'utf8');
        const newSessionWizardSource = fs.readFileSync(new URL('../components/NewSessionWizard.tsx', import.meta.url), 'utf8');
        const emptySessionsTabletSource = fs.readFileSync(new URL('../components/EmptySessionsTablet.tsx', import.meta.url), 'utf8');
        const activeSessionsGroupSource = fs.readFileSync(new URL('../components/ActiveSessionsGroup.tsx', import.meta.url), 'utf8');
        const activeSessionsGroupCompactSource = fs.readFileSync(new URL('../components/ActiveSessionsGroupCompact.tsx', import.meta.url), 'utf8');
        const searchableListSelectorSource = fs.readFileSync(new URL('../components/SearchableListSelector.tsx', import.meta.url), 'utf8');
        const usageChartSource = fs.readFileSync(new URL('../components/usage/UsageChart.tsx', import.meta.url), 'utf8');
        const mermaidRendererSource = fs.readFileSync(new URL('../components/markdown/MermaidRenderer.tsx', import.meta.url), 'utf8');
        const markdownViewSource = fs.readFileSync(new URL('../components/markdown/MarkdownView.tsx', import.meta.url), 'utf8');
        const profileEditSource = fs.readFileSync(new URL('../app/(app)/new/pick/profile-edit.tsx', import.meta.url), 'utf8');
        const profileEditFormSource = fs.readFileSync(new URL('../components/ProfileEditForm.tsx', import.meta.url), 'utf8');
        const environmentVariablesListSource = fs.readFileSync(new URL('../components/EnvironmentVariablesList.tsx', import.meta.url), 'utf8');
        const environmentVariableCardSource = fs.readFileSync(new URL('../components/EnvironmentVariableCard.tsx', import.meta.url), 'utf8');
        const useHappyActionSource = fs.readFileSync(new URL('../hooks/useHappyAction.ts', import.meta.url), 'utf8');

        expectSourceToUseTranslations(newSessionSource, requiredNewSessionIndexUsages, forbiddenNewSessionIndexLiterals);
        expectSourceToUseTranslations(newSessionMachinePickerSource, requiredNewSessionMachinePickerUsages, forbiddenNewSessionMachinePickerLiterals);
        expectSourceToUseTranslations(newSessionPathPickerSource, requiredNewSessionPathPickerUsages, forbiddenNewSessionPathPickerLiterals);
        expectSourceToUseTranslations(newSessionWizardSource, requiredNewSessionWizardUsages, forbiddenNewSessionWizardLiterals);
        expectSourceToUseTranslations(emptySessionsTabletSource, requiredEmptySessionsTabletUsages, forbiddenEmptySessionsTabletLiterals);
        expectSourceToUseTranslations(activeSessionsGroupSource, requiredActiveSessionsGroupUsages, forbiddenActiveSessionsGroupLiterals);
        expectSourceToUseTranslations(activeSessionsGroupCompactSource, requiredActiveSessionsGroupCompactUsages, forbiddenActiveSessionsGroupLiterals);
        expectSourceToUseTranslations(searchableListSelectorSource, requiredSearchableListSelectorUsages, forbiddenSearchableListSelectorLiterals);
        expectSourceToUseTranslations(usageChartSource, requiredUsageChartUsages, forbiddenUsageChartLiterals);
        expectSourceToUseTranslations(mermaidRendererSource, requiredMermaidRendererUsages, forbiddenMermaidRendererLiterals);
        expectSourceToUseTranslations(markdownViewSource, requiredMarkdownViewUsages, forbiddenMarkdownViewLiterals);
        expectSourceToUseTranslations(profileEditSource, requiredProfileEditScreenUsages);
        expectSourceToUseTranslations(profileEditFormSource, requiredProfileEditFormUsages, forbiddenProfileEditFormLiterals);
        expectSourceToUseTranslations(environmentVariablesListSource, requiredEnvironmentVariablesListUsages, forbiddenEnvironmentVariablesListLiterals);
        expectSourceToUseTranslations(environmentVariableCardSource, requiredEnvironmentVariableCardUsages, forbiddenEnvironmentVariableCardLiterals);
        expectSourceToUseTranslations(useHappyActionSource, requiredUseHappyActionUsages, forbiddenUseHappyActionLiterals);
    });

    it('keeps welcome, settings, and terminal-related screens wired to translation keys', () => {
        const welcomeSource = fs.readFileSync(new URL('../app/(app)/index.tsx', import.meta.url), 'utf8');
        const settingsSource = fs.readFileSync(new URL('../components/SettingsView.tsx', import.meta.url), 'utf8');
        const settingsLanguageSource = fs.readFileSync(new URL('../app/(app)/settings/language.tsx', import.meta.url), 'utf8');
        const settingsAccountSource = fs.readFileSync(new URL('../app/(app)/settings/account.tsx', import.meta.url), 'utf8');
        const settingsAppearanceSource = fs.readFileSync(new URL('../app/(app)/settings/appearance.tsx', import.meta.url), 'utf8');
        const settingsVoiceSource = fs.readFileSync(new URL('../app/(app)/settings/voice.tsx', import.meta.url), 'utf8');
        const terminalConnectSource = fs.readFileSync(new URL('../app/(app)/terminal/connect.tsx', import.meta.url), 'utf8');

        expectSourceToUseTranslations(welcomeSource, requiredWelcomeUsages, forbiddenWelcomeLiterals);
        expectSourceToUseTranslations(settingsSource, requiredSettingsUsages);
        expectSourceToUseTranslations(settingsLanguageSource, [
            "t('settingsLanguage.automatic')",
            "t('settingsLanguage.automaticSubtitle')",
        ]);
        expectSourceToUseTranslations(settingsAccountSource, requiredSettingsAccountUsages);
        expectSourceToUseTranslations(settingsAppearanceSource, requiredSettingsAppearanceUsages);
        expectSourceToUseTranslations(settingsVoiceSource, requiredSettingsVoiceUsages, forbiddenSettingsVoiceLiterals);
        expectSourceToUseTranslations(terminalConnectSource, requiredTerminalConnectUsages, forbiddenTerminalConnectLiterals);
    });
});
