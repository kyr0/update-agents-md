import minimist from "minimist";

export interface CliArgs {
    follow: boolean;
    excludeDocs: boolean;
    lines?: number;
    chars?: number;
    targetDir: string;
    help: boolean;
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

export const parseArgs = (argv: Array<string>): CliArgs => {
    const parsed = minimist(argv, {
        boolean: ["follow", "docs", "help"],
        alias: {
            f: "follow",
            l: "lines",
            c: "chars",
            d: "docs",
            h: "help",
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

    const targetDir = typeof parsed._[0] === "string" ? parsed._[0] : ".";

    return { follow, excludeDocs, lines, chars, targetDir, help: Boolean(parsed.help) };
};
