#!/usr/bin/env node

import { Command } from 'commander'
import { release } from '../lib/release.js'
import { changelog } from '../lib/changelog.js'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')

const program = new Command()

program
  .name('coralite-plugin-scripts')
  .description('Utility scripts for Coralite plugins')
  .version(pkg.version)

program
  .command('release')
  .description('Create a new release')
  .argument('[type]', 'Release type (major, minor, patch)')
  .option('-d, --dry-run', 'Show what would be done without making changes')
  .option('-y, --yes', 'Skip confirmation prompts')
  .option('-p, --preid <identifier>', 'Identifier for prerelease version')
  .option('-m, --message <message>', 'Custom release commit message')
  .option('--no-git-tag', 'Skip creating git tag')
  .option('--no-git-commit', 'Skip git commit')
  .action(release)

program
  .command('changelog')
  .description('Generate changelog')
  .option('-f, --from <tag>', 'Starting tag (defaults to last tag)')
  .option('-t, --to <tag>', 'Ending tag (defaults to HEAD)')
  .option('--next-version <version>', 'Version number for the new release')
  .option('-o, --output <file>', 'Output file (defaults to CHANGELOG.md)')
  .option('-y, --yes', 'Skip confirmation')
  .option('--stdout', 'Print to stdout only')
  .action(changelog)

program.parse()
