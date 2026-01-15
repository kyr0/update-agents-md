import { access, readFile, readdir, realpath, stat } from "node:fs/promises";
import * as path from "node:path";
import type { Dirent } from "node:fs";
import ignore from "ignore";
import { IGNORE_FILE_PATTERNS, DOCS_FILE_PATTERNS, IGNORE_FILES } from "./config.js";

export interface ScanOptions {
    cwd: string;
    follow: boolean;
    debug?: boolean;
    excludeDocs?: boolean;
    /** When provided, only files matching these glob patterns are included (exclusive include mode) */
    includePatterns?: Array<string>;
}

export interface TraverseState {
    files: Array<string>;
    follow: boolean;
    visitedRealDirs: Set<string>;
    /** When set, only files matching these patterns are included */
    includePatterns: Array<string>;
}

export type EntryKind = "dir" | "file" | "skip";

export const getEntryKind = async (entry: Dirent, systemPath: string, follow: boolean): Promise<EntryKind> => {
    if (entry.isDirectory()) return "dir";
    if (entry.isFile()) return "file";

    if (!entry.isSymbolicLink()) return "skip";
    if (!follow) return "skip";

    // follow symlinks requires stat() to know what they point to
    const st = await stat(systemPath).catch(() => undefined);
    if (!st) return "skip";
    if (st.isDirectory()) return "dir";
    if (st.isFile()) return "file";
    return "skip";
};

/**
 * Converts a simple glob pattern like *.ts to a regex.
 * Supports: * (any chars except /), ? (single char), ** (any path)
 */
export const globToRegex = (pattern: string): RegExp => {
    let regex = "";
    let i = 0;

    while (i < pattern.length) {
        const char = pattern[i];
        if (char === "*") {
            if (pattern[i + 1] === "*") {
                // ** matches any path
                regex += ".*";
                i += 2;
                continue;
            }
            // * matches any chars except /
            regex += "[^/]*";
        } else if (char === "?") {
            regex += "[^/]";
        } else if (".+^${}|[]\\()".includes(char)) {
            regex += `\\${char}`;
        } else {
            regex += char;
        }
        i++;
    }

    return new RegExp(`^${regex}$`, "i");
};

/**
 * Checks if a filename matches any of the include patterns.
 * Patterns are matched against the basename (e.g., "file.ts") and
 * can use wildcards like *.ts, *.c, foo*.txt
 */
export const matchesIncludePatterns = (filename: string, patterns: Array<string>): boolean => {
    if (patterns.length === 0) return true; // no filtering when no patterns

    const basename = path.basename(filename);

    for (const pattern of patterns) {
        const regex = globToRegex(pattern);
        if (regex.test(basename)) return true;
    }

    return false;
};

/**
 * rewrites raw ignore patterns so they are anchored to relP.
 * note: node-ignore needs directory paths to be tested with a trailing slash,
 * so we preserve trailing slashes in patterns.
 */
export const processPatterns = (rawPatterns: Array<string>, relP: string): Array<string> => {
    const processed: Array<string> = [];

    for (const rawLine of rawPatterns) {
        // keep leading/trailing whitespace intact (gitignore has escaping semantics)
        if (rawLine === "") continue;
        if (rawLine.startsWith("#")) continue;

        let isNeg = false;
        let core = rawLine;

        // only a leading '!' is negation (escaped '\!' is handled by core not starting with '!')
        if (core.startsWith("!")) {
            isNeg = true;
            core = core.slice(1);
            if (core === "") continue;
        }

        const anchoredToDir = core.startsWith("/");
        const coreNoAnchor = anchoredToDir ? core.slice(1) : core;
        if (coreNoAnchor === "") continue;

        // preserve "directory-only" markers
        const hasTrailingSlash = coreNoAnchor.endsWith("/") && coreNoAnchor !== "/";
        const coreBody = hasTrailingSlash ? coreNoAnchor.slice(0, -1) : coreNoAnchor;

        if (coreBody === "") continue;

        // gitignore semantics:
        // - leading "/" anchors to the directory where the ignore file lives
        // - patterns with "/" are relative to that directory
        // - patterns without "/" match anywhere below that directory (modeled as relP/**/core)
        let rewritten = "";
        if (anchoredToDir) {
            rewritten = path.posix.join(relP, coreBody);
        } else if (coreBody.includes("/")) {
            rewritten = path.posix.join(relP, coreBody);
        } else {
            rewritten = path.posix.join(relP, "**", coreBody);
        }

        if (hasTrailingSlash && !rewritten.endsWith("/")) rewritten += "/";

        processed.push(isNeg ? `!${rewritten}` : rewritten);
    }

    return processed;
};

export const traverseDirectory = async (
    state: TraverseState,
    currentDir: string,
    relP: string,
    collectedPatterns: Array<string>,
    excludeDocs: boolean,
): Promise<void> => {
    // prevent infinite recursion with follow=true on symlink cycles
    if (state.follow) {
        const rp = await realpath(currentDir).catch(() => currentDir);
        if (state.visitedRealDirs.has(rp)) return;
        state.visitedRealDirs.add(rp);
    }

    // skip common virtualenv roots quickly
    try {
        await access(path.join(currentDir, "pyvenv.cfg"));
        return;
    } catch {
        // not a python venv
    }

    const localPatterns: Array<string> = [];
    await Promise.all(
        IGNORE_FILES.map(async (fname) => {
            const p = path.join(currentDir, fname);
            const content = await readFile(p, "utf-8").catch(() => undefined);
            if (!content) return;
            localPatterns.push(...content.split(/\r?\n/));
        }),
    );

    const nextPatterns = [...collectedPatterns, ...processPatterns(localPatterns, relP)];
    const ig = ignore().add(nextPatterns);

    let entries: Array<Dirent>;
    try {
        entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
        return;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
        const systemPath = path.join(currentDir, entry.name);
        const entryRelPath = path.posix.join(relP, entry.name);

        const kind = await getEntryKind(entry, systemPath, state.follow);
        if (kind === "skip") continue;

        // node-ignore needs "marked" dir paths to match trailing-slash patterns (e.g. "config/")
        const ignorePath = kind === "dir" ? `${entryRelPath}/` : entryRelPath;

        if (ig.ignores(ignorePath)) continue;

        if (kind === "dir") {
            await traverseDirectory(state, systemPath, entryRelPath, nextPatterns, excludeDocs);
            continue;
        }

        // kind === "file" - check include patterns if in exclusive include mode
        if (!matchesIncludePatterns(entry.name, state.includePatterns)) continue;

        state.files.push(systemPath);
    }
};

/**
 * recursively scans a directory with layered .gitignore / .agentsignore handling
 */
export const scanDirectory = async (options: ScanOptions): Promise<Array<string>> => {
    const { cwd, follow, excludeDocs = false, includePatterns = [] } = options;

    const baseIgnore = IGNORE_FILE_PATTERNS.split(/\r?\n/);
    if (excludeDocs) baseIgnore.push(...DOCS_FILE_PATTERNS);

    const defaultPatterns = processPatterns(baseIgnore, "");

    const state: TraverseState = {
        files: [],
        follow,
        visitedRealDirs: new Set<string>(),
        includePatterns,
    };

    await traverseDirectory(state, cwd, "", defaultPatterns, excludeDocs);
    return state.files;
};
