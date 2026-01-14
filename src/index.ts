#!/usr/bin/env node
import minimist from 'minimist';
import path from 'node:path';
import fs from 'node:fs/promises';
import { scanDirectory } from './scan.js';
import { processFiles } from './process.js';
import { replaceOrAppendTags } from './utils.js';
import { IGNORE_FILE_PATTERNS } from './config.js';

async function main() {
    const argv = minimist(process.argv.slice(2), {
        string: ['f', 'chars'],
        boolean: ['follow', 'docs'],
        alias: {
            f: 'follow',
            l: 'lines',
            c: 'chars',
            d: 'docs',
        }
    });

    const follow = argv.follow || argv.f || false;
    const excludeDocs = argv.docs || argv.d || false;
    const lines = argv.lines || argv.l ? parseInt(String(argv.lines || argv.l), 10) : undefined;
    const chars = argv.chars ? parseInt(String(argv.chars), 10) : undefined;

    const targetDir = argv._[0] || '.';
    const root = path.resolve(targetDir);

    // Check and create .agentsignore if missing
    const agentsIgnorePath = path.join(root, '.agentsignore');
    try {
        await fs.access(agentsIgnorePath);
    } catch {
        // File does not exist, create it
        try {
            await fs.writeFile(agentsIgnorePath, IGNORE_FILE_PATTERNS, 'utf-8');
            console.log(`Created default .agentsignore at ${agentsIgnorePath}`);
        } catch (e) {
            console.warn(`Warning: Could not create default .agentsignore:`, e);
        }
    }

    try {
        const files = await scanDirectory({ cwd: root, follow: !!follow, excludeDocs: !!excludeDocs });
        const displayFiles = files.filter(f => path.basename(f) !== 'agents.md');

        const sourceCode = await processFiles({
            files: displayFiles,
            root,
            lineLimit: lines,
            charLimit: chars
        });

        const agentsMdPath = path.join(root, 'agents.md');
        let existingContent = '';
        try {
            existingContent = await fs.readFile(agentsMdPath, 'utf-8');
        } catch (e) {
            // file doesn't exist, start empty
        }

        const newContent = replaceOrAppendTags(existingContent, sourceCode);

        await fs.writeFile(agentsMdPath, newContent, 'utf-8');
        console.log(`Successfully updated ${agentsMdPath} with ${displayFiles.length} files.`);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
