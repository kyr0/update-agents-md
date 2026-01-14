#!/usr/bin/env node
import * as path from 'node:path';
import * as fsp from 'node:fs/promises';
import { parseArgs } from './args.js';
import { scanDirectory } from './scan.js';
import { processFiles } from './process.js';
import { replaceOrAppendTags } from './utils.js';
import { IGNORE_FILE_PATTERNS } from './config.js';

export interface RunOptions {
    root: string;
    follow: boolean;
    excludeDocs: boolean;
    lines?: number;
    chars?: number;
}

export const ensureDefaultAgentsIgnore = async (root: string): Promise<void> => {
    const agentsIgnorePath = path.join(root, '.agentsignore');
    try {
        await fsp.access(agentsIgnorePath);
    } catch {
        try {
            await fsp.writeFile(agentsIgnorePath, IGNORE_FILE_PATTERNS, 'utf-8');
            console.log(`Created default .agentsignore at ${agentsIgnorePath}`);
        } catch (e) {
            console.warn(`Warning: Could not create default .agentsignore:`, e);
        }
    }
};

export const run = async (opts: RunOptions): Promise<void> => {
    await ensureDefaultAgentsIgnore(opts.root);

    const files = await scanDirectory({ cwd: opts.root, follow: opts.follow, excludeDocs: opts.excludeDocs });
    const displayFiles = files.filter((f) => path.basename(f) !== 'agents.md');

    const sourceCode = await processFiles({
        files: displayFiles,
        root: opts.root,
        lineLimit: opts.lines,
        charLimit: opts.chars
    });

    const agentsMdPath = path.join(opts.root, 'agents.md');
    let existingContent = '';
    try {
        existingContent = await fsp.readFile(agentsMdPath, 'utf-8');
    } catch {
        // create fresh file later
    }

    const newContent = replaceOrAppendTags(existingContent, sourceCode);
    await fsp.writeFile(agentsMdPath, newContent, 'utf-8');
    console.log(`Successfully updated ${agentsMdPath} with ${displayFiles.length} files.`);
};

const main = async (): Promise<void> => {
    try {
        const args = parseArgs(process.argv.slice(2));
        const root = path.resolve(args.targetDir);

        await run({
            root,
            follow: args.follow,
            excludeDocs: args.excludeDocs,
            lines: args.lines,
            chars: args.chars
        });
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

main();
