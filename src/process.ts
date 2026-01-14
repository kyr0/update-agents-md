import fs from 'node:fs/promises';
import path from 'node:path';
import { isBinaryFile } from './utils.js';

export interface ProcessOptions {
    files: string[];
    root: string;
    lineLimit?: number;
    charLimit?: number;
    concurrency?: number;
}

export async function processFiles(options: ProcessOptions): Promise<string> {
    const { files, root, lineLimit, charLimit, concurrency = 20 } = options;

    // Natural sort files
    files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    const results: Map<string, string> = new Map();

    // Process in chunks
    for (let i = 0; i < files.length; i += concurrency) {
        const chunk = files.slice(i, i + concurrency);
        await Promise.all(chunk.map(async (filePath) => {
            try {
                if (await isBinaryFile(filePath)) {
                    return;
                }

                const content = await fs.readFile(filePath, 'utf-8');

                let processedContent = content;
                if (lineLimit && lineLimit > 0) {
                    const lines = content.split(/\r?\n/);
                    if (lines.length > lineLimit) {
                        processedContent = lines.slice(0, lineLimit).join('\n') + `\n... (truncated to ${lineLimit} lines)`;
                    }
                }

                results.set(filePath, processedContent);
            } catch (e) {
                // ignore errors
            }
        }));
    }

    let collected = '';

    for (const filePath of files) {
        const content = results.get(filePath);
        if (content === undefined) continue;

        const relPath = path.relative(root, filePath);
        // Ensure ./ prefix
        const headerPath = relPath.startsWith('..') ? relPath : `.${path.sep}${relPath}`;

        const entry = `${headerPath}:\n\`\`\`\n${content}\n\`\`\`\n\n`;

        if (charLimit && (collected.length + entry.length > charLimit)) {
            // Truncate
            const remaining = charLimit - collected.length;
            if (remaining > 0) {
                collected += entry.slice(0, remaining);
            }
            break;
        }

        collected += entry;
    }

    return collected;
}
