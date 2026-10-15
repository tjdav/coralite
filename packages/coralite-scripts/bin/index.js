#!/usr/bin/env -S node --experimental-vm-modules --experimental-import-meta-resolve

import loadConfig from '../libs/load-config.js'
import { Command } from 'commander'
import kleur from 'kleur'
import server from '../libs/server.js'
import pkg from '../package.json' with { type: 'json' }
import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { buildCommand } from '../libs/commands/build.js'
import { checkCommand } from '../libs/commands/check.js'
import { fixCommand } from '../libs/commands/fix.js'
import { parseAssetMapping, mergeAssets } from '../libs/assets.js'
import {
  promptCheckOptions,
  promptFixOptions,
  confirmApplyFixes
} from '../libs/interactive.js'
import { existsSync } from 'node:fs'

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
  .option('-e, --error-code <codes...>', 'Filter output by error code (e.g. CORALITE-E201 or E201)')
  .option('--code <codes...>', 'Alias for --error-code')
  .option('--status <status>', 'Filter output by status: "failed", "passed", or "all"')
  .option('--only-failed', 'Display only failed files with errors or warnings', false)
  .option('--strict', 'Fail with non-zero exit code if warnings or unused code exist', false)
  .option('--coverage', 'Include component test execution coverage metrics', false)
  .option('-i, --interactive', 'Run in interactive prompt mode', false)
  .option('--no-interactive', 'Force non-interactive execution')
  .action(async (options, cmd) => {
    try {
      const isTTY = Boolean(process.stdout.isTTY)
      const isCI = Boolean(process.env.CI)

      const hasExplicitTargetFlags =
        cmd.getOptionValueSource('components') === 'cli' ||
        cmd.getOptionValueSource('plugins') === 'cli' ||
        cmd.getOptionValueSource('pages') === 'cli' ||
        cmd.getOptionValueSource('errorCode') === 'cli' ||
        cmd.getOptionValueSource('code') === 'cli' ||
        cmd.getOptionValueSource('status') === 'cli' ||
        cmd.getOptionValueSource('onlyFailed') === 'cli' ||
        cmd.getOptionValueSource('strict') === 'cli' ||
        cmd.getOptionValueSource('coverage') === 'cli' ||
        cmd.getOptionValueSource('format') === 'cli'

      const shouldPrompt =
        (options.interactive || (isTTY && !isCI && !hasExplicitTargetFlags)) &&
        !options.noInteractive

      let checkOpts = { ...options }

      if (shouldPrompt) {
        const cwd = process.cwd()
        const promptRes = await promptCheckOptions({
          cwd,
          hasComponents: existsSync(join(cwd, 'src/components')) || existsSync(join(cwd, 'components')) || existsSync(join(cwd, 'tests/fixtures/components')),
          hasPages: existsSync(join(cwd, 'src/pages')) || existsSync(join(cwd, 'pages')) || existsSync(join(cwd, 'tests/fixtures/pages')),
          hasPlugins: existsSync(join(cwd, 'src/plugins')) || existsSync(join(cwd, 'plugins')) || existsSync(join(cwd, 'tests/fixtures/plugins'))
        })
        checkOpts = {
          ...checkOpts,
          ...promptRes
        }
      }

      const config = await loadConfig(process.cwd(), { silent: true })
      const res = await checkCommand(config, checkOpts)

      if (res.hasFailures) {
        process.exit(1)
      }
    } catch (err) {
      process.stderr.write(kleur.red().bold('ERROR: ') + err.message + '\n')
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
  .option('-e, --error-code <codes...>', 'Only apply auto-fixes for specified error code(s)')
  .option('--code <codes...>', 'Alias for --error-code')
  .option('--status <status>', 'Filter post-fix output by status: "failed", "passed", or "all"')
  .option('--only-failed', 'Display only failed files in post-fix output', false)
  .option('--dry-run', 'Preview changes that would be made without writing to disk', false)
  .option('-i, --interactive', 'Run in interactive prompt mode', false)
  .option('--no-interactive', 'Force non-interactive execution')
  .action(async (options, cmd) => {
    try {
      const isTTY = Boolean(process.stdout.isTTY)
      const isCI = Boolean(process.env.CI)

      const hasExplicitTargetFlags =
        cmd.getOptionValueSource('components') === 'cli' ||
        cmd.getOptionValueSource('plugins') === 'cli' ||
        cmd.getOptionValueSource('pages') === 'cli' ||
        cmd.getOptionValueSource('errorCode') === 'cli' ||
        cmd.getOptionValueSource('code') === 'cli' ||
        cmd.getOptionValueSource('status') === 'cli' ||
        cmd.getOptionValueSource('onlyFailed') === 'cli' ||
        cmd.getOptionValueSource('dryRun') === 'cli'

      const shouldPrompt =
        (options.interactive || (isTTY && !isCI && !hasExplicitTargetFlags)) &&
        !options.noInteractive

      let fixOpts = { ...options }
      let wasInteractiveDryRun = false

      if (shouldPrompt) {
        const cwd = process.cwd()
        const promptRes = await promptFixOptions({
          cwd,
          hasComponents: existsSync(join(cwd, 'src/components')) || existsSync(join(cwd, 'components')) || existsSync(join(cwd, 'tests/fixtures/components')),
          hasPlugins: existsSync(join(cwd, 'src/plugins')) || existsSync(join(cwd, 'plugins')) || existsSync(join(cwd, 'tests/fixtures/plugins'))
        })
        fixOpts = {
          ...fixOpts,
          ...promptRes
        }
        if (fixOpts.dryRun) {
          wasInteractiveDryRun = true
        }
      }

      const config = await loadConfig(process.cwd(), { silent: true })
      const res = await fixCommand(config, fixOpts)

      if (wasInteractiveDryRun && res.totalFixesCount > 0) {
        const confirmApply = await confirmApplyFixes()
        if (confirmApply) {
          const writeOpts = {
            ...fixOpts,
            dryRun: false
          }
          const writeRes = await fixCommand(config, writeOpts)
          if (writeRes.hasFailures) {
            process.exit(1)
          }
          return
        }
      }

      if (res.hasFailures) {
        process.exit(1)
      }
    } catch (err) {
      process.stderr.write(kleur.red().bold('ERROR: ') + err.message + '\n')
      process.exit(1)
    }
  })

await program.parseAsync(process.argv)
