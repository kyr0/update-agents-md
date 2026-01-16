import { readFile } from "node:fs/promises";
import * as path from "node:path";
import { isBinaryFile } from "./utils.js";

export interface ProcessOptions {
    files: Array<string>;
    root: string;
    lineLimit?: number;
    charLimit?: number;
    concurrency?: number;
    /** Map of .ts file path -> generated .d.ts content */
    dtsMap?: Map<string, string>;
}

/**
 * ensures deterministic, natural sorting
 */
export const naturalSortInPlace = (files: Array<string>): void => {
    files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
};

/**
 * normalizes a system path to a posix-ish path for stable markdown output
 */
export const toPosixRelPath = (root: string, filePath: string): string => {
    const rel = path.relative(root, filePath);
    const relPosix = rel.split(path.sep).join(path.posix.sep);
    return relPosix.startsWith("..") ? relPosix : `./${relPosix}`;
};

/**
 * reads and optionally truncates a text file by lineLimit
 */
export const readAndMaybeTrim = async (filePath: string, lineLimit?: number): Promise<string | undefined> => {
    if (await isBinaryFile(filePath)) return undefined;

    const content = await readFile(filePath, "utf-8");

    if (!lineLimit || lineLimit <= 0) return content;

    const lines = content.split(/\r?\n/);
    if (lines.length <= lineLimit) return content;

    return `${lines.slice(0, lineLimit).join("\n")}\n... (truncated to ${lineLimit} lines)`;
};

/**
 * builds the aggregated markdown snippet
 */
export const processFiles = async (options: ProcessOptions): Promise<string> => {
    const { files, root, lineLimit, charLimit, concurrency = 20, dtsMap } = options;

    naturalSortInPlace(files);

    const results = new Map<string, string>();

    for (let i = 0; i < files.length; i += concurrency) {
        const chunk = files.slice(i, i + concurrency);

        await Promise.all(
            chunk.map(async (filePath) => {
                try {
                    const processed = await readAndMaybeTrim(filePath, lineLimit);
                    if (processed !== undefined) results.set(filePath, processed);
                } catch {
                    // intentionally ignore file-level read errors
                }
            }),
        );
    }

    let collected = "";

    for (const filePath of files) {
        const content = results.get(filePath);
        if (content === undefined) continue;

        const headerPath = toPosixRelPath(root, filePath);
        const entry = `${headerPath}:\n\`\`\`\n${content}\n\`\`\`\n\n`;

        if (charLimit && collected.length + entry.length > charLimit) {
            const remaining = charLimit - collected.length;
            if (remaining > 0) collected += entry.slice(0, remaining);
            break;
        }

        collected += entry;

        // If this is a .ts file and we have generated .d.ts content, append it
        if (dtsMap && filePath.endsWith(".ts") && !filePath.endsWith(".d.ts")) {
            const dtsContent = dtsMap.get(filePath);
            if (dtsContent) {
                const dtsPath = headerPath.replace(/\.ts$/, ".d.ts");
                const dtsEntry = `${dtsPath}:\n\`\`\`\n${dtsContent}\n\`\`\`\n\n`;

                if (charLimit && collected.length + dtsEntry.length > charLimit) {
                    const remaining = charLimit - collected.length;
                    if (remaining > 0) collected += dtsEntry.slice(0, remaining);
                    break;
                }

                collected += dtsEntry;
            }
        }
    }

    return collected;
};
