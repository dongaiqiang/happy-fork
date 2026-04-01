import { describe, expect, it } from 'vitest';
import { formatRemoteHistoryEntries } from './claudeRemoteLauncher';

describe('formatRemoteHistoryEntries', () => {
    it('formats direct session envelopes into readable history blocks', () => {
        const entries = formatRemoteHistoryEntries([
            {
                body: {
                    role: 'session',
                    content: {
                        id: 'env-user-1',
                        time: 1,
                        role: 'user',
                        ev: { t: 'text', text: '今天周几' }
                    },
                    meta: { sentFrom: 'cli' }
                }
            },
            {
                body: {
                    role: 'session',
                    content: {
                        id: 'env-agent-1',
                        time: 2,
                        role: 'agent',
                        turn: 'turn-1',
                        ev: { t: 'text', text: '今天是星期三。' }
                    },
                    meta: { sentFrom: 'cli' }
                }
            }
        ]);

        expect(entries).toEqual([
            { type: 'user', content: 'You\n今天周几' },
            { type: 'assistant', content: 'Claude\n今天是星期三。' }
        ]);
    });

    it('formats legacy assistant output and tool calls into cleaner blocks', () => {
        const entries = formatRemoteHistoryEntries([
            {
                body: {
                    role: 'agent',
                    content: {
                        type: 'output',
                        data: {
                            type: 'assistant',
                            uuid: 'assistant-1',
                            message: {
                                content: [
                                    { type: 'text', text: '我来创建目录。' },
                                    { type: 'tool_use', name: 'Bash', input: { command: 'mkdir t00' } }
                                ]
                            }
                        }
                    }
                }
            }
        ]);

        expect(entries[0]).toEqual({
            type: 'assistant',
            content: 'Claude\n我来创建目录。'
        });
        expect(entries[1]).toEqual({
            type: 'tool',
            content: 'Tool · Bash\n{\n  "command": "mkdir t00"\n}'
        });
    });
});
