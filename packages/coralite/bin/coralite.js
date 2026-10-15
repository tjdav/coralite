#!/usr/bin/env -S node --experimental-vm-modules --experimental-import-meta-resolve

import { Command } from 'commander'
import kleur from 'kleur'
import { pathToFileURL } from 'node:url'
import { join, resolve, relative } from 'node:path'
import { existsSync, mkdirSync, statSync, readdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import pkg from '../package.json' with { type: 'json' }
import { createCoralite, normalizeErrorCodes, matchesErrorCode } from '#lib'
import { validateComponentsDir, formatComponentValidationReport } from '#lib/server/component/validator.js'
import { applyComponentFixes } from '#lib/server/component/fixer.js'
import { validatePluginSource, validatePluginFile, validatePluginsDir, formatPluginValidationReport } from '#lib/server/plugin/validator.js'
import { applyPluginFixes } from '#lib/server/plugin/fixer.js'
import { applyPageFixes } from '#lib/server/page/fixer.js'
import { validatePagesDir, formatPageValidationReport } from '#lib/server/page/validator.js'
import { typeCheck } from '#lib/server/type-checker.js'
import { discoverHtmlFiles } from '#lib/server/utils/html.js'
import {
  promptCheckOptions,
  promptFixOptions,
  promptSingleDomainOptions,
  confirmApplyFixes
} from '#lib/server/interactive.js'

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

/**
 * Aggregates summary statistics across heterogeneous domain validation reports.
 *
 * @param {Array<Object|null|undefined>} reports - Array of domain reports (components, plugins, pages)
 * @returns {{ totalFiles: number, validFiles: number, errorCount: number, warningCount: number, fixableCount: number }} Aggregated summary totals
 */
function aggregateReportSummaries (reports) {
  const totals = {
    totalFiles: 0,
    validFiles: 0,
    errorCount: 0,
    warningCount: 0,
    fixableCount: 0
  }

  for (const report of reports) {
    if (!report) {
      continue
    }

    const items = report.components || report.plugins || report.pages || []
    const summary = report.summary || report.metrics || {}

    totals.totalFiles += items.length
    totals.validFiles += summary.validComponents || summary.validPlugins || summary.validPages || 0
    totals.errorCount += summary.errorCount || summary.totalErrors || 0
    totals.warningCount += summary.warningCount || summary.totalWarnings || 0
    totals.fixableCount += summary.fixableCount ??
      items.reduce((acc, item) => acc + (item.diagnostics || []).filter(d => Boolean(d.fix?.action)).length, 0)
  }

  return totals
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
  .option('--types', 'Run TypeScript checks alongside AST validators', true)
  .option('--no-types', 'Skip TypeScript type-checker')
  .option('--types-only', 'Run only TypeScript type-checker', false)
  .option('-i, --interactive', 'Run in interactive prompt mode', false)
  .option('--no-interactive', 'Force non-interactive execution')
  .action(async (options, cmd) => {
    if (options.types === false && options.typesOnly) {
      process.stderr.write(kleur.red().bold('ERROR: ') + 'Flags --no-types and --types-only are mutually exclusive.\n')
      process.exit(1)
    }

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
      cmd.getOptionValueSource('format') === 'cli' ||
      cmd.getOptionValueSource('types') === 'cli' ||
      cmd.getOptionValueSource('typesOnly') === 'cli'

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

    if (!compDir && !pluginTarget && !pageDir && !runOpts.components && !runOpts.plugins && !runOpts.pages) {
      compDir = '.'
    }

    try {
      const runAst = !runOpts.typesOnly
      const runTypes = runOpts.types !== false

      let compReport = null
      let pluginReport = null
      let pageReport = null

      if (runAst) {
        if (compDir && existsSync(compDir)) {
          compReport = await validateComponentsDir(compDir, { coverage: runOpts.coverage })
        }

        if (pluginTarget && existsSync(pluginTarget)) {
          if (statSync(pluginTarget).isFile()) {
            const result = await validatePluginFile(pluginTarget)
            pluginReport = {
              plugins: [result],
              summary: {
                totalPlugins: 1,
                validPlugins: result.valid ? 1 : 0,
                errorCount: result.metrics.errors,
                warningCount: result.metrics.warnings,
                fixableCount: (result.diagnostics || []).filter(d => Boolean(d.fix && d.fix.action)).length
              },
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

        if (pageDir && existsSync(pageDir)) {
          const knownComponents = new Map()
          if (compReport && compReport.components) {
            for (const c of compReport.components) {
              const name = c.componentTag || c.defined?.templateId || (c.filePath ? c.filePath.split('/').pop().replace(/\.(html|js)$/, '') : null)
              if (name) {
                knownComponents.set(name, {
                  attributes: c.defined?.attributes ? c.defined.attributes.reduce((acc, curr) => ({
                    ...acc,
                    [curr]: {}
                  }), {}) : {},
                  slots: c.defined?.slots || []
                })
              }
            }
          }

          if (config?.plugins && Array.isArray(config.plugins)) {
            for (const plugin of config.plugins) {
              if (plugin?.components) {
                const pComps = Array.isArray(plugin.components) ? plugin.components : [plugin.components]
                for (const pComp of pComps) {
                  if (typeof pComp === 'string') {
                    knownComponents.set(pComp.toLowerCase(), {
                      attributes: {},
                      slots: []
                    })
                  } else if (pComp && typeof pComp === 'object' && pComp.tag) {
                    knownComponents.set(pComp.tag.toLowerCase(), {
                      attributes: {},
                      slots: []
                    })
                  }
                }
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
      }

      // Add source: 'ast' to AST diagnostics
      if (compReport?.components) {
        for (const comp of compReport.components) {
          comp.diagnostics = (comp.diagnostics || []).map(d => ({
            ...d,
            source: 'ast'
          }))
        }
      }
      if (pluginReport?.plugins) {
        for (const plugin of pluginReport.plugins) {
          plugin.diagnostics = (plugin.diagnostics || []).map(d => ({
            ...d,
            source: 'ast'
          }))
        }
      }
      if (pageReport?.pages) {
        for (const page of pageReport.pages) {
          page.diagnostics = (page.diagnostics || []).map(d => ({
            ...d,
            source: 'ast'
          }))
        }
      }

      // Collect HTML files and execute typeCheck
      let typeCheckResult = null
      const htmlFiles = []

      if (runTypes) {
        if (compDir && existsSync(compDir)) {
          const compStat = statSync(compDir)
          if (compStat.isFile()) {
            if (compDir.endsWith('.html')) {
              htmlFiles.push(resolve(compDir))
            }
          } else {
            for await (const file of discoverHtmlFiles({
              path: resolve(compDir),
              recursive: true,
              type: 'component'
            })) {
              htmlFiles.push(file.path.pathname)
            }
          }
        }

        if (pageDir && existsSync(pageDir)) {
          const pageStat = statSync(pageDir)
          if (pageStat.isFile()) {
            if (pageDir.endsWith('.html')) {
              htmlFiles.push(resolve(pageDir))
            }
          } else {
            for await (const file of discoverHtmlFiles({
              path: resolve(pageDir),
              recursive: true,
              type: 'page'
            })) {
              htmlFiles.push(file.path.pathname)
            }
          }
        }

        typeCheckResult = await typeCheck(htmlFiles)
      }

      // Handle typeCheck skipped
      if (typeCheckResult?.skipped) {
        if (options.format !== 'json') {
          process.stdout.write('TypeScript check skipped: install "typescript" to enable.\n\n')
        }
      }

      // Convert and merge type-checker diagnostics into reports
      const typeDiagsMap = new Map()
      if (typeCheckResult && !typeCheckResult.skipped && Array.isArray(typeCheckResult.diagnostics)) {
        for (const diag of typeCheckResult.diagnostics) {
          const relPath = relative(process.cwd(), diag.file)
          const formattedDiag = {
            code: 'TS' + diag.code,
            severity: diag.severity,
            message: diag.message,
            filePath: relPath,
            line: diag.line,
            column: diag.column,
            source: 'type-checker'
          }
          if (!typeDiagsMap.has(relPath)) {
            typeDiagsMap.set(relPath, [])
          }
          typeDiagsMap.get(relPath).push(formattedDiag)
        }
      }

      // Ensure compReport and pageReport entries exist when typesOnly or merging
      if (compDir && existsSync(compDir) && (!compReport || runOpts.typesOnly)) {
        const compFiles = htmlFiles.filter(f => f.startsWith(resolve(compDir)))
        const compItems = compFiles.map(f => {
          const rel = relative(process.cwd(), f)
          return {
            filePath: rel,
            valid: true,
            diagnostics: []
          }
        })
        compReport = {
          components: compItems,
          summary: {
            totalComponents: compItems.length,
            validComponents: compItems.length,
            errorCount: 0,
            warningCount: 0,
            fixableCount: 0
          },
          metrics: {
            totalComponents: compItems.length,
            validComponents: compItems.length,
            totalDefined: 0,
            totalUnused: 0,
            totalErrors: 0,
            overallCoveragePercentage: 100
          }
        }
      }

      if (pageDir && existsSync(pageDir) && (!pageReport || runOpts.typesOnly)) {
        const pageFiles = htmlFiles.filter(f => f.startsWith(resolve(pageDir)))
        const pageItems = pageFiles.map(f => {
          const rel = relative(process.cwd(), f)
          return {
            filePath: rel,
            valid: true,
            diagnostics: []
          }
        })
        pageReport = {
          pages: pageItems,
          summary: {
            totalPages: pageItems.length,
            validPages: pageItems.length,
            errorCount: 0,
            warningCount: 0,
            fixableCount: 0
          }
        }
      }

      // Merge type diagnostics into compReport and pageReport
      const mergeTypeDiagnosticsIntoReport = (report, itemsKey, countKey, validKey) => {
        if (!report || !report[itemsKey]) {
          return
        }
        for (const item of report[itemsKey]) {
          const rel = item.filePath
          const extraDiags = typeDiagsMap.get(rel) || []
          if (extraDiags.length > 0) {
            item.diagnostics = [...(item.diagnostics || []), ...extraDiags]
          }
          const errs = item.diagnostics.filter(d => d.severity === 'error').length
          const warns = item.diagnostics.filter(d => d.severity === 'warning').length
          item.valid = errs === 0 && (options.strict ? warns === 0 : true)
        }

        const items = report[itemsKey]
        const errCount = items.reduce((sum, item) => sum + item.diagnostics.filter(d => d.severity === 'error').length, 0)
        const warnCount = items.reduce((sum, item) => sum + item.diagnostics.filter(d => d.severity === 'warning').length, 0)
        const validCount = items.filter(item => item.valid).length

        if (report.summary) {
          report.summary.errorCount = errCount
          report.summary.warningCount = warnCount
          report.summary[validKey] = validCount
        }
        if (report.metrics) {
          report.metrics.totalErrors = errCount
          report.metrics.totalWarnings = warnCount
          report.metrics[validKey] = validCount
        }
      }

      mergeTypeDiagnosticsIntoReport(compReport, 'components', 'totalComponents', 'validComponents')
      mergeTypeDiagnosticsIntoReport(pageReport, 'pages', 'totalPages', 'validPages')

      // Filter reports if filter options are active
      const filteredCompReport = compReport ? JSON.parse(formatComponentValidationReport(compReport, {
        format: 'json',
        errorCode: targetCodesSet ? Array.from(targetCodesSet) : undefined,
        status: isFilterActive ? effectiveStatus : undefined
      })) : null

      const filteredPluginReport = pluginReport ? JSON.parse(formatPluginValidationReport(pluginReport, {
        format: 'json',
        errorCode: targetCodesSet ? Array.from(targetCodesSet) : undefined,
        status: isFilterActive ? effectiveStatus : undefined
      })) : null

      const filteredPageReport = pageReport ? JSON.parse(formatPageValidationReport(pageReport, {
        format: 'json',
        errorCode: targetCodesSet ? Array.from(targetCodesSet) : undefined,
        status: isFilterActive ? effectiveStatus : undefined
      })) : null

      const {
        totalFiles,
        validFiles,
        errorCount,
        warningCount,
        fixableCount
      } = aggregateReportSummaries([filteredCompReport, filteredPluginReport, filteredPageReport])

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
          ...(typeCheckResult?.skipped ? { skipped: true } : {}),
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
          process.stdout.write(formatComponentValidationReport(filteredCompReport, {
            format: 'console',
            coverage: runOpts.coverage,
            errorCode: targetCodesSet ? Array.from(targetCodesSet) : undefined,
            status: effectiveStatus
          }))
        }

        if (pluginReport) {
          validatedDomainsCount++
          process.stdout.write(formatPluginValidationReport(filteredPluginReport, {
            format: 'console',
            errorCode: targetCodesSet ? Array.from(targetCodesSet) : undefined,
            status: effectiveStatus
          }))
        }

        if (pageReport) {
          validatedDomainsCount++
          process.stdout.write(formatPageValidationReport(filteredPageReport, {
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
      let pageOpt = opts.pages

      if (Array.isArray(opts.domains)) {
        if (!opts.domains.includes('components') && !opts.components) {
          compOpt = false
        }
        if (!opts.domains.includes('plugins') && !opts.plugins) {
          pluginOpt = false
        }
        if (!opts.domains.includes('pages') && !opts.pages) {
          pageOpt = false
        }
      }

      const compDir = resolvePath(compOpt, 'components', ['src/components', 'tests/fixtures/components'])
      const pluginTarget = resolvePath(pluginOpt, 'plugins', ['src/plugins', 'tests/fixtures/plugins'])
      const pageDir = resolvePath(pageOpt, 'pages', ['src/pages', 'tests/fixtures/pages', 'pages'])

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

      // Fix Pages
      if (pageDir && existsSync(pageDir)) {
        const pageReport = await validatePagesDir(pageDir)

        await Promise.all(
          pageReport.pages.map(async (pageRes) => {
            if (!pageRes.filePath) {
              return
            }

            const rawDiagnostics = pageRes.diagnostics || []
            const diagnostics = targetCodesSet ? rawDiagnostics.filter(d => matchesErrorCode(d.code, targetCodesSet)) : rawDiagnostics

            const rawCode = await readFile(pageRes.filePath, 'utf8')
            const fixResult = applyPageFixes(rawCode, diagnostics, {
              filePath: pageRes.filePath,
              dryRun: opts.dryRun
            })

            if (fixResult.modified) {
              totalFixesCount += fixResult.fixesApplied.length
              modifiedFiles.push(pageRes.filePath)

              if (opts.dryRun) {
                process.stdout.write(fixResult.diff + '\n')
              } else {
                await writeFile(pageRes.filePath, fixResult.outputCode, 'utf8')
              }
            }
          })
        )
      }

      // Fix Plugins
      if (pluginTarget && existsSync(pluginTarget)) {
        const pluginFiles = []
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
      const knownComponents = new Map()
      if (compDir && existsSync(compDir)) {
        const compReport = await validateComponentsDir(compDir)
        if (compReport && compReport.components) {
          for (const c of compReport.components) {
            const name = c.componentTag || c.defined?.templateId || (c.filePath ? c.filePath.split('/').pop().replace(/\.(html|js)$/, '') : null)
            if (name) {
              knownComponents.set(name, {
                attributes: c.defined?.attributes ? c.defined.attributes.reduce((acc, curr) => ({
                  ...acc,
                  [curr]: {}
                }), {}) : {},
                slots: c.defined?.slots || []
              })
            }
          }
        }
      }

      if (config?.plugins && Array.isArray(config.plugins)) {
        for (const plugin of config.plugins) {
          if (plugin?.components) {
            const pComps = Array.isArray(plugin.components) ? plugin.components : [plugin.components]
            for (const pComp of pComps) {
              if (typeof pComp === 'string') {
                knownComponents.set(pComp.toLowerCase(), {
                  attributes: {},
                  slots: []
                })
              } else if (pComp && typeof pComp === 'object' && pComp.tag) {
                knownComponents.set(pComp.tag.toLowerCase(), {
                  attributes: {},
                  slots: []
                })
              }
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
        const [assetPkg, path, dest] = parts
        assets.push({
          pkg: assetPkg,
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
