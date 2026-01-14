# update-agents-md

A tiny, fast, cross-platform Node.js CLI tool to aggregate meaningful source code from a project into a single `agents.md` file (or update an existing one). It respects nested `.gitignore` and `.agentsignore` files.

## Features
- **Smart Scanning**: Recursively scans directories, respecting nested gitignore/agentsignore rules.
- **Binary Exclusion**: Automatically detects and excludes binary files.
- **Metadata Handling**: Updates content between `<full-context-dump>` tags in `agents.md`.
- **Configurable**: optional size limits for lines per file and/or total characters.

## Usage

```bash
npx update-agents-md [directory] [options]
```

### Options
- `-f, --follow`: Follow symbolic links (default: false).
- `-l, --lines <number>`: Max lines to include per file.
- `-c, --chars <number>`: Max total characters to collect.

### Example

```bash
# Scan current directory
npx update-agents-md .

# Scan specific directory with limits
npx update-agents-md ./src -l 50
```