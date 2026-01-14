export const IGNORE_FILE_PATTERNS = `# Auto-generated .agentsignore
# Package Managers & Locks
package-lock.json
pnpm-lock.yaml
yarn.lock
bun.lockb
Cargo.lock
Gemfile.lock
composer.lock

# IDEs & Editors
.git
.idea
.vscode
.DS_Store
*.swp

# Testing & Coverage
coverage
.nyc_output

# Build & Dist
dist
build
out
target
bin
obj

# Documentation & Assets
node_modules
docs
*.pdf
*.jpg
*.jpeg
*.png
*.gif
*.ico
*.svg
*.woff
*.woff2
*.ttf
*.eot
*.mp4
*.webm
*.mp3
*.wav
*.zip
*.tar.gz
*.tgz
*.rar
*.7z
agents.md
`;

export const DOCS_FILE_PATTERNS: Array<string> = [
    '*.md',
    '*.markdown',
    '*.asciidoc',
    '*.adoc',
    '*.rst',
    'LICENSE',
    'LICENSE*',
    'CHANGELOG',
    'CHANGELOG*'
];

export const IGNORE_FILES: Array<string> = ['.gitignore', '.agentsignore'];

export const OPEN_TAG = '<full-context-dump>';
export const CLOSE_TAG = '</full-context-dump>';
