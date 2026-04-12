import { describe, expect, it } from 'vitest';
import {
    appendStreamingAsrText,
    buildStreamingAsrRoundText,
    mergeStreamingDraft,
    polishStreamingAsrFinalText,
    shouldPreferContinueAction,
    shouldShowStreamingSendAction,
    upsertStreamingAsrSegment
} from './streamingAsrDraft';

describe('appendStreamingAsrText', () => {
    it('deduplicates overlapping realtime fragments', () => {
        expect(appendStreamingAsrText('你好世界', '世界继续')).toBe('你好世界继续');
    });

    it('replaces empty base with incoming text', () => {
        expect(appendStreamingAsrText('', '新的句子')).toBe('新的句子');
    });

    it('keeps punctuation updates without repeating the same spoken phrase', () => {
        expect(
            appendStreamingAsrText(
                '今天下午我要整理需求然后继续测试语音输入',
                '，然后继续测试语音输入。'
            )
        ).toBe('今天下午我要整理需求，然后继续测试语音输入。');
    });

    it('prefers the latest fragment when the sentence head is corrected and re-emitted', () => {
        expect(
            appendStreamingAsrText(
                '今年下午我要整理',
                '今天下午我要整理需求'
            )
        ).toBe('今天下午我要整理需求');
    });

    it('replaces a partial tail when the recognizer corrects the middle of the same sentence', () => {
        expect(
            appendStreamingAsrText(
                '然后继续测试严',
                '然后继续测试语音输入'
            )
        ).toBe('然后继续测试语音输入');
    });

    it('replaces the same sentence when filler words and punctuation are inserted during correction', () => {
        expect(
            appendStreamingAsrText(
                '你想想系统还有哪些需要优化的地方',
                '你想想啊，系统还有哪些需要优化的地方？'
            )
        ).toBe('你想想啊，系统还有哪些需要优化的地方？');
    });
});

describe('mergeStreamingDraft', () => {
    it('preserves existing draft when appending new realtime text', () => {
        expect(mergeStreamingDraft('已有草稿：', '继续补充')).toBe('已有草稿：继续补充');
    });

    it('adds a space between ascii words when continuing the same draft', () => {
        expect(mergeStreamingDraft('hello', 'world')).toBe('hello world');
    });

    it('keeps overlapped text from being duplicated across rounds', () => {
        expect(mergeStreamingDraft('第一句第二句', '第二句继续')).toBe('第一句第二句继续');
    });
});

describe('polishStreamingAsrFinalText', () => {
    it('adds sentence-ending punctuation when the final result has none', () => {
        expect(polishStreamingAsrFinalText('今天下午我要整理需求然后继续测试语音输入')).toBe('今天下午我要整理需求然后继续测试语音输入。');
    });

    it('normalizes punctuation and spacing for chinese final text', () => {
        expect(polishStreamingAsrFinalText('你想想啊 , 系统还有哪些需要优化的地方 ?')).toBe('你想想啊，系统还有哪些需要优化的地方？');
    });

    it('turns a trailing semicolon into a full stop for the final utterance', () => {
        expect(polishStreamingAsrFinalText('今天下午我要整理需求；')).toBe('今天下午我要整理需求。');
    });

    it('keeps a question ending for modal chinese endings', () => {
        expect(polishStreamingAsrFinalText('这个还能继续优化吗')).toBe('这个还能继续优化吗？');
    });
});

describe('streaming round segments', () => {
    it('keeps earlier sentence fragments when a later sentence is dynamically replaced', () => {
        let segments = new Map<number, string>();

        segments = upsertStreamingAsrSegment(segments, 1, '第一句', 'apd');
        segments = upsertStreamingAsrSegment(segments, 2, '第二', 'apd');
        segments = upsertStreamingAsrSegment(segments, 2, '第二句', 'rpl');

        expect(buildStreamingAsrRoundText(segments)).toBe('第一句第二句');
    });

    it('appends repeated fragments for the same sentence without duplicating overlap', () => {
        let segments = new Map<number, string>();

        segments = upsertStreamingAsrSegment(segments, 3, '继续', 'apd');
        segments = upsertStreamingAsrSegment(segments, 3, '继续补充', 'apd');

        expect(buildStreamingAsrRoundText(segments)).toBe('继续补充');
    });

    it('replaces the target sentence range when rg is provided for rpl updates', () => {
        let segments = new Map<number, string>();

        segments = upsertStreamingAsrSegment(segments, 1, '今天下午我要整理需求', 'apd');
        segments = upsertStreamingAsrSegment(segments, 2, '然后继续测试语音输入', 'apd');
        segments = upsertStreamingAsrSegment(segments, 3, '然后继续测试语音输入。', 'rpl', [2, 3]);

        expect(buildStreamingAsrRoundText(segments)).toBe('今天下午我要整理需求然后继续测试语音输入。');
    });

    it('does not duplicate a sentence when a later replacement only adds punctuation before it', () => {
        const segments = new Map<number, string>([
            [1, '今天下午我要整理需求然后继续测试语音输入'],
            [3, '，然后继续测试语音输入。']
        ]);

        expect(buildStreamingAsrRoundText(segments)).toBe('今天下午我要整理需求，然后继续测试语音输入。');
    });

    it('replaces the same sentence when the recognizer corrects the first few characters', () => {
        let segments = new Map<number, string>();

        segments = upsertStreamingAsrSegment(segments, 1, '今年下午我要整理', 'apd');
        segments = upsertStreamingAsrSegment(segments, 1, '今天下午我要整理需求', 'apd');

        expect(buildStreamingAsrRoundText(segments)).toBe('今天下午我要整理需求');
    });

    it('keeps the full utterance clean when the first sentence is corrected before the second sentence arrives', () => {
        let segments = new Map<number, string>();

        segments = upsertStreamingAsrSegment(segments, 1, '今年下午我要整理', 'apd');
        segments = upsertStreamingAsrSegment(segments, 1, '今天下午我要整理需求', 'apd');
        segments = upsertStreamingAsrSegment(segments, 2, '然后继续测试语音输入', 'apd');
        segments = upsertStreamingAsrSegment(segments, 3, '，然后继续测试语音输入。', 'rpl', [2, 3]);

        expect(buildStreamingAsrRoundText(segments)).toBe('今天下午我要整理需求，然后继续测试语音输入。');
    });

    it('keeps the utterance clean when multiple same-sentence corrections happen in sequence', () => {
        let segments = new Map<number, string>();

        segments = upsertStreamingAsrSegment(segments, 1, '今天下午我要整理需求', 'apd');
        segments = upsertStreamingAsrSegment(segments, 2, '然后继续测试严', 'apd');
        segments = upsertStreamingAsrSegment(segments, 2, '然后继续测试语音输入', 'apd');
        segments = upsertStreamingAsrSegment(segments, 3, '你想想系统还有哪些需要优化的地方', 'apd');
        segments = upsertStreamingAsrSegment(segments, 3, '你想想啊，系统还有哪些需要优化的地方？', 'apd');

        expect(buildStreamingAsrRoundText(segments)).toBe('今天下午我要整理需求然后继续测试语音输入你想想啊，系统还有哪些需要优化的地方？');
    });
});

describe('shouldPreferContinueAction', () => {
    it('prefers continue action after automatic end with draft text', () => {
        expect(shouldPreferContinueAction('ready_to_continue', true)).toBe(true);
    });

    it('does not prefer continue action for fresh or send-ready states', () => {
        expect(shouldPreferContinueAction('listening_new', true)).toBe(false);
        expect(shouldPreferContinueAction('ready_to_send', true)).toBe(false);
        expect(shouldPreferContinueAction('ready_to_continue', false)).toBe(false);
    });
});

describe('shouldShowStreamingSendAction', () => {
    it('shows send action when the draft is ready to send', () => {
        expect(shouldShowStreamingSendAction('ready_to_continue', true, false)).toBe(false);
        expect(shouldShowStreamingSendAction('ready_to_send', true, true)).toBe(true);
    });

    it('does not show send action when there is no draft', () => {
        expect(shouldShowStreamingSendAction('ready_to_send', false, true)).toBe(false);
        expect(shouldShowStreamingSendAction('idle', false, false)).toBe(false);
    });

    it('allows sending while continue mode is showing when the draft is already available', () => {
        expect(shouldShowStreamingSendAction('ready_to_continue', true, true)).toBe(true);
    });
});
