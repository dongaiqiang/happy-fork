export type StreamingAsrUiMode = 'idle' | 'listening_new' | 'listening_append' | 'ready_to_continue' | 'ready_to_send';

export interface StreamingAsrUiState {
    mode: StreamingAsrUiMode;
    hasDraft: boolean;
    canSendDraft: boolean;
}

export type StreamingAsrSegments = Map<number, string>;
export type StreamingAsrReplaceRange = [number, number];
const streamingAsciiPunctuationMap: Record<string, string> = {
    ',': '，',
    '.': '。',
    '?': '？',
    '!': '！',
    ';': '；',
    ':': '：'
};

function findStreamingOverlap(base: string, incoming: string) {
    const maxOverlap = Math.min(base.length, incoming.length);
    for (let length = maxOverlap; length > 0; length--) {
        if (base.slice(-length) === incoming.slice(0, length)) {
            return length;
        }
    }
    return 0;
}

function normalizeStreamingComparisonText(text: string) {
    return text.replace(/[\s,.;:!?，。！？；：、]/g, '');
}

function findCommonPrefixLength(left: string, right: string) {
    const maxLength = Math.min(left.length, right.length);
    let length = 0;

    while (length < maxLength && left[length] === right[length]) {
        length++;
    }

    return length;
}

function findCommonSuffixLength(left: string, right: string) {
    const maxLength = Math.min(left.length, right.length);
    let length = 0;

    while (
        length < maxLength
        && left[left.length - 1 - length] === right[right.length - 1 - length]
    ) {
        length++;
    }

    return length;
}

function findLongestCommonSubsequenceLength(left: string, right: string) {
    const previousRow = new Array(right.length + 1).fill(0);

    for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
        let diagonal = 0;

        for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
            const nextDiagonal = previousRow[rightIndex];

            if (left[leftIndex - 1] === right[rightIndex - 1]) {
                previousRow[rightIndex] = diagonal + 1;
            } else {
                previousRow[rightIndex] = Math.max(previousRow[rightIndex], previousRow[rightIndex - 1]);
            }

            diagonal = nextDiagonal;
        }
    }

    return previousRow[right.length];
}

function shouldReplaceStreamingSentence(base: string, incoming: string) {
    const normalizedBase = normalizeStreamingComparisonText(base);
    const normalizedIncoming = normalizeStreamingComparisonText(incoming);

    if (normalizedBase.length < 4 || normalizedIncoming.length < 4) {
        return false;
    }

    const maxLeadingCorrection = 2;
    const minSharedTailLength = Math.max(4, Math.floor(normalizedBase.length * 0.6));

    for (let sharedLength = normalizedBase.length; sharedLength >= minSharedTailLength; sharedLength--) {
        const baseSuffix = normalizedBase.slice(normalizedBase.length - sharedLength);
        const incomingIndex = normalizedIncoming.indexOf(baseSuffix);

        if (incomingIndex < 0) {
            continue;
        }

        const trimmedBasePrefixLength = normalizedBase.length - sharedLength;
        if (trimmedBasePrefixLength <= maxLeadingCorrection && incomingIndex <= maxLeadingCorrection) {
            return true;
        }
    }

    const minLength = Math.min(normalizedBase.length, normalizedIncoming.length);
    const lengthGap = Math.abs(normalizedBase.length - normalizedIncoming.length);
    const commonPrefixLength = findCommonPrefixLength(normalizedBase, normalizedIncoming);
    const commonSuffixLength = findCommonSuffixLength(normalizedBase, normalizedIncoming);
    const longestCommonSubsequenceLength = findLongestCommonSubsequenceLength(normalizedBase, normalizedIncoming);
    const sharedRatio = longestCommonSubsequenceLength / minLength;
    const requiredPrefixLength = Math.min(4, Math.max(2, Math.floor(minLength * 0.3)));
    const requiredSuffixLength = Math.max(4, Math.floor(minLength * 0.6));

    return (
        normalizedIncoming.length + 2 >= normalizedBase.length
        && sharedRatio >= 0.75
        && (
            commonPrefixLength >= requiredPrefixLength
            || (commonSuffixLength >= requiredSuffixLength && lengthGap <= 6)
        )
    );
}

export function appendStreamingAsrText(base: string, incoming: string) {
    if (!incoming) {
        return base;
    }
    if (!base) {
        return incoming;
    }
    if (base.endsWith(incoming)) {
        return base;
    }
    if (incoming.startsWith(base)) {
        return incoming;
    }
    if (shouldReplaceStreamingSentence(base, incoming)) {
        return incoming;
    }

    const directOverlap = findStreamingOverlap(base, incoming);
    if (directOverlap > 0) {
        return base + incoming.slice(directOverlap);
    }

    const punctuationPrefixMatch = incoming.match(/^([\s,.;:!?，。！？；：、]+)/);
    const punctuationPrefix = punctuationPrefixMatch?.[1] ?? '';
    if (punctuationPrefix) {
        const incomingWithoutPrefix = incoming.slice(punctuationPrefix.length);
        const overlapWithoutPrefix = findStreamingOverlap(base, incomingWithoutPrefix);
        if (overlapWithoutPrefix > 0) {
            return `${base.slice(0, base.length - overlapWithoutPrefix)}${punctuationPrefix}${incomingWithoutPrefix}`;
        }
    }

    return base + incoming;
}

export function mergeStreamingDraft(baseDraft: string, streamingText: string) {
    const base = baseDraft.trimEnd();
    const incoming = streamingText.trim();

    if (!base) {
        return incoming;
    }
    if (!incoming) {
        return base;
    }

    const merged = appendStreamingAsrText(base, incoming);
    if (merged !== `${base}${incoming}`) {
        return merged;
    }

    if (/[A-Za-z0-9]$/.test(base) && /^[A-Za-z0-9]/.test(incoming)) {
        return `${base} ${incoming}`;
    }

    return merged;
}

export function polishStreamingAsrFinalText(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
        return '';
    }

    let polished = trimmed.replace(/\s+/g, ' ');

    polished = polished.replace(/\s*([,.;:!?，。！？；：、])\s*/g, (_, punctuation: string) => {
        return streamingAsciiPunctuationMap[punctuation] ?? punctuation;
    });
    polished = polished.replace(/([，。！？；：、]){2,}/g, (_, punctuation: string) => punctuation);
    polished = polished.replace(/，([。！？])/g, '$1');
    polished = polished.replace(/；([。！？])/g, '$1');

    if (!/[。！？]$/.test(polished)) {
        if (/；$/.test(polished)) {
            polished = polished.slice(0, -1) + '。';
        } else if (/(吗|么|呢|嘛)\s*$/.test(polished)) {
            polished = `${polished}？`;
        } else {
            polished = `${polished}。`;
        }
    }

    return polished;
}

export function upsertStreamingAsrSegment(
    segments: StreamingAsrSegments,
    sn: number,
    incoming: string,
    pgs?: string,
    rg?: number[]
) {
    const nextSegments = new Map(segments);
    const hasValidReplaceRange = Array.isArray(rg)
        && rg.length === 2
        && Number.isFinite(rg[0])
        && Number.isFinite(rg[1]);
    const targetSn = pgs === 'rpl' && hasValidReplaceRange ? Number(rg[0]) : sn;

    if (pgs === 'rpl' && hasValidReplaceRange) {
        const rangeStart = Number(rg[0]);
        const rangeEnd = Number(rg[1]);

        for (let currentSn = rangeStart; currentSn <= rangeEnd; currentSn++) {
            nextSegments.delete(currentSn);
        }
    }

    const previousText = nextSegments.get(targetSn) ?? '';
    const nextText = pgs === 'rpl'
        ? incoming
        : appendStreamingAsrText(previousText, incoming);

    nextSegments.set(targetSn, nextText);
    return nextSegments;
}

export function buildStreamingAsrRoundText(segments: StreamingAsrSegments) {
    return [...segments.entries()]
        .sort(([leftSn], [rightSn]) => leftSn - rightSn)
        .reduce((fullText, [, segmentText]) => appendStreamingAsrText(fullText, segmentText), '');
}

export function shouldPreferContinueAction(mode: StreamingAsrUiMode, hasDraft: boolean) {
    return mode === 'ready_to_continue' && hasDraft;
}

export function shouldShowStreamingSendAction(mode: StreamingAsrUiMode, hasDraft: boolean, canSendDraft: boolean) {
    if (!hasDraft || !canSendDraft) {
        return false;
    }

    return mode === 'ready_to_continue' || mode === 'ready_to_send';
}
