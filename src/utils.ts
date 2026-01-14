import fs from 'node:fs/promises';

/**
 * Checks if a buffer contains binary data.
 * Considers data binary if it contains a NUL byte or has too many non-printable control characters
 * within the first 512 bytes.
 */
export function isBinary(buffer: Buffer): boolean {
    const length = Math.min(buffer.length, 512);
    let suspicionScore = 0;

    for (let i = 0; i < length; i++) {
        const byte = buffer[i];

        // NUL byte is a strong indicator of binary data
        if (byte === 0x00) {
            return true;
        }

        // Check for non-printable control characters (excluding whitespace like tab, lf, cr)
        // ASCII control chars: 0-31, 127. 
        // Allowed: 9 (TAB), 10 (LF), 13 (CR)
        if ((byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) || byte === 127) {
            suspicionScore++;
        }
    }

    // If more than 10% of the checked bytes are suspicious, treat as binary
    if (length > 0 && (suspicionScore / length) > 0.1) {
        return true;
    }

    return false;
}

export async function isBinaryFile(filePath: string): Promise<boolean> {
    let handle: fs.FileHandle | undefined;
    try {
        handle = await fs.open(filePath, 'r');
        const buffer = Buffer.alloc(512);
        const result = await handle.read(buffer, 0, 512, 0);
        if (result.bytesRead === 0) {
            return false; // Empty file is text
        }
        return isBinary(buffer.subarray(0, result.bytesRead));
    } catch (error) {
        // If we can't read it, assume it's risky/binary or just skip? 
        // Default to treating as binary/skippable if read fails
        return true;
    } finally {
        await handle?.close();
    }
}

export function replaceOrAppendTags(content: string, sourceCode: string): string {
    const openTag = '<full-context-dump>';
    const closeTag = '</full-context-dump>';

    const newContentBlock = `${openTag}\n${sourceCode}\n${closeTag}`;

    const startIndex = content.indexOf(openTag);
    // Search from end
    const endIndex = content.lastIndexOf(closeTag);

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        // Replace everything between the *start* of the first open tag 
        // and the *end* of the last close tag.

        const pre = content.substring(0, startIndex);
        const post = content.substring(endIndex + closeTag.length);
        return pre + newContentBlock + post;
    }

    if (startIndex !== -1 && endIndex === -1) {
        // Has start but no end? Replace from start to end of string with new block.
        const pre = content.substring(0, startIndex);
        return pre + newContentBlock;
    }

    // Fallback: Check for self-closing if distinct?
    // User logic "find first match ... search back ... replace" is robust against nested or multiple blocks.

    // If we didn't find the pair, append to end.
    const prefix = content.endsWith('\n') ? '' : '\n';
    return `${content}${prefix}\n${newContentBlock}\n`;
}
