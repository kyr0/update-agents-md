import { describe, it, expect } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fsp from 'node:fs/promises';
import { processFiles } from '../src/process.js';

describe('processFiles', () => {
    it('aggregates files with lineLimit and charLimit', async () => {
        const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'agents-'));
        const a = path.join(dir, 'a.txt');
        const b = path.join(dir, 'b.txt');

        await fsp.writeFile(a, '1\n2\n3\n4\n5\n');
        await fsp.writeFile(b, 'hello');

        const out = await processFiles({
            files: [a, b],
            root: dir,
            lineLimit: 3,
            charLimit: 200
        });

        expect(out).toContain('./a.txt:');
        expect(out).toContain('./b.txt:');
        expect(out).toContain('... (truncated to 3 lines)');
    });
});
