> ⚠️ **NOTE: This is a read-only mirror.** Development happens on [Codeberg](https://codeberg.org/tjdavid/coralite).

# Coralite release

Requires Node.js v20.19.0 or higher (Node.js v24 LTS recommended).

This package provides three CLI tools for managing releases, generating changelogs, and compiling release posts:

1. `coralite-release` - Creates new git release tags and bumps package versions
2. `coralite-changelog` - Generates a markdown changelog based on commits between git tags
3. `coralite-release-post` - Generates an AI-powered release post based on commits between git tags

## Installation

Install this package as a development dependency in your project:

```bash
npm install --save-dev coralite-release
```

## Usage

### coralite-release

This command creates new releases by bumping versions and tagging commits.

#### Options:
- `-d, --dry-run`: Show what would be done without making changes
- `-y, --yes`: Skip confirmation prompts
- `-p, --preid <identifier>`: Identifier for prerelease version (e.g., "alpha", "beta")
- `-m, --message <message>`: Custom release commit message
- `--no-git-tag`: Skip creating git tag
- `--no-git-commit`: Skip git commit (only update package.json files)

#### Examples:

```bash
# Bump patch version and create new tag
coralite-release patch

# Create a prerelease with custom identifier
coralite-release prerelease --preid beta

# Dry run to see what would happen
coralite-release minor --dry-run
```

### coralite-changelog

This command generates changelogs based on git commits between tags.

#### Options:
- `-f, --from <tag>`: Starting tag (defaults to last tag)
- `-t, --to <tag>`: Ending tag (defaults to HEAD)
- `-o, --output <file>`: Output file (defaults to stdout)
- `-y, --yes`: Skip confirmation
- `--stdout`: Print to stdout only, ignore output file

#### Examples:

```bash
# Generate changelog from last tag to HEAD
coralite-changelog

# Generate changelog between specific tags and save to file
coralite-changelog -f v1.0.0 -t v2.0.0 -o CHANGELOG.md

# Print changelog to stdout only (no file write)
coralite-changelog --stdout
```

### coralite-release-post

This command generates a structured GitHub Release Post based on commits and technical summaries. You can choose to generate the post via HTTP API (e.g. LM Studio / OpenAI endpoint) or natively using the `agy` CLI (either interactively or via the `--agy` flag). You can also use `--json` to output raw release data.

#### Options:
- `-f, --from <tag>`: Starting tag (defaults to previous tag)
- `-t, --to <tag>`: Ending tag (defaults to selected new tag)
- `--package <name>`: Package name (for tag filtering)
- `--path <path>`: Package path (for commit filtering and output)
- `-o, --output <file>`: Output file (defaults to package/RELEASE_POST.md or RELEASE_POST.md)
- `--api-endpoint <url>`: OpenAI API endpoint (defaults to http://localhost:1234/v1)
- `--api-key <key>`: OpenAI API key (defaults to lm-studio)
- `--model <model>`: OpenAI Model to use (defaults to local-model)
- `--agy`: Use the `agy` CLI tool to generate the release post
- `-y, --yes`: Skip confirmation
- `--stdout`: Print to stdout only, ignore output file
- `--no-git`: Skip git commit and push
- `--json`: Output the gathered data in JSON format instead of calling the AI provider

#### Examples:

```bash
# Generate a release post interactively (prompts for package, tags, highlights, and AI provider like agy or HTTP endpoint)
coralite-release-post

# Directly generate using the agy CLI
coralite-release-post --agy

# Output the release post data to stdout in JSON format (interactive prompts write to stderr)
coralite-release-post --json > release_data.json

# Run non-interactively using the TEST_NON_INTERACTIVE env variable with agy
TEST_NON_INTERACTIVE=true coralite-release-post --package coralite-scripts --from coralite-scripts-v0.27.0 --to coralite-scripts-v0.28.0 --agy
```