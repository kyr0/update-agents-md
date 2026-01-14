import { describe, it, expect } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fsp from 'node:fs/promises';
import { scanDirectory } from '../src/scan.js';
import { IGNORE_FILE_PATTERNS } from '../src/config.js';

describe('scanDirectory', () => {
    it('respects default ignore + .gitignore + .agentsignore', async () => {
        const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'scan-'));
        await fsp.writeFile(path.join(dir, '.agentsignore'), 'ignored_folder/\n');
        await fsp.mkdir(path.join(dir, 'ignored_folder'), { recursive: true });
        await fsp.writeFile(path.join(dir, 'ignored_folder/secret.txt'), 'x');

        await fsp.writeFile(path.join(dir, '.gitignore'), 'git_ignored.txt\n');
        await fsp.writeFile(path.join(dir, 'git_ignored.txt'), 'x');

        await fsp.writeFile(path.join(dir, 'ok.txt'), 'ok');

        // ensure default ignore exists (agents.md)
        await fsp.writeFile(path.join(dir, 'agents.md'), 'z');

        const files = await scanDirectory({ cwd: dir, follow: false, excludeDocs: false });
        const rel = files.map((f) => path.relative(dir, f));
        expect(rel).toContain('ok.txt');
        expect(rel).not.toContain('git_ignored.txt');
        expect(rel).not.toContain(path.join('ignored_folder', 'secret.txt'));
        expect(rel).not.toContain('agents.md');
    });
});
