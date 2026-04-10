import type { Metadata } from '@/sync/storageTypes';
import { hackModes } from '@/sync/modeHacks';

export type ModeOption = {
    key: string;
    name: string;
    description?: string | null;
};

export type PermissionMode = ModeOption;
export type ModelMode = ModeOption;

export type PermissionModeKey = string;
export type ModelModeKey = string;

export type AgentFlavor = 'claude' | 'codex' | 'gemini' | string | null | undefined;

type Translate = (key: any) => string;

type MetadataOption = {
    code: string;
    value: string;
    description?: string | null;
};

const GEMINI_MODEL_FALLBACKS: ModelMode[] = [
    { key: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Most capable' },
    { key: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast & efficient' },
    { key: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: 'Fastest' },
];

export function mapMetadataOptions(options?: MetadataOption[] | null): ModeOption[] {
    if (!options || options.length === 0) {
        return [];
    }

    return options.map((option) => ({
        key: option.code,
        name: option.value,
        description: option.description ?? null,
    }));
}

export function getClaudePermissionModes(translate: Translate): PermissionMode[] {
    return [
        { key: 'default', name: translate('agentInput.permissionMode.default'), description: null },
        { key: 'acceptEdits', name: translate('agentInput.permissionMode.acceptEdits'), description: null },
        { key: 'plan', name: translate('agentInput.permissionMode.plan'), description: null },
        { key: 'bypassPermissions', name: translate('agentInput.permissionMode.bypassPermissions'), description: null },
    ];
}

export function getCodexPermissionModes(translate: Translate): PermissionMode[] {
    return [
        { key: 'default', name: translate('agentInput.codexPermissionMode.default'), description: null },
        { key: 'read-only', name: translate('agentInput.codexPermissionMode.readOnly'), description: null },
        { key: 'safe-yolo', name: translate('agentInput.codexPermissionMode.safeYolo'), description: null },
        { key: 'yolo', name: translate('agentInput.codexPermissionMode.yolo'), description: null },
    ];
}

export function getGeminiPermissionModes(translate: Translate): PermissionMode[] {
    return [
        { key: 'default', name: translate('agentInput.geminiPermissionMode.default'), description: null },
        { key: 'read-only', name: translate('agentInput.geminiPermissionMode.readOnly'), description: null },
        { key: 'safe-yolo', name: translate('agentInput.geminiPermissionMode.safeYolo'), description: null },
        { key: 'yolo', name: translate('agentInput.geminiPermissionMode.yolo'), description: null },
    ];
}

export function getOpenCodePermissionModes(translate: Translate): PermissionMode[] {
    return [
        { key: 'default', name: translate('agentInput.permissionMode.default'), description: null },
    ];
}

export function getClaudeModelModes(): ModelMode[] {
    return [
        { key: 'default', name: 'Default', description: 'Use CLI settings' },
        { key: 'adaptiveUsage', name: 'Adaptive Usage', description: 'Balanced model routing' },
        { key: 'sonnet', name: 'Sonnet', description: 'Fast and capable' },
        { key: 'opus', name: 'Opus', description: 'Most capable' },
    ];
}

export function getCodexModelModes(translate: Translate): ModelMode[] {
    return [
        { key: 'default', name: translate('newSession.wizardOptions.defaultLabel'), description: translate('agentInput.model.configureInCli') },
        { key: 'gpt-5-codex-high', name: translate('agentInput.codexModel.gpt5CodexHigh'), description: null },
        { key: 'gpt-5-codex-medium', name: translate('agentInput.codexModel.gpt5CodexMedium'), description: null },
        { key: 'gpt-5-codex-low', name: translate('agentInput.codexModel.gpt5CodexLow'), description: null },
        { key: 'gpt-5-minimal', name: translate('agentInput.codexModel.gpt5Minimal'), description: null },
        { key: 'gpt-5-low', name: translate('agentInput.codexModel.gpt5Low'), description: null },
        { key: 'gpt-5-medium', name: translate('agentInput.codexModel.gpt5Medium'), description: null },
        { key: 'gpt-5-high', name: translate('agentInput.codexModel.gpt5High'), description: null },
    ];
}

export function getGeminiModelModes(): ModelMode[] {
    return GEMINI_MODEL_FALLBACKS;
}

export function getOpenCodeModelModes(translate: Translate): ModelMode[] {
    return [
        { key: 'default', name: translate('newSession.wizardOptions.defaultLabel'), description: translate('agentInput.model.configureInCli') },
    ];
}

export function getHardcodedPermissionModes(flavor: AgentFlavor, translate: Translate): PermissionMode[] {
    if (flavor === 'codex') {
        return getCodexPermissionModes(translate);
    }
    if (flavor === 'gemini') {
        return getGeminiPermissionModes(translate);
    }
    if (flavor === 'opencode') {
        return getOpenCodePermissionModes(translate);
    }
    return getClaudePermissionModes(translate);
}

export function getHardcodedModelModes(flavor: AgentFlavor, translate: Translate): ModelMode[] {
    if (flavor === 'codex') {
        return getCodexModelModes(translate);
    }
    if (flavor === 'gemini') {
        return getGeminiModelModes();
    }
    if (flavor === 'opencode') {
        return getOpenCodeModelModes(translate);
    }
    return getClaudeModelModes();
}

export function getAvailableModels(
    flavor: AgentFlavor,
    metadata: Metadata | null | undefined,
    translate: Translate,
): ModelMode[] {
    const hardcodedModels = getHardcodedModelModes(flavor, translate);
    const metadataModels = mapMetadataOptions(metadata?.models);
    if (metadataModels.length === 0) {
        return hardcodedModels;
    }

    const defaultModelKey = getDefaultModelKey(flavor);
    const defaultModelOption = hardcodedModels.find((option) => option.key === defaultModelKey);
    if (!defaultModelOption || metadataModels.some((option) => option.key === defaultModelKey)) {
        return metadataModels;
    }

    return [defaultModelOption, ...metadataModels];
}

export function getAvailablePermissionModes(
    flavor: AgentFlavor,
    metadata: Metadata | null | undefined,
    translate: Translate,
): PermissionMode[] {
    if (flavor === 'claude' || flavor === 'codex') {
        return hackModes(getHardcodedPermissionModes(flavor, translate));
    }

    const metadataModes = mapMetadataOptions(metadata?.operatingModes);
    if (metadataModes.length > 0) {
        return hackModes(metadataModes);
    }

    return hackModes(getHardcodedPermissionModes(flavor, translate));
}

export function findOptionByKey<T extends ModeOption>(options: T[], key: string | null | undefined): T | null {
    if (!key) {
        return null;
    }
    return options.find((option) => option.key === key) ?? null;
}

export function resolveCurrentOption<T extends ModeOption>(
    options: T[],
    preferredKeys: Array<string | null | undefined>,
): T | null {
    for (const key of preferredKeys) {
        const option = findOptionByKey(options, key);
        if (option) {
            return option;
        }
    }
    return null;
}

export function normalizeStoredModelKey(flavor: AgentFlavor, key: string | null | undefined): string | null | undefined {
    if (flavor === 'codex' && key === 'gpt-5-codex-high') {
        return 'default';
    }
    return key;
}

export function getDefaultModelKey(flavor: AgentFlavor): string {
    if (flavor === 'codex') {
        return 'default';
    }
    if (flavor === 'gemini') {
        return 'gemini-2.5-pro';
    }
    return 'default';
}

export function getDefaultPermissionModeKey(_flavor: AgentFlavor): string {
    return 'default';
}
