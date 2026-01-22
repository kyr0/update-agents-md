import { Buffer } from "node:buffer";
import { open } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { OPEN_TAG, CLOSE_TAG, makeOpenTag, makeCloseTag, DEFAULT_TAG_NAME } from "./config.js";

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
    let handle: FileHandle | undefined;

    try {
        handle = await open(filePath, "r");
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
 * Creates a regex pattern to match an opening tag with any attributes
 */
const makeOpenTagPattern = (tagName: string): RegExp => {
    // Matches <tagName> or <tagName attr="value" ...>
    const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`<${escapedTag}(?:\\s[^>]*)?>`, 'g');
};

/**
 * Creates a regex pattern to match a closing tag
 */
const makeCloseTagPattern = (tagName: string): RegExp => {
    const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`</${escapedTag}>`, 'g');
};

/**
 * Finds the position of the first opening tag in content
 */
const findFirstOpenTag = (content: string, tagName: string): number => {
    const pattern = makeOpenTagPattern(tagName);
    const match = pattern.exec(content);
    return match ? match.index : -1;
};

/**
 * Finds the position of the last closing tag in content
 */
const findLastCloseTag = (content: string, tagName: string): number => {
    const pattern = makeCloseTagPattern(tagName);
    let lastIndex = -1;
    let match: RegExpExecArray | null;
    
    while ((match = pattern.exec(content)) !== null) {
        lastIndex = match.index;
    }
    
    return lastIndex;
};

/**
 * replaces any existing tag blocks with the given sourceCode
 * supports custom tag names and attributes
 */
export const replaceOrAppendTags = (
    content: string, 
    sourceCode: string, 
    tagName: string = DEFAULT_TAG_NAME, 
    attributes?: Record<string, string>
): string => {
    const openTag = makeOpenTag(tagName, attributes);
    const closeTag = makeCloseTag(tagName);
    const newContentBlock = `${openTag}\n${sourceCode}\n${closeTag}`;
    
    const startIndex = findFirstOpenTag(content, tagName);
    const closeTagLength = closeTag.length;
    
    if (startIndex === -1) {
        // No existing tag found - append
        const prefix = content.endsWith("\n") ? "" : "\n";
        return `${content}${prefix}\n${newContentBlock}\n`;
    }
    
    const endIndex = findLastCloseTag(content, tagName);
    
    if (endIndex !== -1 && endIndex > startIndex) {
        // Found both tags - replace content between first open and last close
        const pre = content.substring(0, startIndex);
        const post = content.substring(endIndex + closeTagLength);
        return pre + newContentBlock + post;
    }
    
    // Found open tag but no close tag - replace from open tag onwards
    const pre = content.substring(0, startIndex);
    return pre + newContentBlock;
};

/**
 * Legacy version for backward compatibility
 */
export const replaceOrAppendTagsLegacy = (content: string, sourceCode: string): string => {
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

    const prefix = content.endsWith("\n") ? "" : "\n";
    return `${content}${prefix}\n${newContentBlock}\n`;
};
