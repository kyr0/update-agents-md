#!/usr/bin/env node
import * as path from "node:path";
import { access, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { parseArgs } from "./args.js";
import { scanDirectory } from "./scan.js";
import { processFiles } from "./process.js";
import { replaceOrAppendTags } from "./utils.js";
import { IGNORE_FILE_PATTERNS } from "./config.js";

export interface RunOptions {
    root: string;
    follow: boolean;
    excludeDocs: boolean;
    lines?: number;
    chars?: number;
}

export const printHelp = (): void => {
    console.log(`
usage:
  update-agents-md [targetDir] [options]

options:
  -f, --follow         follow symlinks (guards against cycles)
  -d, --docs           exclude documentation files (current behavior)
  -l, --lines <n>      limit each file to n lines
  -c, --chars <n>      limit total output to n chars
  -h, --help           show help
`.trim());
};

export const ensureDefaultAgentsIgnore = async (root: string): Promise<void> => {
    const agentsIgnorePath = path.join(root, ".agentsignore");

    try {
        await access(agentsIgnorePath);
    } catch {
        try {
            await writeFile(agentsIgnorePath, IGNORE_FILE_PATTERNS, "utf-8");
            console.log(`Created default .agentsignore at ${agentsIgnorePath}`);
        } catch (e) {
            console.warn(`Warning: Could not create default .agentsignore:`, e);
        }
    }
};

export const run = async (opts: RunOptions): Promise<void> => {
    await ensureDefaultAgentsIgnore(opts.root);

    const files = await scanDirectory({ cwd: opts.root, follow: opts.follow, excludeDocs: opts.excludeDocs });

    // avoid self-inclusion even if user un-ignores it
    const displayFiles = files.filter((f) => path.basename(f) !== "agents.md");

    const sourceCode = await processFiles({
        files: displayFiles,
        root: opts.root,
        lineLimit: opts.lines,
        charLimit: opts.chars,
    });

    const agentsMdPath = path.join(opts.root, "agents.md");
    const existingContent = await readFile(agentsMdPath, "utf-8").catch(() => "");

    const newContent = replaceOrAppendTags(existingContent, sourceCode);
    await writeFile(agentsMdPath, newContent, "utf-8");

    console.log(`Successfully updated ${agentsMdPath} with ${displayFiles.length} files.`);
};

export const main = async (argv: Array<string>): Promise<void> => {
    const args = parseArgs(argv);

    if (args.help) {
        printHelp();
        return;
    }

    const root = path.resolve(args.targetDir);

    await run({
        root,
        follow: args.follow,
        excludeDocs: args.excludeDocs,
        lines: args.lines,
        chars: args.chars,
    });
};

export const isDirectCliInvocation = (): boolean => {
    const entry = process.argv[1];
    if (!entry) return false;

    // compare file:// urls to reliably detect direct execution in ESM
    return import.meta.url === pathToFileURL(path.resolve(entry)).href;
};

if (isDirectCliInvocation()) {
    main(process.argv.slice(2)).catch((error) => {
        console.error("Error:", error);
        process.exit(1);
    });
}
