export const IGNORE_FILE_PATTERNS = `# Auto-generated .agentsignore
# ============================================================
# Goal: keep source + config, drop generated, binary, cache, deps, secrets
# ============================================================

# --- Version Control ---
.git
.hg
.svn

# --- Package Managers & Locks ---
package-lock.json
pnpm-lock.yaml
yarn.lock
bun.lockb
npm-debug.log*
yarn-error.log*
.pnpm-debug.log*
Cargo.lock
Gemfile.lock
composer.lock
poetry.lock
Pipfile.lock

# --- IDEs & Editors ---
.idea
.vscode
*.code-workspace
*.suo
*.ntvs*
*.njsproj
*.sln
*.swp
*.swo
*.tmp
.DS_Store
Thumbs.db
*.bak
*.orig

# --- Secrets / Credentials (safety) ---
.env
.env.*
!.env.example
!.env.sample
.envrc
*.pem
*.key
*.p12
*.pfx
id_rsa
id_ed25519
*.asc
*.gpg
*.kdbx

# --- Logs ---
*.log
logs
log

# --- OS / Temp ---
tmp
temp
*.pid
*.seed

# --- Testing & Coverage ---
coverage
.nyc_output
*.lcov
*.lcov.info
test-results
junit.xml
playwright-report

# --- Build / Dist / Artifacts ---
dist
build
out
target
bin
obj
*.exe
*.dll
*.so
*.dylib
*.a
*.o
*.obj
*.pdb
*.dSYM
*.class
*.jar
*.war
*.ear
*.apk
*.aab

# --- Caches ---
.cache
.parcel-cache
.turbo
.vite
.eslintcache
.stylelintcache
.rspack-cache
.rollup.cache
storybook-static
.next
.nuxt
.svelte-kit
.angular
.output

# --- Dependencies / Vendored ---
node_modules
vendor
bower_components

# --- Python ---
__pycache__
*.py[cod]
*.pyd
.venv
venv
env
.conda
.mypy_cache
.pytest_cache
.ruff_cache
.tox
.eggs
*.egg-info
pip-wheel-metadata

# --- Java / Kotlin / Gradle ---
.gradle
.mvn
.classpath
.project
.settings

# --- Go ---
pkg
*.test

# --- Ruby ---
.bundle
vendor/bundle

# --- Elixir / Erlang ---
_build
deps

# --- Haskell ---
dist-newstyle
.stack-work

# --- Documentation & Large Assets ---
docs
*.drawio
*.pdf
*.jpg
*.jpeg
*.png
*.gif
*.ico
*.svg
*.webp
*.psd
*.ai
*.sketch
*.fig
*.woff
*.woff2
*.ttf
*.eot
*.mp4
*.webm
*.mov
*.mp3
*.wav

# --- Archives / Dumps ---
*.zip
*.tar
*.gz
*.tar.gz
*.tgz
*.rar
*.7z
*.iso
*.dmg

# --- Databases / Local data ---
*.sqlite
*.sqlite3
*.db
*.mdb
*.rdb

# --- Agent-specific / meta docs ---
agents.md
.agentsignore
`;

export const DOCS_FILE_PATTERNS: Array<string> = [
    '*.md',
    '*.markdown',
    '*.asciidoc',
    '*.adoc',
    '*.rst',
    '*.asc',
    'LICENSE',
    'LICENSE*',
    'LICENSE-*',
    'COPYING',
    'COPYING*',
    'CHANGELOG',
    'CHANGELOG*',
    'CONTRIBUTING',
    'CONTRIBUTING*',
    'CODE_OF_CONDUCT',
    'CODE_OF_CONDUCT*',
    'CONTRIBUTORS',
    'CONTRIBUTORS*',
];

export const TEST_FILE_PATTERNS: Array<string> = [
    '**/*.test.*',
    '**/*.spec.*',
    '**/test/**',
    '**/tests/**',
    '**/__tests__/**',
    '**/e2e/**',
];

export const STYLES_FILE_PATTERNS: Array<string> = [
    '**/*.css',
    '**/*.scss',
    '**/*.sass',
    '**/*.less',
    '**/*.styl',
    '**/*.stylus',
    '**/*.pcss',
];

export const IGNORE_FILES: Array<string> = ['.gitignore', '.agentsignore'];

export const DEFAULT_TAG_NAME = 'full-context-dump';

/**
 * Generates an opening tag with optional attributes
 */
export const makeOpenTag = (tagName: string = DEFAULT_TAG_NAME, attributes?: Record<string, string>): string => {
    if (!attributes || Object.keys(attributes).length === 0) {
        return `<${tagName}>`;
    }

    const attrString = Object.entries(attributes)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');

    return `<${tagName} ${attrString}>`;
};

/**
 * Generates a closing tag
 */
export const makeCloseTag = (tagName: string = DEFAULT_TAG_NAME): string => {
    return `</${tagName}>`;
};

// Legacy exports for backward compatibility
export const OPEN_TAG = '<full-context-dump>';
export const CLOSE_TAG = '</full-context-dump>';
