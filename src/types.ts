import { spawn } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import * as os from "node:os";

export interface TypeGenResult {
    filePath: string;
    dtsContent: string | undefined;
    error?: string;
}

/**
 * Runs dts-gen for a single file using --expression-file
 */
const runDtsGen = (inputPath: string, outputPath: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const child = spawn(
            "npx",
            ["-y", "dts-gen", "--expression-file", inputPath, "--file", outputPath, "--overwrite"],
            {
                stdio: ["ignore", "pipe", "pipe"],
                shell: true,
            },
        );

        let stderr = "";
        child.stderr?.on("data", (data: Buffer) => {
            stderr += data.toString();
        });

        child.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`dts-gen failed with code ${code}: ${stderr}`));
        });

        child.on("error", reject);
    });
};

/**
 * Generates .d.ts content for a TypeScript file using dts-gen
 */
export const generateDtsForFile = async (filePath: string): Promise<TypeGenResult> => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "dts-gen-"));
    const baseName = path.basename(filePath, ".ts");
    const outputPath = path.join(tempDir, `${baseName}.d.ts`);

    try {
        await runDtsGen(filePath, outputPath);
        const content = await fs.readFile(outputPath, "utf-8");
        return { filePath, dtsContent: content };
    } catch (err) {
        return {
            filePath,
            dtsContent: undefined,
            error: err instanceof Error ? err.message : String(err),
        };
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => { });
    }
};

/**
 * Batch generate .d.ts for multiple files with bounded concurrency
 * Only processes .ts files (excluding .d.ts files)
 */
export const generateDtsForFiles = async (
    files: Array<string>,
    concurrency = 5,
): Promise<Map<string, string>> => {
    const results = new Map<string, string>();
    const tsFiles = files.filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"));

    if (tsFiles.length === 0) {
        return results;
    }

    console.log(`Generating type declarations for ${tsFiles.length} TypeScript file(s)...`);

    for (let i = 0; i < tsFiles.length; i += concurrency) {
        const chunk = tsFiles.slice(i, i + concurrency);
        const chunkResults = await Promise.all(chunk.map(generateDtsForFile));

        for (const result of chunkResults) {
            if (result.dtsContent) {
                results.set(result.filePath, result.dtsContent);
            } else if (result.error) {
                // Log errors but continue processing other files
                console.warn(`  Warning: Could not generate .d.ts for ${path.basename(result.filePath)}: ${result.error}`);
            }
        }
    }

    console.log(`  Generated ${results.size} type declaration(s)`);
    return results;
};
