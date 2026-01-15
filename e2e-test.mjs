import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert';

const execAsync = promisify(exec);
const TEST_DIR = 'test';

async function run() {
    console.log('--- Starting Assumption Checks ---');

    // Cleanup
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_DIR, { recursive: true });

    // 1. Setup Files
    // ============

    // Normal included file
    await fs.writeFile(path.join(TEST_DIR, 'included.txt'), 'content included');

    // Default Ignored: node_modules
    await fs.mkdir(path.join(TEST_DIR, 'node_modules'), { recursive: true });
    await fs.writeFile(path.join(TEST_DIR, 'node_modules/bad.txt'), 'bad stuff');

    // Default Ignored: .git
    await fs.mkdir(path.join(TEST_DIR, '.git'), { recursive: true });
    await fs.writeFile(path.join(TEST_DIR, '.git/config'), 'git config');

    // Explicitly Ignored via .agentsignore
    await fs.writeFile(path.join(TEST_DIR, '.agentsignore'), 'ignored_folder/\n');
    await fs.mkdir(path.join(TEST_DIR, 'ignored_folder'), { recursive: true });
    await fs.writeFile(path.join(TEST_DIR, 'ignored_folder/secret.txt'), 'secret');

    // Explicitly Ignored via .gitignore
    await fs.writeFile(path.join(TEST_DIR, '.gitignore'), 'git_ignored.txt\nignored.ts\n');
    await fs.writeFile(path.join(TEST_DIR, 'git_ignored.txt'), 'should be ignored by git');
    await fs.writeFile(path.join(TEST_DIR, 'ignored.ts'), 'should be ignored even with -i *.ts');

    // Nested file (should be included)
    await fs.mkdir(path.join(TEST_DIR, 'src'), { recursive: true });
    await fs.writeFile(path.join(TEST_DIR, 'src/code.ts'), 'console.log("hello")');
    await fs.writeFile(path.join(TEST_DIR, 'src/utils.ts'), 'export const foo = 1;');
    await fs.writeFile(path.join(TEST_DIR, 'src/style.css'), 'body { color: red; }');

    // Documentation files
    await fs.writeFile(path.join(TEST_DIR, 'README.md'), '# My Docs');
    await fs.writeFile(path.join(TEST_DIR, 'LICENSE'), 'MIT License');
    await fs.writeFile(path.join(TEST_DIR, 'LICENSE.txt'), 'MIT License text');
    await fs.writeFile(path.join(TEST_DIR, 'COPYING'), 'GPL License');
    await fs.writeFile(path.join(TEST_DIR, 'CHANGELOG.md'), '# Changelog');

    console.log('Files created.');

    // 2. Run the tool (Default)
    // ============
    const binPath = path.resolve('dist/index.js');
    console.log(`Running ${binPath} in ${TEST_DIR} (default mode)...`);

    try {
        const { stdout, stderr } = await execAsync(`node ${binPath}`, { cwd: TEST_DIR });
        if (stderr) console.error('Tool stderr:', stderr);
    } catch (e) {
        console.error('Execution failed:', e);
        process.exit(1);
    }

    // 3. Check results (Default)
    // ============
    const agentsMdPath = path.join(TEST_DIR, 'agents.md');
    try {
        let result = await fs.readFile(agentsMdPath, 'utf-8');

        // Assertions - Check for headers like "./included.txt:"
        assert.ok(result.includes('./included.txt:'), 'Should include root included file');
        assert.ok(result.includes('./src/code.ts:'), 'Should include nested file');
        assert.ok(result.includes('./README.md:'), 'Should include README.md by default');
        assert.ok(result.includes('./LICENSE:'), 'Should include LICENSE by default');

        assert.ok(!result.includes('./node_modules/bad.txt:'), 'Should ignore node_modules by default');
        assert.ok(!result.includes('./.git/config:'), 'Should ignore .git by default');

        assert.ok(!result.includes('./ignored_folder/secret.txt:'), 'Should ignore local .agentsignore patterns');
        assert.ok(!result.includes('./git_ignored.txt:'), 'Should ignore local .gitignore patterns');

        console.log('✅ Default checks passed!');

        // 4. Run the tool (With --docs)
        // ============
        console.log(`Running ${binPath} in ${TEST_DIR} with --docs...`);
        await fs.rm(agentsMdPath);

        await execAsync(`node ${binPath} --docs`, { cwd: TEST_DIR });
        result = await fs.readFile(agentsMdPath, 'utf-8');

        assert.ok(result.includes('./included.txt:'), 'Should still include root file with --docs');
        assert.ok(!result.includes('./README.md:'), 'Should EXCLUDE README.md with --docs');
        assert.ok(!result.includes('./LICENSE:'), 'Should EXCLUDE LICENSE with --docs');
        assert.ok(!result.includes('./LICENSE.txt:'), 'Should EXCLUDE LICENSE.txt with --docs');
        assert.ok(!result.includes('./COPYING:'), 'Should EXCLUDE COPYING with --docs');
        assert.ok(!result.includes('./CHANGELOG.md:'), 'Should EXCLUDE CHANGELOG.md with --docs');

        console.log('✅ --docs checks passed!');

        // 5. Run the tool (With -i include patterns)
        // ============
        console.log(`Running ${binPath} in ${TEST_DIR} with -i "*.ts"...`);
        await fs.rm(agentsMdPath);

        await execAsync(`node ${binPath} -i "*.ts"`, { cwd: TEST_DIR });
        result = await fs.readFile(agentsMdPath, 'utf-8');

        // Should ONLY include .ts files
        assert.ok(result.includes('./src/code.ts:'), 'Should include code.ts with -i "*.ts"');
        assert.ok(result.includes('./src/utils.ts:'), 'Should include utils.ts with -i "*.ts"');
        assert.ok(!result.includes('./included.txt:'), 'Should EXCLUDE .txt files with -i "*.ts"');
        assert.ok(!result.includes('./src/style.css:'), 'Should EXCLUDE .css files with -i "*.ts"');
        assert.ok(!result.includes('./README.md:'), 'Should EXCLUDE .md files with -i "*.ts"');

        // .gitignore should still be respected even with -i
        assert.ok(!result.includes('./ignored.ts:'), 'Should STILL respect .gitignore with -i');

        console.log('✅ -i include pattern checks passed!');

        // 6. Run the tool (With -i multiple patterns)
        // ============
        console.log(`Running ${binPath} in ${TEST_DIR} with -i "*.ts, *.css"...`);
        await fs.rm(agentsMdPath);

        await execAsync(`node ${binPath} -i "*.ts, *.css"`, { cwd: TEST_DIR });
        result = await fs.readFile(agentsMdPath, 'utf-8');

        assert.ok(result.includes('./src/code.ts:'), 'Should include .ts with multiple patterns');
        assert.ok(result.includes('./src/style.css:'), 'Should include .css with multiple patterns');
        assert.ok(!result.includes('./included.txt:'), 'Should EXCLUDE .txt with multiple patterns');

        console.log('✅ -i multiple pattern checks passed!');

        // 7. Check Robust Replacement (Multiple Blocks)
        // ============
        console.log('Testing robust replacement...');
        const brokenContent = `
Header
<full-context-dump>
Block 1
</full-context-dump>
Garbage
<full-context-dump>
Block 2
</full-context-dump>
Footer
`;
        await fs.writeFile(agentsMdPath, brokenContent);

        // Run again (using default options, doesn't matter)
        await execAsync(`node ${binPath}`, { cwd: TEST_DIR });
        result = await fs.readFile(agentsMdPath, 'utf-8');

        assert.ok(result.includes('Header'), 'Should preserve Header');
        assert.ok(result.includes('Footer'), 'Should preserve Footer');
        assert.ok(result.includes('./included.txt:'), 'Should have new content');

        // Should NOT have Block 1, Block 2, or Garbage
        assert.ok(!result.includes('Block 1'), 'Should remove Block 1');
        assert.ok(!result.includes('Block 2'), 'Should remove Block 2');
        assert.ok(!result.includes('Garbage'), 'Should remove garbage between blocks');

        // Should only have ONE set of tags (count occurrences)
        const openTags = (result.match(/<full-context-dump>/g) || []).length;
        const closeTags = (result.match(/<\/full-context-dump>/g) || []).length;
        assert.strictEqual(openTags, 1, 'Should have exactly one open tag');
        assert.strictEqual(closeTags, 1, 'Should have exactly one close tag');

        console.log('✅ Robust replacement checks passed!');

    } catch (e) {
        console.error('❌ Check failed:', e.message);
        console.error('Result content was:\n', (await fs.readFile(agentsMdPath, 'utf-8')));
        process.exit(1);
    }

    // Cleanup
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    console.log('Cleanup done.');
    console.log('\n✅ All e2e tests passed!');
}

run();

