import { describe, expect, it } from 'vitest';
import { buildTmuxInjectionKeys } from './tmuxInjection';

describe('buildTmuxInjectionKeys', () => {
    it('appends a final submit key for single-line messages', () => {
        expect(buildTmuxInjectionKeys('hello')).toEqual(['hello', 'C-m']);
    });

    it('splits multiline messages into line submits and final submit', () => {
        expect(buildTmuxInjectionKeys('line1\nline2')).toEqual(['line1', 'C-m', 'line2', 'C-m']);
    });

    it('preserves empty lines', () => {
        expect(buildTmuxInjectionKeys('line1\n\nline3')).toEqual(['line1', 'C-m', 'C-m', 'line3', 'C-m']);
    });
});
