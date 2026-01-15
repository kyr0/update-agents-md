import minimist from "minimist";

export interface CliArgs {
    follow: boolean;
    excludeDocs: boolean;
    lines?: number;
    chars?: number;
    targetDir: string;
    help: boolean;
    includePatterns: Array<string>;
}

export const parseOptionalInt = (value: unknown, fallback?: unknown): number | undefined => {
    const raw = value ?? fallback;
    if (raw === undefined) return undefined;

    const parsed = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
    if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
        throw new Error(`invalid numeric value: "${String(raw)}"`);
    }

    return parsed;
};

/**
 * Parses comma-separated include patterns from -i/--include argument.
 * Example: "*.ts, *.c" -> ["*.ts", "*.c"]
 */
export const parseIncludePatterns = (value: unknown): Array<string> => {
    if (value === undefined || value === null || value === false || value === true) {
        return [];
    }

    const raw = String(value);
    if (!raw.trim()) return [];

    return raw.split(",").map((p) => p.trim()).filter((p) => p.length > 0);
};

export const parseArgs = (argv: Array<string>): CliArgs => {
    const parsed = minimist(argv, {
        boolean: ["follow", "docs", "help"],
        string: ["include"],
        alias: {
            f: "follow",
            l: "lines",
            c: "chars",
            d: "docs",
            h: "help",
            i: "include",
        },
        default: {
            follow: false,
            docs: false,
            help: false,
        },
    });

    const follow = Boolean(parsed.follow);
    // --docs currently means "exclude docs" (kept for backward-compat with your tests/behavior)
    const excludeDocs = Boolean(parsed.docs);

    const lines = parseOptionalInt(parsed.lines, parsed.l);
    const chars = parseOptionalInt(parsed.chars, parsed.c);
    const includePatterns = parseIncludePatterns(parsed.include);

    const targetDir = typeof parsed._[0] === "string" ? parsed._[0] : ".";

    return { follow, excludeDocs, lines, chars, targetDir, help: Boolean(parsed.help), includePatterns };
};
