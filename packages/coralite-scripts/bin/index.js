#!/usr/bin/env -S node --experimental-vm-modules --experimental-import-meta-resolve

import loadConfig from '../libs/load-config.js'
import { Command } from 'commander'
import server from '../libs/server.js'
import pkg from '../package.json' with { type: 'json' }
import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { buildCommand } from '../libs/commands/build.js'
import { checkCommand } from '../libs/commands/check.js'
import { fixCommand } from '../libs/commands/fix.js'
import { parseAssetMapping, mergeAssets } from '../libs/assets.js'

// remove all Node warnings before doing anything else
process.removeAllListeners('warning')

const program = new Command()

program
  .name('coralite-scripts')
  .description(pkg.description)
  .version(pkg.version)

// dev command (default)
program
  .command('dev', { isDefault: true })
  .description('Run development server')
  .option('-v, --verbose', 'Enable verbose logging output')
  .option('-c, --clean', 'Clear the output directory before building')
  .option('-a, --assets <mapping...>', 'Static assets to copy during build. Format: pkg:path:dest or src:dest')
  .option('--no-incremental', 'Disable change detection optimization and rebuild all pages and components')
  .action(async (options, cmd) => {
    const config = await loadConfig(process.cwd())
    if (!config) {
      process.exit(1)
    }

    options.incrementalSource = cmd.getOptionValueSource('incremental')

    if (options.assets) {
      try {
        const cliAssets = options.assets.map(parseAssetMapping)
        config.assets = mergeAssets(config.assets, cliAssets)
      } catch (err) {
        console.error(`\n  Error: ${err.message}\n`)
        process.exit(1)
      }
    }

    config.output = join(process.cwd(), '.coralite')
    await mkdir(config.output, { recursive: true })

    await server(config, options, 'dev')
  })

// test command
program
  .command('test')
  .description('Run testing server')
  .option('-v, --verbose', 'Enable verbose logging output')
  .option('-c, --clean', 'Clear the output directory before building')
  .option('-a, --assets <mapping...>', 'Static assets to copy during build. Format: pkg:path:dest or src:dest')
  .option('--no-incremental', 'Disable change detection optimization and rebuild all pages and components')
  .action(async (options, cmd) => {
    const config = await loadConfig(process.cwd())
    if (!config) {
      process.exit(1)
    }

    options.incrementalSource = cmd.getOptionValueSource('incremental')

    if (options.assets) {
      try {
        const cliAssets = options.assets.map(parseAssetMapping)
        config.assets = mergeAssets(config.assets, cliAssets)
      } catch (err) {
        console.error(`\n  Error: ${err.message}\n`)
        process.exit(1)
      }
    }

    config.output = join(process.cwd(), '.coralite')
    await mkdir(config.output, { recursive: true })

    await server(config, options, 'test')
  })

// build command
program
  .command('build')
  .description('Build site for production')
  .option('-v, --verbose', 'Enable verbose logging output')
  .option('-c, --clean', 'Clear the output directory before building')
  .option('-a, --assets <mapping...>', 'Static assets to copy during build. Format: pkg:path:dest or src:dest')
  .option('--no-incremental', 'Disable change detection optimization and rebuild all pages and components')
  .action(async (options, cmd) => {
    const config = await loadConfig(process.cwd())
    if (!config) {
      process.exit(1)
    }

    options.incrementalSource = cmd.getOptionValueSource('incremental')

    if (options.assets) {
      try {
        const cliAssets = options.assets.map(parseAssetMapping)
        config.assets = mergeAssets(config.assets, cliAssets)
      } catch (err) {
        console.error(`\n  Error: ${err.message}\n`)
        process.exit(1)
      }
    }

    try {
      await buildCommand(config, options)
    } catch {
      process.exit(1)
    }
  })

// check command
program
  .command('check')
  .description('Run unified validation pass across Components, Plugins, and Pages')
  .option('-c, --components <path>', 'Path to components directory')
  .option('-p, --plugins <path>', 'Path to plugin file or directory')
  .option('--pages <path>', 'Path to pages directory')
  .option('--format <format>', 'Output format: "console" or "json"', 'console')
  .option('--strict', 'Fail with non-zero exit code if warnings or unused code exist', false)
  .option('--coverage', 'Include component test execution coverage metrics', false)
  .action(async (options) => {
    const config = await loadConfig(process.cwd(), { silent: true })
    const res = await checkCommand(config, options)
    if (res.hasFailures) {
      process.exit(1)
    }
  })

// fix command
program
  .command('fix')
  .description('Run workspace auto-fixers across Components and Plugins')
  .option('-c, --components <path>', 'Path to components directory')
  .option('-p, --plugins <path>', 'Path to plugin file or directory')
  .option('--pages <path>', 'Path to pages directory')
  .option('--dry-run', 'Preview changes that would be made without writing to disk', false)
  .action(async (options) => {
    const config = await loadConfig(process.cwd(), { silent: true })
    const res = await fixCommand(config, options)
    if (res.hasFailures) {
      process.exit(1)
    }
  })

await program.parseAsync(process.argv)
