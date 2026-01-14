import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { isBinaryFile } from './utils.js';

export interface ProcessOptions {
    files: Array<string>;
    root: string;
    lineLimit?: number;
    charLimit?: number;
    concurrency?: number;
}

/**
 * ensures deterministic, natural sorting
 */
export const naturalSortInPlace = (files: Array<string>): void => {
    files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
};

/**
 * reads and optionally truncates a text file by lineLimit
 */
export const readAndMaybeTrim = async (filePath: string, lineLimit?: number): Promise<string | undefined> => {
    if (await isBinaryFile(filePath)) return undefined;
    const content = await fsp.readFile(filePath, 'utf-8');

    if (!lineLimit || lineLimit <= 0) return content;

    const lines = content.split(/\r?\n/);
    if (lines.length <= lineLimit) return content;

    return `${lines.slice(0, lineLimit).join('\n')}\n... (truncated to ${lineLimit} lines)`;
};

/**
 * builds the aggregated markdown snippet
 */
export const processFiles = async (options: ProcessOptions): Promise<string> => {
    const { files, root, lineLimit, charLimit, concurrency = 20 } = options;
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
            })
        );
    }

    let collected = '';

    for (const filePath of files) {
        const content = results.get(filePath);
        if (content === undefined) continue;

        const relPath = path.relative(root, filePath);
        const headerPath = relPath.startsWith('..') ? relPath : `.${path.sep}${relPath}`;
        const entry = `${headerPath}:\n\`\`\`\n${content}\n\`\`\`\n\n`;

        if (charLimit && collected.length + entry.length > charLimit) {
            const remaining = charLimit - collected.length;
            if (remaining > 0) collected += entry.slice(0, remaining);
            break;
        }
        collected += entry;
    }

    return collected;
};
