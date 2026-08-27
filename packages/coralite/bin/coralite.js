#!/usr/bin/env -S node --experimental-vm-modules --experimental-import-meta-resolve

import { Command } from 'commander'
import kleur from 'kleur'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync, readdirSync } from 'node:fs'
import pkg from '../package.json' with { type: 'json' }

// @ts-ignore
import { createCoralite } from '#lib'
// @ts-ignore
import { validateComponentsDir, formatComponentValidationReport } from '#lib/component-validator.js'
// @ts-ignore
import { applyComponentFixes } from '#lib/component-fixer.js'
// @ts-ignore
import { validatePluginSource, validatePluginFile, validatePluginsDir, formatPluginValidationReport } from '#lib/plugin-validator.js'
// @ts-ignore
import { applyPluginFixes } from '#lib/plugin-fixer.js'
// @ts-ignore
import { validatePagesDir, formatPageValidationReport } from '#lib/page-validator.js'

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

function resolvePath (explicitPath, configProp, defaultCandidates) {
  if (explicitPath) {
    return explicitPath
  }
  if (config && typeof config[configProp] === 'string') {
    return config[configProp]
  }

  for (const cand of defaultCandidates) {
    if (existsSync(join(process.cwd(), cand))) {
      return cand
    }
  }
  return null
}

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
    let compDir = resolvePath(options.components, 'components', ['src/components', 'tests/fixtures/components'])
    const pluginTarget = resolvePath(options.plugins, 'plugins', ['src/plugins', 'tests/fixtures/plugins'])
    const pageDir = resolvePath(options.pages, 'pages', ['src/pages', 'tests/fixtures/pages', 'pages'])

    if (!compDir && !pluginTarget && !pageDir && !options.components && !options.plugins && !options.pages) {
      compDir = '.'
    }

    try {
      let compReport = null
      if (compDir && existsSync(compDir)) {
        compReport = await validateComponentsDir(compDir, { coverage: options.coverage })
      }

      let pluginReport = null
      if (pluginTarget && existsSync(pluginTarget)) {
        if (statSync(pluginTarget).isFile()) {
          const result = await validatePluginFile(pluginTarget)
          pluginReport = {
            plugins: [result],
            metrics: {
              totalPlugins: 1,
              validPlugins: result.valid ? 1 : 0,
              totalErrors: result.metrics.errors,
              totalWarnings: result.metrics.warnings
            }
          }
        } else {
          pluginReport = await validatePluginsDir(pluginTarget)
        }
      }

      let pageReport = null
      if (pageDir && existsSync(pageDir)) {
        let knownComponents = new Map()
        if (compReport && compReport.components) {
          for (const c of compReport.components) {
            if (c.filePath) {
              const name = c.filePath.split('/').pop().replace(/\.(html|js)$/, '')
              knownComponents.set(name, {
                attributes: c.defined ? c.defined.attributes.reduce((acc, curr) => ({
                  ...acc,
                  [curr]: {}
                }), {}) : {},
                slots: c.defined?.slots || []
              })
            }
          }
        }
        pageReport = await validatePagesDir(pageDir, {
          knownComponents,
          ignoreAttributes: config?.ignoreByAttribute,
          skipRenderByAttribute: config?.skipRenderByAttribute,
          ignoreTags: config?.ignoreTags
        })
      }

      const totalFiles = (compReport?.summary?.totalComponents ?? 0) +
                         (pluginReport?.metrics?.totalPlugins ?? 0) +
                         (pageReport?.summary?.totalPages ?? 0)

      const validFiles = (compReport?.summary?.validComponents ?? 0) +
                         (pluginReport?.metrics?.validPlugins ?? 0) +
                         (pageReport?.summary?.validPages ?? 0)

      const errorCount = (compReport?.summary?.errorCount ?? 0) +
                         (pluginReport?.metrics?.totalErrors ?? 0) +
                         (pageReport?.summary?.errorCount ?? 0)

      const warningCount = (compReport?.summary?.warningCount ?? 0) +
                           (pluginReport?.metrics?.totalWarnings ?? 0) +
                           (pageReport?.summary?.warningCount ?? 0)

      const fixableCount = (compReport?.summary?.fixableCount ?? 0) +
                           (pluginReport ? (pluginReport.plugins || []).reduce((acc, p) => acc + (p.diagnostics || []).filter(d => Boolean(d.fix && d.fix.action)).length, 0) : 0) +
                           (pageReport?.summary?.fixableCount ?? 0)

      let totalUnused = 0
      if (compReport?.metrics?.totalUnused !== undefined) {
        totalUnused = Number(compReport.metrics.totalUnused) || 0
      } else if (compReport?.summary && ('totalUnused' in compReport.summary)) {
        /** @type {Record<string, any>} */
        const summaryObj = compReport.summary

        totalUnused = Number(summaryObj.totalUnused) || 0
      }

      const usageCoveragePercentage = compReport?.summary?.usageCoveragePercentage ?? 100

      if (options.format === 'json') {
        const jsonOutput = {
          components: compReport,
          plugins: pluginReport,
          pages: pageReport,
          summary: {
            totalFiles,
            validFiles,
            errorCount,
            warningCount,
            fixableCount,
            usageCoveragePercentage
          }
        }
        process.stdout.write(JSON.stringify(jsonOutput, null, 2) + '\n')
      } else {
        process.stdout.write('\n' + kleur.bold().cyan('🪸 Coralite Workspace Check Report') + '\n')
        process.stdout.write(kleur.gray('─'.repeat(60)) + '\n\n')

        let validatedDomainsCount = 0

        if (compReport && (compReport.summary?.totalComponents ?? 0) > 0) {
          validatedDomainsCount++
          process.stdout.write(formatComponentValidationReport(compReport, {
            format: 'console',
            coverage: options.coverage
          }))
        }

        if (pluginReport && (pluginReport.metrics?.totalPlugins ?? 0) > 0) {
          validatedDomainsCount++
          process.stdout.write(formatPluginValidationReport(pluginReport, { format: 'console' }))
        }

        if (pageReport && (pageReport.summary?.totalPages ?? 0) > 0) {
          validatedDomainsCount++
          process.stdout.write(formatPageValidationReport(pageReport, { format: 'console' }))
        }

        process.stdout.write(kleur.gray('─'.repeat(60)) + '\n')
        const summaryColor = errorCount === 0 ? kleur.green().bold : kleur.red().bold

        let summaryLine = `Summary: ${totalFiles} file(s) validated across ${validatedDomainsCount} domain(s) | ${validFiles} valid | ${errorCount} error(s) | ${warningCount} warning(s)`
        if (fixableCount > 0) {
          summaryLine += ` | ${fixableCount} fixable with --fix`
        }
        process.stdout.write(summaryColor(summaryLine) + '\n\n')
      }

      const hasFailures = errorCount > 0 || (Boolean(options.strict) && (warningCount > 0 || totalUnused > 0))
      if (hasFailures) {
        process.exit(1)
      }
    } catch (err) {
      process.stderr.write(kleur.red().bold('ERROR: ') + err.message + '\n')
      process.exit(1)
    }
  })

program
  .command('fix')
  .description('Run workspace auto-fixers across Components and Plugins')
  .option('-c, --components <path>', 'Path to components directory')
  .option('-p, --plugins <path>', 'Path to plugin file or directory')
  .option('--pages <path>', 'Path to pages directory')
  .option('--dry-run', 'Preview changes that would be made without writing to disk', false)
  .action(async (options) => {
    const compDir = resolvePath(options.components, 'components', ['src/components', 'tests/fixtures/components'])
    const pluginTarget = resolvePath(options.plugins, 'plugins', ['src/plugins', 'tests/fixtures/plugins'])

    try {
      let totalFixesCount = 0
      const modifiedFiles = []

      // Fix Components
      if (compDir && existsSync(compDir)) {
        const compReport = await validateComponentsDir(compDir)
        for (const compRes of compReport.components) {
          if (!compRes.filePath) {
            continue
          }
          const rawCode = readFileSync(compRes.filePath, 'utf8')
          const fixResult = applyComponentFixes(rawCode, compRes.diagnostics || [], {
            filePath: compRes.filePath,
            dryRun: options.dryRun
          })

          if (fixResult.modified) {
            totalFixesCount += fixResult.fixesApplied.length
            modifiedFiles.push(compRes.filePath)
            if (options.dryRun) {
              process.stdout.write(fixResult.diff + '\n')
            } else {
              writeFileSync(compRes.filePath, fixResult.outputCode, 'utf8')
            }
          }
        }
      }

      // Fix Plugins
      if (pluginTarget && existsSync(pluginTarget)) {
        let pluginFiles = []
        if (statSync(pluginTarget).isFile()) {
          pluginFiles.push(pluginTarget)
        } else {
          const scan = (d) => {
            for (const entry of readdirSync(d)) {
              const full = join(d, entry)
              if (statSync(full).isDirectory()) {
                scan(full)
              } else if (entry.endsWith('.js') || entry.endsWith('.mjs')) {
                pluginFiles.push(full)
              }
            }
          }
          scan(pluginTarget)
        }

        for (const pFile of pluginFiles) {
          const rawCode = readFileSync(pFile, 'utf8')
          const pResult = validatePluginSource(rawCode, pFile)
          const fixResult = applyPluginFixes(rawCode, pResult.diagnostics || [], {
            filePath: pFile,
            dryRun: options.dryRun
          })

          if (fixResult.modified) {
            totalFixesCount += fixResult.fixesApplied.length
            modifiedFiles.push(pFile)
            if (options.dryRun) {
              process.stdout.write(fixResult.diff + '\n')
            } else {
              writeFileSync(pFile, fixResult.outputCode, 'utf8')
            }
          }
        }
      }

      if (options.dryRun) {
        process.stdout.write(
          kleur.bold().cyan(
            `Dry-run complete: ${totalFixesCount} fix(es) would be applied across ${modifiedFiles.length} file(s). No files modified on disk.\n\n`
          )
        )
      } else {
        if (modifiedFiles.length > 0) {
          process.stdout.write(
            kleur.bold().green(
              `✔ Auto-fixed ${totalFixesCount} issue(s) across ${modifiedFiles.length} file(s).\n\n`
            )
          )
        } else {
          process.stdout.write(kleur.bold().cyan('No fixable issues found.\n\n'))
        }

        // Re-run check to output post-fix status
        const checkArgs = []
        if (options.components) {
          checkArgs.push('-c', options.components)
        }
        if (options.plugins) {
          checkArgs.push('-p', options.plugins)
        }
        if (options.pages) {
          checkArgs.push('--pages', options.pages)
        }
        await program.parseAsync(['node', 'coralite', 'check', ...checkArgs])
      }
    } catch (err) {
      process.stderr.write(kleur.red().bold('ERROR: ') + err.message + '\n')
      process.exit(1)
    }
  })

program
  .command('init-agent')
  .description('Scaffold zero-token AGENTS.md and AI IDE config aliases for Coralite projects')
  .option('--cursor', 'Generate complementary .cursorrules / .cursor/rules/coralite.mdc file', false)
  .option('--claude', 'Generate complementary CLAUDE.md file', false)
  .action(async (options) => {
    const agentsContent = `# Coralite Architecture & Development Rules (AGENTS.md)

## Core Architectural Invariants
1. **Dumb Template Invariant**:
   - Component templates (\`<template>\`) contain flat \`{{ token }}\` placeholders ONLY.
   - NO JavaScript expressions (e.g., \`{{ count + 1 }}\`), NO dot notation, NO inline event listeners (\`onclick=""\`).
   - All derived UI logic MUST reside in synchronous derived getters inside \`getters: { ... }\`.

2. **Serialization Boundary**:
   - The \`client()\` block is serialized into browser runtime code.
   - Top-level static ES imports or outer module variables CANNOT be closed over inside \`client()\`.
   - Use dynamic \`await import(...)\` inside \`async client()\` or pass values via \`client.config\`.

3. **Attribute Primitives**:
   - Component attributes strictly support \`String\`, \`Number\`, and \`Boolean\` primitives.
   - \`Array\` and \`Object\` attribute types are BLOCKED to prevent state pollution.
   - Initialize complex objects in \`server()\` or manage them in \`state\`.

4. **Two-Phase Plugin Context**:
   - Plugin context functions MUST be Two-Phase curried:
     \`context: (pluginContext) => (instanceContext) => ({ ... })\`

5. **Component Structure**:
   - Coralite components live in \`.html\` files containing \`<template>\`, \`<style>\`, and \`<script type="module">\` exporting \`defineComponent({ ... })\`.

6. **Encapsulation & Scope**:
   - Target elements locally using \`refs('name')\` inside \`client()\`.
   - Pages are strictly consumers of custom element components and must not manipulate component internals directly.
`

    try {
      const agentsPath = join(process.cwd(), 'AGENTS.md')
      writeFileSync(agentsPath, agentsContent, 'utf8')
      process.stdout.write(kleur.bold().green('✔ Scaffolding complete: AGENTS.md created in project root.\n'))

      if (options.cursor) {
        const cursorRulesPath = join(process.cwd(), '.cursorrules')
        const cursorContent = `# Cursor Rules for Coralite Project\n# Refer to AGENTS.md for complete invariants.\n\n${agentsContent}`
        writeFileSync(cursorRulesPath, cursorContent, 'utf8')

        const cursorMdcDir = join(process.cwd(), '.cursor/rules')
        if (!existsSync(cursorMdcDir)) {
          mkdirSync(cursorMdcDir, { recursive: true })
        }
        writeFileSync(join(cursorMdcDir, 'coralite.mdc'), cursorContent, 'utf8')
        process.stdout.write(kleur.bold().green('✔ Created .cursorrules and .cursor/rules/coralite.mdc\n'))
      }

      if (options.claude) {
        const claudePath = join(process.cwd(), 'CLAUDE.md')
        const claudeContent = `# Claude Code Project Guidance\n# Refer to AGENTS.md for full architecture details.\n\n${agentsContent}`
        writeFileSync(claudePath, claudeContent, 'utf8')
        process.stdout.write(kleur.bold().green('✔ Created CLAUDE.md\n'))
      }
    } catch (err) {
      process.stderr.write(kleur.red().bold('ERROR: ') + err.message + '\n')
      process.exit(1)
    }
  })

program
  .command('validate-components')
  .alias('validate:components')
  .description('Validate and automatically fix Coralite components')
  .option('-c, --components <path>', 'Path to components directory')
  .option('--coverage', 'Include test execution coverage metrics', false)
  .option('--format <format>', 'Output format: "console" or "json"', 'console')
  .option('--strict', 'Fail with non-zero exit code if unused code or warnings exist', false)
  .option('--fix', 'Automatically fix safe component issues', false)
  .option('--dry-run', 'Preview changes that would be made by --fix without writing to disk', false)
  .action(async (options) => {
    const compDir = resolvePath(options.components, 'components', ['src/components', 'tests/fixtures/components']) || '.'

    try {
      let initialReport = await validateComponentsDir(compDir, { coverage: options.coverage })

      if (options.fix || options.dryRun) {
        let totalFixesCount = 0
        const modifiedFiles = []

        for (const compRes of initialReport.components) {
          if (!compRes.filePath) {
            continue
          }
          const rawCode = readFileSync(compRes.filePath, 'utf8')
          const fixResult = applyComponentFixes(rawCode, compRes.diagnostics || [], {
            filePath: compRes.filePath,
            dryRun: options.dryRun
          })

          if (fixResult.modified) {
            totalFixesCount += fixResult.fixesApplied.length
            modifiedFiles.push(compRes.filePath)

            if (options.dryRun) {
              process.stdout.write(fixResult.diff + '\n')
            } else {
              writeFileSync(compRes.filePath, fixResult.outputCode, 'utf8')
            }
          }
        }

        if (options.dryRun) {
          process.stdout.write(
            kleur.bold().cyan(
              `Dry-run complete: ${totalFixesCount} fix(es) would be applied across ${modifiedFiles.length} file(s). No files modified on disk.\n\n`
            )
          )
        } else if (modifiedFiles.length > 0) {
          process.stdout.write(
            kleur.bold().green(
              `✔ Auto-fixed ${totalFixesCount} issue(s) across ${modifiedFiles.length} file(s).\n\n`
            )
          )
          // Re-run validation so final report reflects post-fix state
          initialReport = await validateComponentsDir(compDir, { coverage: options.coverage })
        }
      }

      const formatted = formatComponentValidationReport(initialReport, {
        format: options.format,
        coverage: options.coverage
      })
      process.stdout.write(formatted)

      const hasFailures = (initialReport.metrics.totalErrors && initialReport.metrics.totalErrors > 0) || (options.strict && initialReport.metrics.totalUnused > 0)
      if (hasFailures) {
        process.exit(1)
      }
    } catch (err) {
      process.stderr.write(kleur.red().bold('ERROR: ') + err.message + '\n')
      process.exit(1)
    }
  })

program
  .command('validate-pages')
  .alias('validate:pages')
  .description('Validate Coralite HTML pages against component schemas and encapsulation rules')
  .option('-c, --components <path>', 'Path to components directory')
  .option('--pages <path>', 'Path to pages directory')
  .option('--format <format>', 'Output format: "console" or "json"', 'console')
  .option('--strict', 'Fail with non-zero exit code if validation warnings are found', false)
  .action(async (options) => {
    const compDir = resolvePath(options.components, 'components', ['src/components', 'tests/fixtures/components'])
    const pageDir = resolvePath(options.pages, 'pages', ['src/pages', 'tests/fixtures/pages', 'pages']) || '.'

    try {
      let knownComponents = new Map()
      if (compDir && existsSync(compDir)) {
        const compReport = await validateComponentsDir(compDir)
        if (compReport && compReport.components) {
          for (const c of compReport.components) {
            if (c.filePath) {
              const name = c.filePath.split('/').pop().replace(/\.(html|js)$/, '')
              knownComponents.set(name, {
                attributes: c.defined ? c.defined.attributes.reduce((acc, curr) => ({
                  ...acc,
                  [curr]: {}
                }), {}) : {},
                slots: c.defined?.slots || []
              })
            }
          }
        }
      }

      const pageReport = await validatePagesDir(pageDir, {
        knownComponents,
        ignoreAttributes: config?.ignoreByAttribute,
        skipRenderByAttribute: config?.skipRenderByAttribute,
        ignoreTags: config?.ignoreTags
      })
      const formatted = formatPageValidationReport(pageReport, { format: options.format })
      process.stdout.write(formatted)

      const hasFailures = pageReport.summary.errorCount > 0 || (options.strict && pageReport.summary.warningCount > 0)
      if (hasFailures) {
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
  .option('--fix', 'Automatically fix safe plugin contract issues', false)
  .option('--dry-run', 'Preview changes that would be made by --fix without writing to disk', false)
  .action(async (options) => {
    const pluginTarget = resolvePath(options.plugins, 'plugins', ['src/plugins', 'tests/fixtures/plugins']) || '.'

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

      if (options.fix || options.dryRun) {
        let totalFixesCount = 0
        const modifiedFiles = []

        for (const pRes of report.plugins) {
          if (!pRes.filePath) {
            continue
          }
          const rawCode = readFileSync(pRes.filePath, 'utf8')
          const fixResult = applyPluginFixes(rawCode, pRes.diagnostics || [], {
            filePath: pRes.filePath,
            dryRun: options.dryRun
          })

          if (fixResult.modified) {
            totalFixesCount += fixResult.fixesApplied.length
            modifiedFiles.push(pRes.filePath)

            if (options.dryRun) {
              process.stdout.write(fixResult.diff + '\n')
            } else {
              writeFileSync(pRes.filePath, fixResult.outputCode, 'utf8')
            }
          }
        }

        if (options.dryRun) {
          process.stdout.write(
            kleur.bold().cyan(
              `Dry-run complete: ${totalFixesCount} fix(es) would be applied across ${modifiedFiles.length} file(s). No files modified on disk.\n\n`
            )
          )
        } else if (modifiedFiles.length > 0) {
          process.stdout.write(
            kleur.bold().green(
              `✔ Auto-fixed ${totalFixesCount} issue(s) across ${modifiedFiles.length} file(s).\n\n`
            )
          )
          // Re-run validation so final report reflects post-fix state
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
        }
      }

      const formatted = formatPluginValidationReport(report, { format: options.format })
      process.stdout.write(formatted)

      const hasFailures = report.metrics.totalErrors > 0 || (options.strict && report.metrics.totalWarnings > 0)
      if (hasFailures) {
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

    /** @type {import('../types/index.js').CoraliteConfig} */
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

    // @ts-ignore
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
