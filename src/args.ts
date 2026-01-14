import minimist from 'minimist';

export interface CliArgs {
    follow: boolean;
    excludeDocs: boolean;
    lines?: number;
    chars?: number;
    targetDir: string;
}

export const parseArgs = (argv: Array<string>): CliArgs => {
    const parsed = minimist(argv, {
        string: ['f', 'chars'],
        boolean: ['follow', 'docs'],
        alias: {
            f: 'follow',
            l: 'lines',
            c: 'chars',
            d: 'docs'
        }
    });

    const follow = Boolean(parsed.follow || parsed.f);
    const excludeDocs = Boolean(parsed.docs || parsed.d);
    const lines = parsed.lines || parsed.l ? parseInt(String(parsed.lines ?? parsed.l), 10) : undefined;
    const chars = parsed.chars ? parseInt(String(parsed.chars), 10) : undefined;

    const targetDir = parsed._[0] || '.';

    return { follow, excludeDocs, lines, chars, targetDir };
};
