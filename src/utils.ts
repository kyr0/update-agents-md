import { Buffer } from 'node:buffer';
import * as fsp from 'node:fs/promises';
import { OPEN_TAG, CLOSE_TAG } from './config.js';

/**
 * checks if a buffer contains binary data via simple heuristic
 */
export const isBinary = (buffer: Buffer): boolean => {
    const length = Math.min(buffer.length, 512);
    let suspicionScore = 0;

    for (let i = 0; i < length; i++) {
        const byte = buffer[i];

        // NUL is a strong binary indicator
        if (byte === 0x00) return true;

        // control characters except TAB(9), LF(10), CR(13)
        if ((byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) || byte === 127) {
            suspicionScore++;
        }
    }

    return length > 0 && suspicionScore / length > 0.1;
};

/**
 * reads first 512 bytes to detect binary-ish files; on error we treat as binary/skippable
 */
export const isBinaryFile = async (filePath: string): Promise<boolean> => {
    let handle: fsp.FileHandle | undefined;
    try {
        handle = await fsp.open(filePath, 'r');
        const buffer = Buffer.alloc(512);
        const result = await handle.read(buffer, 0, 512, 0);
        if (result.bytesRead === 0) return false;
        return isBinary(buffer.subarray(0, result.bytesRead));
    } catch {
        // reading failed -> skip it defensively
        return true;
    } finally {
        await handle?.close();
    }
};

/**
 * replaces any existing <full-context-dump>...</full-context-dump> block(s)
 * with the given sourceCode; if not present, appends a fresh block
 */
export const replaceOrAppendTags = (content: string, sourceCode: string): string => {
    const newContentBlock = `${OPEN_TAG}\n${sourceCode}\n${CLOSE_TAG}`;
    const startIndex = content.indexOf(OPEN_TAG);
    const endIndex = content.lastIndexOf(CLOSE_TAG);

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        const pre = content.substring(0, startIndex);
        const post = content.substring(endIndex + CLOSE_TAG.length);
        return pre + newContentBlock + post;
    }

    if (startIndex !== -1 && endIndex === -1) {
        const pre = content.substring(0, startIndex);
        return pre + newContentBlock;
    }

    const prefix = content.endsWith('\n') ? '' : '\n';
    return `${content}${prefix}\n${newContentBlock}\n`;
};
