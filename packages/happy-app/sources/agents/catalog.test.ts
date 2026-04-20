import { describe, expect, it } from 'vitest';
import {
    agentSupportsMetadataPermissionModes,
    createAgentAvailabilityRecord,
    getAgentDetectionCommand,
    getAgentDisplayName,
    getAgentDisplayNameForFlavor,
    getCompatibleAgentTypes,
    getSelectableNewSessionAgents,
    normalizeAgentFlavor,
    normalizeNewSessionAgent,
    parseAgentDetectionOutput,
} from './catalog';

const translate = (key: string) => `tr:${key}`;

describe('agent catalog', () => {
    it('returns experiment-gated selectable agents in catalog order', () => {
        expect(getSelectableNewSessionAgents(false)).toEqual(['claude', 'codex', 'opencode']);
        expect(getSelectableNewSessionAgents(true)).toEqual(['claude', 'codex', 'opencode', 'gemini']);
    });

    it('normalizes unsupported or gated agents back to claude', () => {
        expect(normalizeNewSessionAgent('gemini', false)).toBe('claude');
        expect(normalizeNewSessionAgent('unknown', true)).toBe('claude');
        expect(normalizeNewSessionAgent('opencode', true)).toBe('opencode');
    });

    it('builds CLI detection command from the catalog', () => {
        expect(getAgentDetectionCommand()).toContain('command -v claude');
        expect(getAgentDetectionCommand()).toContain('command -v opencode');
        expect(getAgentDetectionCommand()).toContain('command -v gemini');
    });

    it('parses CLI detection output into a full availability record', () => {
        expect(parseAgentDetectionOutput('claude:true\ncodex:false\nopencode:true\ngemini:false')).toEqual({
            claude: true,
            codex: false,
            opencode: true,
            gemini: false,
        });
    });

    it('creates typed availability records for all supported agents', () => {
        expect(createAgentAvailabilityRecord((agent) => agent.toUpperCase())).toEqual({
            claude: 'CLAUDE',
            codex: 'CODEX',
            opencode: 'OPENCODE',
            gemini: 'GEMINI',
        });
    });

    it('derives compatible agent ids without relying on Object.entries order', () => {
        expect(getCompatibleAgentTypes({
            claude: false,
            codex: true,
            gemini: false,
            opencode: true,
        })).toEqual(['codex', 'opencode']);
    });

    it('exposes display-name and capability helpers for shared UI decisions', () => {
        expect(getAgentDisplayName('claude', translate)).toBe('tr:agentInput.agent.claude');
        expect(getAgentDisplayName('opencode', translate)).toBe('OpenCode');
        expect(normalizeAgentFlavor('openai')).toBe('codex');
        expect(normalizeAgentFlavor('unknown')).toBeNull();
        expect(getAgentDisplayNameForFlavor('gpt', translate)).toBe('tr:agentInput.agent.codex');
        expect(getAgentDisplayNameForFlavor('mystery-agent', translate)).toBeNull();
        expect(agentSupportsMetadataPermissionModes('claude')).toBe(false);
        expect(agentSupportsMetadataPermissionModes('opencode')).toBe(true);
    });
});
