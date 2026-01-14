import fs from 'node:fs/promises';
import path from 'node:path';
import ignore from 'ignore';
import { IGNORE_FILE_PATTERNS, DOCS_FILE_PATTERNS, IGNORE_FILES } from './config.js';

export interface ScanOptions {
    cwd: string;
    follow: boolean;
    debug?: boolean;
    excludeDocs?: boolean;
}

function processPatterns(rawPatterns: string[], relP: string): string[] {
    const processed: string[] = [];
    for (const p of rawPatterns) {
        if (!p.trim() || p.startsWith('#')) continue;

        const clean = p.trim();
        let isNeg = false;
        let core = clean;
        if (clean.startsWith('!')) {
            isNeg = true;
            core = clean.substring(1);
        }

        let rewritten = '';
        if (core.startsWith('/')) {
            // Anchored: /node_modules -> relP/node_modules
            // Use posix join for rule paths
            rewritten = path.posix.join(relP, core.substring(1));
        } else if (core.includes('/')) {
            // Has slash, relative: dist/foo -> relP/dist/foo
            rewritten = path.posix.join(relP, core);
        } else {
            // No slash: *.log -> relP/**/*.log
            // Using ** to match in this dir and below, properly scoped to relP
            rewritten = path.posix.join(relP, '**', core);
        }

        processed.push(isNeg ? '!' + rewritten : rewritten);
    }
    return processed;
}

export async function scanDirectory(options: ScanOptions): Promise<string[]> {
    const { cwd, follow, excludeDocs } = options;
    const files: string[] = [];

    const baseIgnore = IGNORE_FILE_PATTERNS.split(/\r?\n/);
    if (excludeDocs) {
        baseIgnore.push(...DOCS_FILE_PATTERNS);
    }

    const defaultPatterns = processPatterns(baseIgnore, '');

    // Use POSIX path for logical relative paths (required by 'ignore' package)
    // Use system path for FS operations

    // We accumulate patterns (which we rewrite to be relative to the scan root).
    // The 'ignore' package expects forward slashes and relative paths from the root where it's checked.

    const traverse = async (currentDir: string, relP: string, collectedPatterns: string[]) => {
        // 1. Read .gitignore / .agentsignore
        const localPatterns: string[] = [];
        const ignoreFiles = IGNORE_FILES;

        for (const f of ignoreFiles) {
            try {
                const content = await fs.readFile(path.join(currentDir, f), 'utf-8');
                localPatterns.push(...content.split(/\r?\n/));
            } catch (e) {
                // ignore missing
            }
        }

        // 2. Rewrite and append
        const nextPatterns = [...collectedPatterns, ...processPatterns(localPatterns, relP)];

        // ignore package works best with forward slashes
        const ig = ignore().add(nextPatterns);

        let entries;
        try {
            entries = await fs.readdir(currentDir, { withFileTypes: true });
        } catch (e) {
            return;
        }

        // Sort entries for deterministic traversal
        // Check heuristic exclusions for this directory
        // 1. Python venv: presence of pyvenv.cfg
        try {
            const venvCheck = path.join(currentDir, 'pyvenv.cfg');
            await fs.access(venvCheck);
            // If we reach here, it exists. Skip this directory.
            return;
        } catch {
            // ignore
        }

        entries.sort((a, b) => a.name.localeCompare(b.name));

        for (const entry of entries) {
            // Logic path (posix) for checking against ignore rules
            const entryRelPath = path.posix.join(relP, entry.name);

            if (ig.ignores(entryRelPath)) {
                continue;
            }

            // Handle symbolic links
            if (entry.isSymbolicLink() && !follow) {
                continue;
            }

            if (entry.isDirectory()) {
                // FS path (system) for recursion
                await traverse(path.join(currentDir, entry.name), entryRelPath, nextPatterns);
            } else if (entry.isFile()) {
                // Store system absolute path
                files.push(path.join(currentDir, entry.name));
            }
        }
    };

    await traverse(cwd, '', defaultPatterns);
    return files;
}
