#!/usr/bin/env -S node --experimental-vm-modules --experimental-import-meta-resolve

import { Command } from 'commander'
import kleur from 'kleur'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { existsSync, mkdirSync, statSync, readdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import pkg from '../package.json' with { type: 'json' }
import { createCoralite } from '#lib'
import { validateComponentsDir, formatComponentValidationReport } from '#lib/component-validator.js'
import { applyComponentFixes } from '#lib/component-fixer.js'
import { validatePluginSource, validatePluginFile, validatePluginsDir, formatPluginValidationReport } from '#lib/plugin-validator.js'
import { applyPluginFixes } from '#lib/plugin-fixer.js'
import { validatePagesDir, formatPageValidationReport } from '#lib/page-validator.js'
import { normalizeErrorCodes, matchesErrorCode } from '#lib/utils/diagnostics.js'
import {
  promptCheckOptions,
  promptFixOptions,
  promptSingleDomainOptions,
  confirmApplyFixes
} from '#lib/interactive.js'

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
  .option('-c, --components <path>', 'Path to component file or directory')
  .option('-p, --plugins <path>', 'Path to plugin file or directory')
  .option('--pages <path>', 'Path to pages directory')
  .option('--format <format>', 'Output format: "console" or "json"', 'console')
  .option('-e, --error-code <codes...>', 'Filter diagnostics by error code (e.g. CORALITE-E201 or E201)')
  .option('--code <codes...>', 'Alias for --error-code')
  .option('--status <status>', 'Filter by status: "failed", "passed", or "all"')
  .option('--only-failed', 'Only display files with errors or warnings', false)
  .option('--strict', 'Fail with non-zero exit code if warnings or unused code exist', false)
  .option('--coverage', 'Include component test execution coverage metrics', false)
  .option('-i, --interactive', 'Run in interactive prompt mode', false)
  .option('--no-interactive', 'Force non-interactive execution')
  .action(async (options, cmd) => {
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

    let runOpts = { ...options }

    if (shouldPrompt) {
      const cwd = process.cwd()
      const promptRes = await promptCheckOptions({
        cwd,
        hasComponents: existsSync(join(cwd, 'src/components')) || existsSync(join(cwd, 'components')) || existsSync(join(cwd, 'tests/fixtures/components')),
        hasPages: existsSync(join(cwd, 'src/pages')) || existsSync(join(cwd, 'pages')) || existsSync(join(cwd, 'tests/fixtures/pages')),
        hasPlugins: existsSync(join(cwd, 'src/plugins')) || existsSync(join(cwd, 'plugins')) || existsSync(join(cwd, 'tests/fixtures/plugins'))
      })
      runOpts = {
        ...runOpts,
        ...promptRes
      }
    }

    const targetCodesSet = normalizeErrorCodes(runOpts.errorCode || runOpts.code || runOpts.errorCodes)
    let effectiveStatus = runOpts.status
    if (!effectiveStatus) {
      if (runOpts.onlyFailed || targetCodesSet) {
        effectiveStatus = 'failed'
      } else {
        effectiveStatus = 'all'
      }
    }
    const isFilterActive = Boolean(targetCodesSet || runOpts.status || runOpts.onlyFailed)

    let compOpt = runOpts.components
    let pluginOpt = runOpts.plugins
    let pageOpt = runOpts.pages

    if (Array.isArray(runOpts.domains)) {
      if (!runOpts.domains.includes('components') && !runOpts.components) {
        compOpt = false
      }
      if (!runOpts.domains.includes('plugins') && !runOpts.plugins) {
        pluginOpt = false
      }
      if (!runOpts.domains.includes('pages') && !runOpts.pages) {
        pageOpt = false
      }
    }

    let compDir = resolvePath(compOpt, 'components', ['src/components', 'tests/fixtures/components'])
    const pluginTarget = resolvePath(pluginOpt, 'plugins', ['src/plugins', 'tests/fixtures/plugins'])
    const pageDir = resolvePath(pageOpt, 'pages', ['src/pages', 'tests/fixtures/pages', 'pages'])

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

      // Filter reports if filter options are active
      let filteredCompReport = compReport
      if (compReport && isFilterActive) {
        filteredCompReport = JSON.parse(formatComponentValidationReport(compReport, {
          format: 'json',
          errorCode: targetCodesSet ? Array.from(targetCodesSet) : undefined,
          status: effectiveStatus
        }))
      }

      let filteredPluginReport = pluginReport
      if (pluginReport && isFilterActive) {
        filteredPluginReport = JSON.parse(formatPluginValidationReport(pluginReport, {
          format: 'json',
          errorCode: targetCodesSet ? Array.from(targetCodesSet) : undefined,
          status: effectiveStatus
        }))
      }

      let filteredPageReport = pageReport
      if (pageReport && isFilterActive) {
        filteredPageReport = JSON.parse(formatPageValidationReport(pageReport, {
          format: 'json',
          errorCode: targetCodesSet ? Array.from(targetCodesSet) : undefined,
          status: effectiveStatus
        }))
      }

      const totalFiles = (filteredCompReport?.components?.length ?? 0) +
                         (filteredPluginReport?.plugins?.length ?? 0) +
                         (filteredPageReport?.pages?.length ?? 0)

      const validFiles = (filteredCompReport?.summary?.validComponents ?? 0) +
                         (filteredPluginReport?.summary?.validPlugins ?? filteredPluginReport?.metrics?.validPlugins ?? 0) +
                         (filteredPageReport?.summary?.validPages ?? 0)

      const errorCount = (filteredCompReport?.summary?.errorCount ?? 0) +
                         (filteredPluginReport?.summary?.errorCount ?? filteredPluginReport?.metrics?.totalErrors ?? 0) +
                         (filteredPageReport?.summary?.errorCount ?? 0)

      const warningCount = (filteredCompReport?.summary?.warningCount ?? 0) +
                           (filteredPluginReport?.summary?.warningCount ?? filteredPluginReport?.metrics?.totalWarnings ?? 0) +
                           (filteredPageReport?.summary?.warningCount ?? 0)

      const fixableCount = (filteredCompReport?.summary?.fixableCount ?? 0) +
                           (filteredPluginReport ? (filteredPluginReport.plugins || []).reduce((acc, p) => acc + (p.diagnostics || []).filter(d => Boolean(d.fix && d.fix.action)).length, 0) : 0) +
                           (filteredPageReport?.summary?.fixableCount ?? 0)

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
          ...(isFilterActive ? {
            filter: {
              ...(targetCodesSet ? { errorCodes: Array.from(targetCodesSet) } : {}),
              status: effectiveStatus
            }
          } : {}),
          components: filteredCompReport,
          plugins: filteredPluginReport,
          pages: filteredPageReport,
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

        if (compReport) {
          validatedDomainsCount++
          process.stdout.write(formatComponentValidationReport(compReport, {
            format: 'console',
            coverage: options.coverage,
            errorCode: targetCodesSet ? Array.from(targetCodesSet) : undefined,
            status: effectiveStatus
          }))
        }

        if (pluginReport) {
          validatedDomainsCount++
          process.stdout.write(formatPluginValidationReport(pluginReport, {
            format: 'console',
            errorCode: targetCodesSet ? Array.from(targetCodesSet) : undefined,
            status: effectiveStatus
          }))
        }

        if (pageReport) {
          validatedDomainsCount++
          process.stdout.write(formatPageValidationReport(pageReport, {
            format: 'console',
            errorCode: targetCodesSet ? Array.from(targetCodesSet) : undefined,
            status: effectiveStatus
          }))
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
  .option('-c, --components <path>', 'Path to component file or directory')
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

    let runOpts = { ...options }
    let wasInteractiveDryRun = false

    if (shouldPrompt) {
      const cwd = process.cwd()
      const promptRes = await promptFixOptions({
        cwd,
        hasComponents: existsSync(join(cwd, 'src/components')) || existsSync(join(cwd, 'components')) || existsSync(join(cwd, 'tests/fixtures/components')),
        hasPlugins: existsSync(join(cwd, 'src/plugins')) || existsSync(join(cwd, 'plugins')) || existsSync(join(cwd, 'tests/fixtures/plugins'))
      })
      runOpts = {
        ...runOpts,
        ...promptRes
      }
      if (runOpts.dryRun) {
        wasInteractiveDryRun = true
      }
    }

    const runFixPass = async (opts) => {
      let compOpt = opts.components
      let pluginOpt = opts.plugins

      if (Array.isArray(opts.domains)) {
        if (!opts.domains.includes('components') && !opts.components) {
          compOpt = false
        }
        if (!opts.domains.includes('plugins') && !opts.plugins) {
          pluginOpt = false
        }
      }

      const compDir = resolvePath(compOpt, 'components', ['src/components', 'tests/fixtures/components'])
      const pluginTarget = resolvePath(pluginOpt, 'plugins', ['src/plugins', 'tests/fixtures/plugins'])

      const targetCodesSet = normalizeErrorCodes(opts.errorCode || opts.code || opts.errorCodes)

      let totalFixesCount = 0
      const modifiedFiles = []

      // Fix Components
      if (compDir && existsSync(compDir)) {
        const compReport = await validateComponentsDir(compDir)

        await Promise.all(
          compReport.components.map(async (compRes) => {
            if (!compRes.filePath) {
              return
            }

            const rawDiagnostics = compRes.diagnostics || []
            const diagnostics = targetCodesSet ? rawDiagnostics.filter(d => matchesErrorCode(d.code, targetCodesSet)) : rawDiagnostics

            const rawCode = await readFile(compRes.filePath, 'utf8')
            const fixResult = applyComponentFixes(rawCode, diagnostics, {
              filePath: compRes.filePath,
              dryRun: opts.dryRun
            })

            if (fixResult.modified) {
              totalFixesCount += fixResult.fixesApplied.length
              modifiedFiles.push(compRes.filePath)

              if (opts.dryRun) {
                process.stdout.write(fixResult.diff + '\n')
              } else {
                await writeFile(compRes.filePath, fixResult.outputCode, 'utf8')
              }
            }
          })
        )
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

        await Promise.all(
          pluginFiles.map(async (pFile) => {
            const rawCode = await readFile(pFile, 'utf8')
            const pResult = validatePluginSource(rawCode, pFile)
            const rawDiagnostics = pResult.diagnostics || []
            const diagnostics = targetCodesSet ? rawDiagnostics.filter(d => matchesErrorCode(d.code, targetCodesSet)) : rawDiagnostics

            const fixResult = applyPluginFixes(rawCode, diagnostics, {
              filePath: pFile,
              dryRun: opts.dryRun
            })

            if (fixResult.modified) {
              totalFixesCount += fixResult.fixesApplied.length
              modifiedFiles.push(pFile)
              if (opts.dryRun) {
                process.stdout.write(fixResult.diff + '\n')
              } else {
                await writeFile(pFile, fixResult.outputCode, 'utf8')
              }
            }
          })
        )
      }

      return {
        totalFixesCount,
        modifiedFiles
      }
    }

    try {
      const fixRes = await runFixPass(runOpts)

      if (runOpts.dryRun) {
        process.stdout.write(
          kleur.bold().cyan(
            `Dry-run complete: ${fixRes.totalFixesCount} fix(es) would be applied across ${fixRes.modifiedFiles.length} file(s). No files modified on disk.\n\n`
          )
        )

        if (wasInteractiveDryRun && fixRes.totalFixesCount > 0) {
          const confirmApply = await confirmApplyFixes()
          if (confirmApply) {
            const applyOpts = {
              ...runOpts,
              dryRun: false
            }
            const applyRes = await runFixPass(applyOpts)
            process.stdout.write(
              kleur.bold().green(
                `✔ Auto-fixed ${applyRes.totalFixesCount} issue(s) across ${applyRes.modifiedFiles.length} file(s).\n\n`
              )
            )

            // Re-run check to output post-fix status
            const checkArgs = []
            if (applyOpts.components) {
              checkArgs.push('-c', applyOpts.components)
            }
            if (applyOpts.plugins) {
              checkArgs.push('-p', applyOpts.plugins)
            }
            if (applyOpts.pages) {
              checkArgs.push('--pages', applyOpts.pages)
            }
            if (applyOpts.errorCode) {
              const codes = Array.isArray(applyOpts.errorCode) ? applyOpts.errorCode : [applyOpts.errorCode]
              checkArgs.push('-e', ...codes)
            }
            if (applyOpts.status) {
              checkArgs.push('--status', applyOpts.status)
            }
            if (applyOpts.onlyFailed) {
              checkArgs.push('--only-failed')
            }
            checkArgs.push('--no-interactive')
            await program.parseAsync(['node', 'coralite', 'check', ...checkArgs])
          }
        }
      } else {
        if (fixRes.modifiedFiles.length > 0) {
          process.stdout.write(
            kleur.bold().green(
              `✔ Auto-fixed ${fixRes.totalFixesCount} issue(s) across ${fixRes.modifiedFiles.length} file(s).\n\n`
            )
          )
        } else {
          process.stdout.write(kleur.bold().cyan('No fixable issues found.\n\n'))
        }

        // Re-run check to output post-fix status
        const checkArgs = []
        if (runOpts.components) {
          checkArgs.push('-c', runOpts.components)
        }
        if (runOpts.plugins) {
          checkArgs.push('-p', runOpts.plugins)
        }
        if (runOpts.pages) {
          checkArgs.push('--pages', runOpts.pages)
        }
        if (runOpts.errorCode) {
          const codes = Array.isArray(runOpts.errorCode) ? runOpts.errorCode : [runOpts.errorCode]
          checkArgs.push('-e', ...codes)
        }
        if (runOpts.status) {
          checkArgs.push('--status', runOpts.status)
        }
        if (runOpts.onlyFailed) {
          checkArgs.push('--only-failed')
        }
        checkArgs.push('--no-interactive')
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
      await writeFile(agentsPath, agentsContent, 'utf8')
      process.stdout.write(kleur.bold().green('✔ Scaffolding complete: AGENTS.md created in project root.\n'))

      if (options.cursor) {
        const cursorRulesPath = join(process.cwd(), '.cursorrules')
        const cursorContent = `# Cursor Rules for Coralite Project\n# Refer to AGENTS.md for complete invariants.\n\n${agentsContent}`
        await writeFile(cursorRulesPath, cursorContent, 'utf8')

        const cursorMdcDir = join(process.cwd(), '.cursor/rules')
        if (!existsSync(cursorMdcDir)) {
          mkdirSync(cursorMdcDir, { recursive: true })
        }
        await writeFile(join(cursorMdcDir, 'coralite.mdc'), cursorContent, 'utf8')
        process.stdout.write(kleur.bold().green('✔ Created .cursorrules and .cursor/rules/coralite.mdc\n'))
      }

      if (options.claude) {
        const claudePath = join(process.cwd(), 'CLAUDE.md')
        const claudeContent = `# Claude Code Project Guidance\n# Refer to AGENTS.md for full architecture details.\n\n${agentsContent}`
        await writeFile(claudePath, claudeContent, 'utf8')
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
  .option('-c, --components <path>', 'Path to component file or directory')
  .option('--coverage', 'Include test execution coverage metrics', false)
  .option('--format <format>', 'Output format: "console" or "json"', 'console')
  .option('-e, --error-code <codes...>', 'Filter diagnostics by error code (e.g. CORALITE-E201 or E201)')
  .option('--code <codes...>', 'Alias for --error-code')
  .option('--status <status>', 'Filter by status: "failed", "passed", or "all"')
  .option('--only-failed', 'Only display files with errors or warnings', false)
  .option('--strict', 'Fail with non-zero exit code if unused code or warnings exist', false)
  .option('--fix', 'Automatically fix safe component issues', false)
  .option('--dry-run', 'Preview changes that would be made by --fix without writing to disk', false)
  .option('-i, --interactive', 'Run in interactive prompt mode', false)
  .option('--no-interactive', 'Force non-interactive execution')
  .action(async (options, cmd) => {
    const isTTY = Boolean(process.stdout.isTTY)
    const isCI = Boolean(process.env.CI)

    const hasExplicitTargetFlags =
      cmd.getOptionValueSource('components') === 'cli' ||
      cmd.getOptionValueSource('errorCode') === 'cli' ||
      cmd.getOptionValueSource('code') === 'cli' ||
      cmd.getOptionValueSource('status') === 'cli' ||
      cmd.getOptionValueSource('onlyFailed') === 'cli' ||
      cmd.getOptionValueSource('strict') === 'cli' ||
      cmd.getOptionValueSource('coverage') === 'cli' ||
      cmd.getOptionValueSource('fix') === 'cli' ||
      cmd.getOptionValueSource('dryRun') === 'cli' ||
      cmd.getOptionValueSource('format') === 'cli'

    const shouldPrompt =
      (options.interactive || (isTTY && !isCI && !hasExplicitTargetFlags)) &&
      !options.noInteractive

    let runOpts = { ...options }

    if (shouldPrompt) {
      const promptRes = await promptSingleDomainOptions('components', { allowFix: true })
      runOpts = {
        ...runOpts,
        ...promptRes
      }
    }

    const compDir = resolvePath(runOpts.components, 'components', ['src/components', 'tests/fixtures/components']) || '.'
    const targetCodesSet = normalizeErrorCodes(runOpts.errorCode || runOpts.code || runOpts.errorCodes)
    let effectiveStatus = runOpts.status
    if (!effectiveStatus) {
      if (runOpts.onlyFailed || targetCodesSet) {
        effectiveStatus = 'failed'
      } else {
        effectiveStatus = 'all'
      }
    }

    try {
      let initialReport = await validateComponentsDir(compDir, { coverage: runOpts.coverage })

      if (runOpts.fix || runOpts.dryRun) {
        let totalFixesCount = 0
        const modifiedFiles = []

        await Promise.all(
          initialReport.components.map(async (compRes) => {
            if (!compRes.filePath) {
              return
            }
            const rawDiagnostics = compRes.diagnostics || []
            const diagnostics = targetCodesSet ? rawDiagnostics.filter(d => matchesErrorCode(d.code, targetCodesSet)) : rawDiagnostics

            const rawCode = await readFile(compRes.filePath, 'utf8')
            const fixResult = applyComponentFixes(rawCode, diagnostics, {
              filePath: compRes.filePath,
              dryRun: runOpts.dryRun
            })

            if (fixResult.modified) {
              totalFixesCount += fixResult.fixesApplied.length
              modifiedFiles.push(compRes.filePath)

              if (runOpts.dryRun) {
                process.stdout.write(fixResult.diff + '\n')
              } else {
                await writeFile(compRes.filePath, fixResult.outputCode, 'utf8')
              }
            }
          })
        )

        if (runOpts.dryRun) {
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
          initialReport = await validateComponentsDir(compDir, { coverage: runOpts.coverage })
        }
      }

      const formatted = formatComponentValidationReport(initialReport, {
        format: runOpts.format,
        coverage: runOpts.coverage,
        errorCode: targetCodesSet ? Array.from(targetCodesSet) : undefined,
        status: effectiveStatus
      })
      process.stdout.write(formatted)

      // Calculate failures based on filtered view if filter options specified
      let errorCount = initialReport.metrics.totalErrors
      let warningCount = initialReport.summary?.warningCount ?? 0
      if (targetCodesSet) {
        errorCount = 0
        warningCount = 0
        for (const comp of initialReport.components || []) {
          for (const d of comp.diagnostics || []) {
            if (matchesErrorCode(d.code, targetCodesSet)) {
              if (d.severity === 'error') {
                errorCount++
              }
              if (d.severity === 'warning') {
                warningCount++
              }
            }
          }
        }
      }

      const hasFailures = (errorCount > 0) || (runOpts.strict && (warningCount > 0 || initialReport.metrics.totalUnused > 0))
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
  .option('-c, --components <path>', 'Path to component file or directory')
  .option('--pages <path>', 'Path to pages directory')
  .option('--format <format>', 'Output format: "console" or "json"', 'console')
  .option('-e, --error-code <codes...>', 'Filter diagnostics by error code (e.g. CORALITE-PAGE-101)')
  .option('--code <codes...>', 'Alias for --error-code')
  .option('--status <status>', 'Filter by status: "failed", "passed", or "all"')
  .option('--only-failed', 'Only display files with errors or warnings', false)
  .option('--strict', 'Fail with non-zero exit code if validation warnings are found', false)
  .option('-i, --interactive', 'Run in interactive prompt mode', false)
  .option('--no-interactive', 'Force non-interactive execution')
  .action(async (options, cmd) => {
    const isTTY = Boolean(process.stdout.isTTY)
    const isCI = Boolean(process.env.CI)

    const hasExplicitTargetFlags =
      cmd.getOptionValueSource('components') === 'cli' ||
      cmd.getOptionValueSource('pages') === 'cli' ||
      cmd.getOptionValueSource('errorCode') === 'cli' ||
      cmd.getOptionValueSource('code') === 'cli' ||
      cmd.getOptionValueSource('status') === 'cli' ||
      cmd.getOptionValueSource('onlyFailed') === 'cli' ||
      cmd.getOptionValueSource('strict') === 'cli' ||
      cmd.getOptionValueSource('format') === 'cli'

    const shouldPrompt =
      (options.interactive || (isTTY && !isCI && !hasExplicitTargetFlags)) &&
      !options.noInteractive

    let runOpts = { ...options }

    if (shouldPrompt) {
      const promptRes = await promptSingleDomainOptions('pages', { allowFix: false })
      runOpts = {
        ...runOpts,
        ...promptRes
      }
    }

    const compDir = resolvePath(runOpts.components, 'components', ['src/components', 'tests/fixtures/components'])
    const pageDir = resolvePath(runOpts.pages, 'pages', ['src/pages', 'tests/fixtures/pages', 'pages']) || '.'
    const targetCodesSet = normalizeErrorCodes(runOpts.errorCode || runOpts.code || runOpts.errorCodes)
    let effectiveStatus = runOpts.status
    if (!effectiveStatus) {
      if (runOpts.onlyFailed || targetCodesSet) {
        effectiveStatus = 'failed'
      } else {
        effectiveStatus = 'all'
      }
    }

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
      const formatted = formatPageValidationReport(pageReport, {
        format: runOpts.format,
        errorCode: targetCodesSet ? Array.from(targetCodesSet) : undefined,
        status: effectiveStatus
      })
      process.stdout.write(formatted)

      let errorCount = pageReport.summary.errorCount
      let warningCount = pageReport.summary.warningCount
      if (targetCodesSet) {
        errorCount = 0
        warningCount = 0
        for (const page of pageReport.pages || []) {
          for (const d of page.diagnostics || []) {
            if (matchesErrorCode(d.code, targetCodesSet)) {
              if (d.severity === 'error') {
                errorCount++
              }
              if (d.severity === 'warning') {
                warningCount++
              }
            }
          }
        }
      }

      const hasFailures = errorCount > 0 || (runOpts.strict && warningCount > 0)
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
  .option('-e, --error-code <codes...>', 'Filter diagnostics by error code (e.g. CORALITE-P401 or P401)')
  .option('--code <codes...>', 'Alias for --error-code')
  .option('--status <status>', 'Filter by status: "failed", "passed", or "all"')
  .option('--only-failed', 'Only display files with errors or warnings', false)
  .option('--strict', 'Fail with non-zero exit code if validation errors are found', false)
  .option('--fix', 'Automatically fix safe plugin contract issues', false)
  .option('--dry-run', 'Preview changes that would be made by --fix without writing to disk', false)
  .option('-i, --interactive', 'Run in interactive prompt mode', false)
  .option('--no-interactive', 'Force non-interactive execution')
  .action(async (options, cmd) => {
    const isTTY = Boolean(process.stdout.isTTY)
    const isCI = Boolean(process.env.CI)

    const hasExplicitTargetFlags =
      cmd.getOptionValueSource('plugins') === 'cli' ||
      cmd.getOptionValueSource('errorCode') === 'cli' ||
      cmd.getOptionValueSource('code') === 'cli' ||
      cmd.getOptionValueSource('status') === 'cli' ||
      cmd.getOptionValueSource('onlyFailed') === 'cli' ||
      cmd.getOptionValueSource('strict') === 'cli' ||
      cmd.getOptionValueSource('fix') === 'cli' ||
      cmd.getOptionValueSource('dryRun') === 'cli' ||
      cmd.getOptionValueSource('format') === 'cli'

    const shouldPrompt =
      (options.interactive || (isTTY && !isCI && !hasExplicitTargetFlags)) &&
      !options.noInteractive

    let runOpts = { ...options }

    if (shouldPrompt) {
      const promptRes = await promptSingleDomainOptions('plugins', { allowFix: true })
      runOpts = {
        ...runOpts,
        ...promptRes
      }
    }

    const pluginTarget = resolvePath(runOpts.plugins, 'plugins', ['src/plugins', 'tests/fixtures/plugins']) || '.'
    const targetCodesSet = normalizeErrorCodes(runOpts.errorCode || runOpts.code || runOpts.errorCodes)
    let effectiveStatus = runOpts.status
    if (!effectiveStatus) {
      if (runOpts.onlyFailed || targetCodesSet) {
        effectiveStatus = 'failed'
      } else {
        effectiveStatus = 'all'
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

      if (runOpts.fix || runOpts.dryRun) {
        let totalFixesCount = 0
        const modifiedFiles = []

        await Promise.all(
          report.plugins.map(async (pRes) => {
            if (!pRes.filePath) {
              return
            }
            const rawDiagnostics = pRes.diagnostics || []
            const diagnostics = targetCodesSet ? rawDiagnostics.filter(d => matchesErrorCode(d.code, targetCodesSet)) : rawDiagnostics

            const rawCode = await readFile(pRes.filePath, 'utf8')
            const fixResult = applyPluginFixes(rawCode, diagnostics, {
              filePath: pRes.filePath,
              dryRun: runOpts.dryRun
            })

            if (fixResult.modified) {
              totalFixesCount += fixResult.fixesApplied.length
              modifiedFiles.push(pRes.filePath)

              if (runOpts.dryRun) {
                process.stdout.write(fixResult.diff + '\n')
              } else {
                await writeFile(pRes.filePath, fixResult.outputCode, 'utf8')
              }
            }
          })
        )

        if (runOpts.dryRun) {
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

      const formatted = formatPluginValidationReport(report, {
        format: runOpts.format,
        errorCode: targetCodesSet ? Array.from(targetCodesSet) : undefined,
        status: effectiveStatus
      })
      process.stdout.write(formatted)

      let errorCount = report.metrics.totalErrors
      let warningCount = report.metrics.totalWarnings
      if (targetCodesSet) {
        errorCount = 0
        warningCount = 0
        for (const p of report.plugins || []) {
          for (const d of p.diagnostics || []) {
            if (matchesErrorCode(d.code, targetCodesSet)) {
              if (d.severity === 'error') {
                errorCount++
              }
              if (d.severity === 'warning') {
                warningCount++
              }
            }
          }
        }
      }

      const hasFailures = errorCount > 0 || (runOpts.strict && warningCount > 0)
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
  .requiredOption('-c, --components <path>', 'Path to component file or directory')
  .requiredOption('-p, --pages <path>', 'Path to pages directory')
  .requiredOption('-o, --output <path>', 'Output directory for the generated site')
  .option('-m, --mode <mode>', 'Build mode: "development" or "production"', 'production')
  .option('-i, --ignore-attribute <key=value...>', 'Ignore elements by attribute name value pair', [])
  .option('-s, --skip-render-attribute <key...>', 'Parse elements but exclude them from final render output', [])
  .option('-d, --dry-run', 'Run in dry-run mode')
  .option('-a, --assets <mapping...>', 'Static assets to copy. Format: pkg:path:dest (or pkg:path)')
  .option('--concurrency <number>', 'Concurrency limit for page rendering', (val) => parseInt(val, 10))
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

    if (options.concurrency !== undefined && !isNaN(options.concurrency)) {
      coraliteOptions.concurrency = options.concurrency
    } else if (config && config.concurrency !== undefined) {
      coraliteOptions.concurrency = config.concurrency
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
