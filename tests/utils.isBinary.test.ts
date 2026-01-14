import { describe, it, expect } from 'vitest';
import { isBinary } from '../src/utils.js';
import { Buffer } from 'node:buffer';

describe('isBinary buffer heuristic', () => {
    it('detects plain text as non-binary', () => {
        expect(isBinary(Buffer.from('hello world\n'))).toBe(false);
    });

    it('detects NUL as binary', () => {
        expect(isBinary(Buffer.from([0, 1, 2]))).toBe(true);
    });

    it('threshold based on control chars >10%', () => {
        const mostlyText = Buffer.from([7, 8, 9, 10, 11, ...Array(45).fill(32)]);
        // (7,8,11)=3 suspicious of 50 -> 6% -> false
        expect(isBinary(mostlyText)).toBe(false);

        const moreControls = Buffer.from([7, 8, 11, 12, 1, 2, ...Array(44).fill(32)]);
        // 6/50=12% -> true
        expect(isBinary(moreControls)).toBe(true);
    });
});
