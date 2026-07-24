#!/usr/bin/env -S node --experimental-vm-modules --experimental-import-meta-resolve

import { createCoralite } from '../dist/lib/index.js'
import { Command } from 'commander'
import kleur from 'kleur'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import pkg from '../package.json' with { type: 'json' }

// remove all Node warnings before doing anything else
process.removeAllListeners('warning')

const program = new Command()

program
  .name('coralite')
  .description('HTML modules static site generator CLI tool')
  .version(pkg.version)

const configPath = pathToFileURL(join(process.cwd(), 'coralite.config.js'))
let config

if (existsSync(configPath)) {
  try {
    const data = await import(configPath.href)
    if (data.default) {
      config = data.default
    }
  } catch {
    // Config import error fallback
  }
}

program
  .command('validate-components')
  .alias('validate:components')
  .description('Validate Coralite components to detect unused code, missing refs, and schema issues')
  .option('-c, --components <path>', 'Path to components directory')
  .option('--coverage', 'Include test execution coverage metrics', false)
  .option('--format <format>', 'Output format: "console" or "json"', 'console')
  .option('--strict', 'Fail with non-zero exit code if unused code is found', false)
  .action(async (options) => {
    const { validateComponentsDir, formatComponentValidationReport } = await import('../lib/component-validator.js')

    let compDir = options.components
    if (!compDir && config && config.components) {
      compDir = config.components
    }
    if (!compDir) {
      if (existsSync(join(process.cwd(), 'src/components'))) {
        compDir = 'src/components'
      } else if (existsSync(join(process.cwd(), 'tests/fixtures/components'))) {
        compDir = 'tests/fixtures/components'
      } else {
        compDir = '.'
      }
    }

    try {
      const report = validateComponentsDir(compDir, { coverage: options.coverage })
      const formatted = formatComponentValidationReport(report, {
        format: options.format,
        coverage: options.coverage
      })
      process.stdout.write(formatted)

      if (options.strict && report.metrics.totalUnused > 0) {
        process.exit(1)
      }
    } catch (err) {
      process.stderr.write(kleur.red().bold('ERROR: ') + err.message + '\n')
      process.exit(1)
    }
  })

program
  .command('validate-plugins')
  .alias('validate:plugins')
  .description('Validate Coralite plugin contracts, lifecycle hooks, and isomorphic boundaries')
  .option('-p, --plugins <path>', 'Path to plugin file or directory')
  .option('--format <format>', 'Output format: "console" or "json"', 'console')
  .option('--strict', 'Fail with non-zero exit code if validation errors are found', false)
  .action(async (options) => {
    const { validatePluginsDir, validatePluginFile, formatPluginValidationReport } = await import('../lib/plugin-validator.js')
    const { statSync, existsSync } = await import('node:fs')
    const { join } = await import('node:path')

    let pluginTarget = options.plugins
    if (!pluginTarget) {
      if (existsSync(join(process.cwd(), 'src/plugins'))) {
        pluginTarget = 'src/plugins'
      } else if (existsSync(join(process.cwd(), 'tests/fixtures/plugins'))) {
        pluginTarget = 'tests/fixtures/plugins'
      } else {
        pluginTarget = '.'
      }
    }

    try {
      let report
      if (existsSync(pluginTarget) && statSync(pluginTarget).isFile()) {
        const result = await validatePluginFile(pluginTarget)
        report = {
          plugins: [result],
          metrics: {
            totalPlugins: 1,
            validPlugins: result.valid ? 1 : 0,
            totalErrors: result.metrics.errors,
            totalWarnings: result.metrics.warnings
          }
        }
      } else {
        report = await validatePluginsDir(pluginTarget)
      }

      const formatted = formatPluginValidationReport(report, { format: options.format })
      process.stdout.write(formatted)

      if (options.strict && report.metrics.totalErrors > 0) {
        process.exit(1)
      }
    } catch (err) {
      process.stderr.write(kleur.red().bold('ERROR: ') + err.message + '\n')
      process.exit(1)
    }
  })

program
  .command('build', { isDefault: true })
  .description('Build site from HTML modules and components')
  .requiredOption('-c, --components <path>', 'Path to components directory')
  .requiredOption('-p, --pages <path>', 'Path to pages directory')
  .requiredOption('-o, --output <path>', 'Output directory for the generated site')
  .option('-m, --mode <mode>', 'Build mode: "development" or "production"', 'production')
  .option('-i, --ignore-attribute <key=value...>', 'Ignore elements by attribute name value pair', [])
  .option('-s, --skip-render-attribute <key...>', 'Parse elements but exclude them from final render output', [])
  .option('-d, --dry-run', 'Run in dry-run mode')
  .option('-a, --assets <mapping...>', 'Static assets to copy. Format: pkg:path:dest (or pkg:path)')
  .action(async (options) => {
    const pages = options.pages
    const output = options.output
    const ignoreByAttribute = []
    let assets

    if (options.assets) {
      assets = []
      for (const assetStr of options.assets) {
        const parts = assetStr.split(':')
        if (parts.length < 2) {
          console.error('Failed to parse asset:', assetStr)
          console.error('Invalid format. Expected pkg:path:dest or pkg:path')
          process.exit(1)
        }
        const [pkg, path, dest] = parts
        assets.push({
          pkg,
          path,
          dest: dest || path
        })
      }
    }

    const coraliteOptions = {
      components: options.components,
      pages,
      ignoreByAttribute,
      skipRenderByAttribute: options.skipRenderAttribute,
      mode: options.mode,
      output,
      assets,
      plugins: []
    }

    for (let i = 0; i < options.ignoreAttribute.length; i++) {
      const pair = options.ignoreAttribute[i].split('=')

      if (pair.length !== 2) {
        throw new Error('Ignore attribute "' + pair[0] + '" expected a value but found none')
      }

      ignoreByAttribute.push({
        name: pair[0],
        value: pair[1]
      })
    }

    if (config && config.plugins) {
      coraliteOptions.plugins = coraliteOptions.plugins.concat(config.plugins)
    }

    const coralite = await createCoralite({
      ...coraliteOptions,
      onError: ({ level, message, error }) => {
        if (level === 'ERR') {
          process.stderr.write(kleur.red().bold('ERROR: ') + message + '\n')
          if (error) {
            process.stderr.write(kleur.gray(error.stack || error.message) + '\n')
          }
        } else if (level === 'WARN') {
          process.stdout.write(kleur.yellow().bold('WARNING: ') + message + '\n')
        } else {
          process.stdout.write(message + '\n')
        }
      }
    })

    if (options.dryRun) {
      const documents = await coralite.build()

      const PAD = '  '
      const border = '─'.repeat(Math.min(process.stdout.columns, 36) / 2)

      for (let i = 0; i < documents.length; i++) {
        const document = documents[i]

        process.stdout.write('\n' + PAD + kleur.green('Document is ready!\n\n'))
        process.stdout.write(PAD + `${kleur.bold('- Path:')}      ${document.path.pathname}\n`)
        process.stdout.write(PAD + `${kleur.bold('- Built in:')}  ${Math.floor(document.duration)}ms\n\n`)
        process.stdout.write(border + kleur.inverse(' Content start ') + border + '\n\n')
        // @ts-ignore
        process.stdout.write(document.html)
        process.stdout.write('\n\n' + border + kleur.inverse(' Content end ') + border + '\n')
      }
    } else {
      await coralite.save()
    }

    await coralite.clearCache(true)
  })

program.parse(process.argv)

