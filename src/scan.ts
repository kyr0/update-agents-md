import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import ignore from 'ignore';
import { IGNORE_FILE_PATTERNS, DOCS_FILE_PATTERNS, IGNORE_FILES } from './config.js';

export interface ScanOptions {
    cwd: string;
    follow: boolean;
    debug?: boolean;
    excludeDocs?: boolean;
}

export interface ProcessedRules {
    patterns: Array<string>;
}

/**
 * rewrites raw ignore patterns so they are anchored to relP
 */
export const processPatterns = (rawPatterns: Array<string>, relP: string): Array<string> => {
    const processed: Array<string> = [];
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
            // anchored to current relP
            rewritten = path.posix.join(relP, core.substring(1));
        } else if (core.includes('/')) {
            rewritten = path.posix.join(relP, core);
        } else {
            // no slash -> match in this dir and all below
            rewritten = path.posix.join(relP, '**', core);
        }

        processed.push(isNeg ? '!' + rewritten : rewritten);
    }
    return processed;
};

/**
 * recursively scans a directory with layered .gitignore / .agentsignore handling
 */
export const scanDirectory = async (options: ScanOptions): Promise<Array<string>> => {
    const { cwd, follow, excludeDocs } = options;
    const files: Array<string> = [];

    const baseIgnore = IGNORE_FILE_PATTERNS.split(/\r?\n/);
    if (excludeDocs) baseIgnore.push(...DOCS_FILE_PATTERNS);

    const defaultPatterns = processPatterns(baseIgnore, '');

    const traverse = async (currentDir: string, relP: string, collectedPatterns: Array<string>) => {
        const localPatterns: Array<string> = [];

        for (const fname of IGNORE_FILES) {
            try {
                const content = await fsp.readFile(path.join(currentDir, fname), 'utf-8');
                localPatterns.push(...content.split(/\r?\n/));
            } catch {
                // ignore missing
            }
        }

        const nextPatterns = [...collectedPatterns, ...processPatterns(localPatterns, relP)];
        const ig = ignore().add(nextPatterns);

        let entries: Array<import('node:fs').Dirent>;
        try {
            entries = await fsp.readdir(currentDir, { withFileTypes: true });
        } catch {
            return;
        }

        // skip common virtualenvs quickly
        try {
            await fsp.access(path.join(currentDir, 'pyvenv.cfg'));
            return;
        } catch {
            // not a python venv
        }

        entries.sort((a, b) => a.name.localeCompare(b.name));

        for (const entry of entries) {
            const entryRelPath = path.posix.join(relP, entry.name);

            if (ig.ignores(entryRelPath)) continue;
            if (entry.isSymbolicLink() && !follow) continue;

            const systemPath = path.join(currentDir, entry.name);

            if (entry.isDirectory()) {
                await traverse(systemPath, entryRelPath, nextPatterns);
            } else if (entry.isFile()) {
                files.push(systemPath);
            }
        }
    };

    await traverse(cwd, '', defaultPatterns);
    return files;
};
