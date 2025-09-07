# Coralite release

This package provides two CLI tools for managing releases and generating changelogs:

1. `coralite-release` - Creates new git release tags and bumps package versions
2. `coralite-changelog` - Generates a markdown changelog based on commits between git tags

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