import { describe, expect, it } from 'vitest';
import {
    getAvailableModels,
    getAvailablePermissionModes,
    getCodexModelModes,
    getClaudePermissionModes,
    getDefaultModelKey,
    mapMetadataOptions,
    normalizeStoredModelKey,
    resolveCurrentOption,
} from './modelModeOptions';

const translate = (key: string) => `tr:${key}`;

describe('modelModeOptions', () => {
    it('maps metadata option shape into mode options', () => {
        expect(mapMetadataOptions([
            { code: 'm1', value: 'Model One', description: 'Primary model' },
            { code: 'm2', value: 'Model Two' },
        ])).toEqual([
            { key: 'm1', name: 'Model One', description: 'Primary model' },
            { key: 'm2', name: 'Model Two', description: null },
        ]);
    });

    it('builds claude permission fallbacks with translated names', () => {
        const modes = getClaudePermissionModes(translate);
        expect(modes.map((mode) => mode.key)).toEqual(['default', 'acceptEdits', 'plan', 'bypassPermissions']);
        expect(modes[0].name).toBe('tr:agentInput.permissionMode.default');
    });

    it('builds codex model fallbacks with translated labels', () => {
        const models = getCodexModelModes(translate);
        expect(models.map((model) => model.key)).toEqual([
            'default',
            'gpt-5-codex-high',
            'gpt-5-codex-medium',
            'gpt-5-codex-low',
            'gpt-5-minimal',
            'gpt-5-low',
            'gpt-5-medium',
            'gpt-5-high',
        ]);
        expect(models[0]).toEqual({
            key: 'default',
            name: 'tr:newSession.wizardOptions.defaultLabel',
            description: 'tr:agentInput.model.configureInCli',
        });
    });

    it('keeps the default model option ahead of metadata-provided models', () => {
        const models = getAvailableModels('gemini', {
            models: [
                { code: 'custom-gemini', value: 'Gemini Custom', description: 'From metadata' },
            ],
        } as any, translate);

        expect(models).toEqual([
            { key: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Most capable' },
            { key: 'custom-gemini', name: 'Gemini Custom', description: 'From metadata' },
        ]);
    });

    it('keeps the codex default option when metadata exposes the effective model', () => {
        const models = getAvailableModels('codex', {
            models: [
                { code: 'gpt-5.3-codex', value: 'gpt-5.3-codex', description: 'Effective CLI model' },
            ],
        } as any, translate);

        expect(models).toEqual([
            {
                key: 'default',
                name: 'tr:newSession.wizardOptions.defaultLabel',
                description: 'tr:agentInput.model.configureInCli',
            },
            { key: 'gpt-5.3-codex', name: 'gpt-5.3-codex', description: 'Effective CLI model' },
        ]);
    });

    it('keeps codex permission modes hardcoded even when metadata modes exist', () => {
        const modes = getAvailablePermissionModes('codex', {
            operatingModes: [{ code: 'metadata-only', value: 'Metadata Mode', description: null }],
        } as any, translate);

        expect(modes.map((mode) => mode.key)).toEqual(['default', 'read-only', 'safe-yolo', 'yolo']);
    });

    it('keeps OpenCode on CLI-configured default modes before catalog work starts', () => {
        expect(getAvailableModels('opencode', null, translate)).toEqual([
            {
                key: 'default',
                name: 'tr:newSession.wizardOptions.defaultLabel',
                description: 'tr:agentInput.model.configureInCli',
            },
        ]);
        expect(getAvailablePermissionModes('opencode', null, translate)).toEqual([
            {
                key: 'default',
                name: 'tr:agentInput.permissionMode.default',
                description: null,
            },
        ]);
    });

    it('applies hacks to metadata-provided operating modes', () => {
        const modes = getAvailablePermissionModes('gemini', {
            operatingModes: [
                { code: 'build', value: 'build, build', description: 'Do build steps' },
                { code: 'plan', value: 'plan/plan', description: 'Plan first' },
            ],
        } as any, translate);

        expect(modes).toEqual([
            { key: 'build', name: 'Build', description: 'Do build steps' },
            { key: 'plan', name: 'Plan', description: 'Plan first' },
        ]);
    });

    it('resolves the first matching preferred key', () => {
        const options = [
            { key: 'a', name: 'A' },
            { key: 'b', name: 'B' },
        ];

        expect(resolveCurrentOption(options, ['missing', 'b', 'a'])).toEqual({ key: 'b', name: 'B' });
        expect(resolveCurrentOption(options, ['missing'])).toBeNull();
    });

    it('defaults codex sessions to CLI-configured model routing', () => {
        expect(getDefaultModelKey('codex')).toBe('default');
    });

    it('normalizes the legacy codex default model to the new default option', () => {
        expect(normalizeStoredModelKey('codex', 'gpt-5-codex-high')).toBe('default');
        expect(normalizeStoredModelKey('codex', 'gpt-5.3-codex-high')).toBe('gpt-5.3-codex-high');
    });
});
