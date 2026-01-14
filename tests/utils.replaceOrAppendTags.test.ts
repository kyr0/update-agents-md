import { describe, it, expect } from 'vitest';
import { replaceOrAppendTags } from '../src/utils.js';
import { OPEN_TAG, CLOSE_TAG } from '../src/config.js';

describe('replaceOrAppendTags', () => {
    it('appends when no tags exist', () => {
        const out = replaceOrAppendTags('Header\nBody\n', 'SRC');
        expect(out).toContain(OPEN_TAG);
        expect(out).toContain(CLOSE_TAG);
        expect(out).toContain('SRC');
    });

    it('replaces single well-formed block', () => {
        const input = `Header
${OPEN_TAG}
old
${CLOSE_TAG}
Footer`;
        const out = replaceOrAppendTags(input, 'SRC');
        expect(out).toContain('Header');
        expect(out).toContain('Footer');
        expect(out.includes('old')).toBe(false);
        expect(out.match(new RegExp(OPEN_TAG, 'g'))?.length).toBe(1);
        expect(out.match(new RegExp(CLOSE_TAG, 'g'))?.length).toBe(1);
    });

    it('replaces content from first open to last close when multiple blocks exist', () => {
        const input = `prefix
${OPEN_TAG}
block1
${CLOSE_TAG}
garbage
${OPEN_TAG}
block2
${CLOSE_TAG}
suffix`;
        const out = replaceOrAppendTags(input, 'SRC');
        expect(out).toContain('prefix');
        expect(out).toContain('suffix');
        expect(out.includes('block1')).toBe(false);
        expect(out.includes('block2')).toBe(false);
        expect(out.includes('garbage')).toBe(false);
    });
});
