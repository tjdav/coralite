import colours from 'kleur'
import { join } from 'node:path'
import { existsSync, statSync } from 'node:fs'
import {
  validateComponentsDir,
  formatComponentValidationReport,
  validatePluginFile,
  validatePluginsDir,
  formatPluginValidationReport,
  validatePagesDir,
  formatPageValidationReport
} from 'coralite'

function resolvePath (explicitPath, configProp, defaultCandidates, config, cwd = process.cwd()) {
  if (explicitPath) {
    return explicitPath
  }
  if (config && config[configProp]) {
    return config[configProp]
  }
  for (const cand of defaultCandidates) {
    if (existsSync(join(cwd, cand))) {
      return cand
    }
  }
  return null
}

function resolveTargetDir (targetPath, cwd) {
  if (!targetPath) {
    return null
  }
  const relativePath = join(cwd, targetPath)
  if (existsSync(relativePath)) {
    return relativePath
  }
  if (existsSync(targetPath)) {
    return targetPath
  }
  return null
}

/**
 * Executes a unified validation check across components, plugins, and pages.
 *
 * @param {import('../../types/index.js').CoraliteScriptConfig|null} config - The configuration object.
 * @param {any} [options={}] - The CLI and command options.
 * @param {any} [logger=null] - Optional custom logger output stream.
 */
export async function checkCommand (config, options = {}, logger = null) {
  const cwd = options.cwd || process.cwd()
  const log = (msg) => {
    if (logger && typeof logger.write === 'function') {
      logger.write(msg)
    } else if (logger && typeof logger.log === 'function') {
      logger.log(msg)
    } else {
      process.stdout.write(msg)
    }
  }

  let compDir = resolvePath(options.components, 'components', ['src/components', 'tests/fixtures/components', 'components'], config, cwd)
  const pluginTarget = resolvePath(options.plugins, 'plugins', ['src/plugins', 'tests/fixtures/plugins', 'plugins'], config, cwd)
  const pageDir = resolvePath(options.pages, 'pages', ['src/pages', 'tests/fixtures/pages', 'pages'], config, cwd)

  if (!compDir && !pluginTarget && !pageDir && !options.components && !options.plugins && !options.pages) {
    compDir = '.'
  }

  let compReport = null
  const fullCompDir = resolveTargetDir(compDir, cwd)
  if (fullCompDir) {
    compReport = validateComponentsDir(fullCompDir, { coverage: Boolean(options.coverage) })
  }

  let pluginReport = null
  const fullPluginTarget = resolveTargetDir(pluginTarget, cwd)

  if (fullPluginTarget) {
    if (statSync(fullPluginTarget).isFile()) {
      const result = await validatePluginFile(fullPluginTarget)
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
      pluginReport = await validatePluginsDir(fullPluginTarget)
    }
  }

  let pageReport = null
  const fullPageDir = resolveTargetDir(pageDir, cwd)

  if (fullPageDir) {
    const knownComponents = new Map()
    if (compReport && compReport.components) {
      for (const c of compReport.components) {
        if (c.filePath) {
          const name = c.filePath.split('/').pop().replace(/\.(html|js)$/, '')
          knownComponents.set(name, {
            attributes: c.defined ? c.defined.attributes.reduce((acc, curr) => ({
              ...acc,
              [curr]: {}
            }), {}) : {}
          })
        }
      }
    }
    pageReport = validatePagesDir(fullPageDir, { knownComponents })
  }

  const totalFiles = (compReport ? compReport.summary.totalComponents : 0) +
                     (pluginReport ? pluginReport.metrics.totalPlugins : 0) +
                     (pageReport ? pageReport.summary.totalPages : 0)

  const validFiles = (compReport ? compReport.summary.validComponents : 0) +
                     (pluginReport ? pluginReport.metrics.validPlugins : 0) +
                     (pageReport ? pageReport.summary.validPages : 0)

  const errorCount = (compReport ? compReport.summary.errorCount : 0) +
                     (pluginReport ? pluginReport.metrics.totalErrors : 0) +
                     (pageReport ? pageReport.summary.errorCount : 0)

  const warningCount = (compReport ? compReport.summary.warningCount : 0) +
                       (pluginReport ? pluginReport.metrics.totalWarnings : 0) +
                       (pageReport ? pageReport.summary.warningCount : 0)

  const fixableCount = (compReport ? compReport.summary.fixableCount : 0) +
                       (pluginReport ? (pluginReport.plugins || []).reduce((acc, p) => acc + (p.diagnostics || []).filter(d => Boolean(d.fix && d.fix.action)).length, 0) : 0) +
                       (pageReport ? pageReport.summary.fixableCount : 0)

  let totalUnused = 0
  if (compReport && compReport.metrics) {
    totalUnused = compReport.metrics.totalUnused || 0
  }

  const usageCoveragePercentage = compReport ? compReport.summary.usageCoveragePercentage : 100

  let outputStr = ''

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
    outputStr = JSON.stringify(jsonOutput, null, 2) + '\n'
    log(outputStr)
  } else {
    let out = '\n' + colours.bold().cyan('🪸 Coralite Workspace Check Report') + '\n'
    out += colours.gray('─'.repeat(60)) + '\n\n'

    if (compReport) {
      out += colours.bold().blue('🪸 Components') + '\n'
      out += formatComponentValidationReport(compReport, {
        format: 'console',
        coverage: options.coverage
      })
    }

    if (pluginReport) {
      out += colours.bold().magenta('🔌 Plugins') + '\n'
      out += formatPluginValidationReport(pluginReport, { format: 'console' })
    }

    if (pageReport) {
      out += colours.bold().yellow('📄 Pages') + '\n'
      out += formatPageValidationReport(pageReport, { format: 'console' })
    }

    out += colours.gray('─'.repeat(60)) + '\n'
    const summaryColor = errorCount === 0 ? colours.green().bold : colours.red().bold

    let summaryLine = `Summary: ${totalFiles} file(s) validated across 3 domains | ${validFiles} valid | ${errorCount} error(s) | ${warningCount} warning(s)`
    if (fixableCount > 0) {
      summaryLine += ` | ${fixableCount} fixable with --fix`
    }
    out += summaryColor(summaryLine) + '\n\n'

    outputStr = out
    log(outputStr)
  }

  const hasFailures = errorCount > 0 || (Boolean(options.strict) && (warningCount > 0 || totalUnused > 0))

  const summary = {
    totalFiles,
    validFiles,
    errorCount,
    warningCount,
    fixableCount,
    totalUnused,
    usageCoveragePercentage
  }

  const reports = {
    components: compReport,
    plugins: pluginReport,
    pages: pageReport
  }

  return {
    hasFailures,
    summary,
    reports,
    output: outputStr
  }
}
