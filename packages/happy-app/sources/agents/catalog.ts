export const allNewSessionAgentTypes = ['claude', 'codex', 'opencode', 'gemini'] as const;

export type NewSessionAgentType = typeof allNewSessionAgentTypes[number];

export type AgentFlavor = NewSessionAgentType | 'gpt' | 'openai';

export type AgentAvailabilityRecord<T> = Record<NewSessionAgentType, T>;

type Translate = (key: any) => string;

type AgentCatalogEntry = {
    id: NewSessionAgentType;
    detectionCommand: string;
    displayNameKey?: string;
    fallbackDisplayName: string;
    experimental?: boolean;
    supportsResume: boolean;
    supportsModelMode: boolean;
    supportsMetadataPermissionModes: boolean;
};

const agentCatalog: Record<NewSessionAgentType, AgentCatalogEntry> = {
    claude: {
        id: 'claude',
        detectionCommand: 'claude',
        displayNameKey: 'agentInput.agent.claude',
        fallbackDisplayName: 'Claude',
        supportsResume: true,
        supportsModelMode: true,
        supportsMetadataPermissionModes: false,
    },
    codex: {
        id: 'codex',
        detectionCommand: 'codex',
        displayNameKey: 'agentInput.agent.codex',
        fallbackDisplayName: 'Codex',
        supportsResume: false,
        supportsModelMode: true,
        supportsMetadataPermissionModes: false,
    },
    opencode: {
        id: 'opencode',
        detectionCommand: 'opencode',
        fallbackDisplayName: 'OpenCode',
        supportsResume: false,
        supportsModelMode: true,
        supportsMetadataPermissionModes: true,
    },
    gemini: {
        id: 'gemini',
        detectionCommand: 'gemini',
        displayNameKey: 'agentInput.agent.gemini',
        fallbackDisplayName: 'Gemini',
        experimental: true,
        supportsResume: false,
        supportsModelMode: true,
        supportsMetadataPermissionModes: true,
    },
};

export function isNewSessionAgentType(value: unknown): value is NewSessionAgentType {
    return typeof value === 'string' && allNewSessionAgentTypes.includes(value as NewSessionAgentType);
}

export function getSelectableNewSessionAgents(experimentsEnabled: boolean): NewSessionAgentType[] {
    return allNewSessionAgentTypes.filter((agent) => experimentsEnabled || !agentCatalog[agent].experimental);
}

export function normalizeNewSessionAgent(value: unknown, experimentsEnabled: boolean): NewSessionAgentType {
    if (!isNewSessionAgentType(value)) {
        return 'claude';
    }
    if (agentCatalog[value].experimental && !experimentsEnabled) {
        return 'claude';
    }
    return value;
}

export function createAgentAvailabilityRecord<T>(factory: (agent: NewSessionAgentType) => T): AgentAvailabilityRecord<T> {
    return Object.fromEntries(
        allNewSessionAgentTypes.map((agent) => [agent, factory(agent)])
    ) as AgentAvailabilityRecord<T>;
}

export function getAgentDisplayName(agent: NewSessionAgentType, translate?: Translate): string {
    const entry = agentCatalog[agent];
    if (entry.displayNameKey && translate) {
        return translate(entry.displayNameKey);
    }
    return entry.fallbackDisplayName;
}

export function normalizeAgentFlavor(flavor: unknown): NewSessionAgentType | null {
    if (!flavor || typeof flavor !== 'string') {
        return null;
    }
    if (isNewSessionAgentType(flavor)) {
        return flavor;
    }
    if (flavor === 'gpt' || flavor === 'openai') {
        return 'codex';
    }
    return null;
}

export function getAgentDisplayNameForFlavor(flavor: unknown, translate?: Translate): string | null {
    const normalizedFlavor = normalizeAgentFlavor(flavor);
    if (!normalizedFlavor) {
        return null;
    }
    return getAgentDisplayName(normalizedFlavor, translate);
}

export function getAgentDetectionCommand(): string {
    return allNewSessionAgentTypes
        .map((agent) => `(command -v ${agentCatalog[agent].detectionCommand} >/dev/null 2>&1 && echo "${agent}:true" || echo "${agent}:false")`)
        .join(' && ');
}

export function parseAgentDetectionOutput(stdout: string): AgentAvailabilityRecord<boolean | null> {
    const availability = createAgentAvailabilityRecord<boolean | null>(() => null);
    for (const line of stdout.trim().split('\n')) {
        const [agent, status] = line.split(':');
        if (!isNewSessionAgentType(agent) || !status) {
            continue;
        }
        availability[agent] = status.trim() === 'true';
    }
    return availability;
}

export function getCompatibleAgentTypes(compatibility: Partial<Record<NewSessionAgentType, boolean>>): NewSessionAgentType[] {
    return allNewSessionAgentTypes.filter((agent) => compatibility[agent] === true);
}

export function agentSupportsMetadataPermissionModes(agent: NewSessionAgentType): boolean {
    return agentCatalog[agent].supportsMetadataPermissionModes;
}

export function agentSupportsResume(agent: NewSessionAgentType): boolean {
    return agentCatalog[agent].supportsResume;
}
