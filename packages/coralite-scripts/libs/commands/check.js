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
  formatPageValidationReport,
  normalizeErrorCodes
} from 'coralite'

/**
 * Resolves directory or file path from CLI options, config, or default candidates.
 *
 * @param {string|undefined} explicitPath - Explicit path passed via CLI option.
 * @param {string} configProp - Config property name in configuration object.
 * @param {string[]} defaultCandidates - Array of candidate paths to check in cwd.
 * @param {import('../../types/index.js').CoraliteScriptConfig|null} [config=null] - Configuration object.
 * @param {string} [cwd=process.cwd()] - Current working directory.
 * @returns {string|null} Resolved path or null.
 */
function resolvePath (explicitPath, configProp, defaultCandidates, config = null, cwd = process.cwd()) {
  if (typeof explicitPath === 'boolean' && !explicitPath) {
    return null
  }

  if (typeof explicitPath === 'string') {
    return explicitPath
  }

  if (config && typeof config[configProp] === 'string') {
    return config[configProp]
  }

  for (const cand of defaultCandidates) {
    if (existsSync(join(cwd, cand))) {
      return cand
    }
  }

  return null
}

/**
 * Resolves target directory or file relative to cwd.
 *
 * @param {string|null} targetPath - Relative or absolute target path.
 * @param {string} cwd - Current working directory.
 * @returns {string|null} Existing target path or null.
 */
function resolveTargetDir (targetPath, cwd) {
  if (!targetPath || typeof targetPath !== 'string') {
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
 * Calculates total fixable diagnostics count for plugins.
 *
 * @param {any} pluginReport - Plugin validation report object.
 * @returns {number} Fixable count.
 */
function calculatePluginFixableCount (pluginReport) {
  if (!pluginReport || !Array.isArray(pluginReport.plugins)) {
    return 0
  }
  let count = 0
  for (const p of pluginReport.plugins) {
    if (Array.isArray(p.diagnostics)) {
      for (const d of p.diagnostics) {
        if (d && d.fix && d.fix.action) {
          count++
        }
      }
    }
  }
  return count
}

/**
 * Executes a unified validation check across components, plugins, and pages.
 *
 * @param {import('../../types/index.js').CoraliteScriptConfig|null} config - The configuration object.
 * @param {any} [options={}] - The CLI and command options.
 * @param {any} [logger=null] - Optional custom logger output stream.
 * @returns {Promise<{ hasFailures: boolean, summary: object, reports: object, output: string }>} Validation result.
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

  const targetCodesSet = normalizeErrorCodes(options.errorCode || options.code || options.errorCodes)
  let effectiveStatus = options.status
  if (!effectiveStatus) {
    if (options.onlyFailed || targetCodesSet) {
      effectiveStatus = 'failed'
    } else {
      effectiveStatus = 'all'
    }
  }
  const isFilterActive = Boolean(targetCodesSet || options.status || options.onlyFailed)

  let compOpt = options.components
  let pluginOpt = options.plugins
  let pageOpt = options.pages

  if (Array.isArray(options.domains)) {
    if (!options.domains.includes('components') && !options.components) {
      compOpt = false
    }
    if (!options.domains.includes('plugins') && !options.plugins) {
      pluginOpt = false
    }
    if (!options.domains.includes('pages') && !options.pages) {
      pageOpt = false
    }
  }

  let compDir = resolvePath(compOpt, 'components', ['src/components', 'tests/fixtures/components', 'components'], config, cwd)
  const pluginTarget = resolvePath(pluginOpt, 'plugins', ['src/plugins', 'tests/fixtures/plugins', 'plugins'], config, cwd)
  const pageDir = resolvePath(pageOpt, 'pages', ['src/pages', 'tests/fixtures/pages', 'pages'], config, cwd)

  if (!compDir && !pluginTarget && !pageDir && !options.components && !options.plugins && !options.pages) {
    compDir = '.'
  }

  let compReport = null
  const fullCompDir = resolveTargetDir(compDir, cwd)
  if (fullCompDir) {
    compReport = await validateComponentsDir(fullCompDir, { coverage: Boolean(options.coverage) })
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
          let attributesObj = {}
          if (c.defined && Array.isArray(c.defined.attributes)) {
            attributesObj = c.defined.attributes.reduce((acc, curr) => {
              acc[curr] = {}
              return acc
            }, {})
          }
          knownComponents.set(name, {
            attributes: attributesObj,
            slots: c.defined?.slots || []
          })
        }
      }
    }
    pageReport = await validatePagesDir(fullPageDir, {
      knownComponents,
      ignoreAttributes: config?.ignoreByAttribute,
      skipRenderByAttribute: config?.skipRenderByAttribute,
      ignoreTags: config?.ignoreTags
    })
  }

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
                       calculatePluginFixableCount(filteredPluginReport) +
                       (filteredPageReport?.summary?.fixableCount ?? 0)

  let totalUnused = 0
  if (compReport?.metrics?.totalUnused !== undefined) {
    totalUnused = compReport.metrics.totalUnused
  } else if (compReport?.summary && ('totalUnused' in compReport.summary)) {
    /** @type {Record<string, any>} */
    const summaryObj = compReport.summary
    totalUnused = Number(summaryObj.totalUnused) || 0
  }

  const usageCoveragePercentage = compReport?.summary?.usageCoveragePercentage ?? 100

  let outputStr = ''

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
    outputStr = JSON.stringify(jsonOutput, null, 2) + '\n'
    log(outputStr)
  } else {
    let out = '\n' + colours.bold().cyan('🪸 Coralite Workspace Check Report') + '\n'
    out += colours.gray('─'.repeat(60)) + '\n\n'

    if (targetCodesSet && totalFiles === 0) {
      out += colours.green().bold(`✔ No issues matching error code(s): ${Array.from(targetCodesSet).join(', ')}\n\n`)
    } else {
      if (compReport) {
        out += colours.bold().blue('🪸 Components') + '\n'
        out += formatComponentValidationReport(compReport, {
          format: 'console',
          coverage: options.coverage,
          errorCode: targetCodesSet ? Array.from(targetCodesSet) : undefined,
          status: effectiveStatus
        })
      }

      if (pluginReport) {
        out += colours.bold().magenta('🔌 Plugins') + '\n'
        out += formatPluginValidationReport(pluginReport, {
          format: 'console',
          errorCode: targetCodesSet ? Array.from(targetCodesSet) : undefined,
          status: effectiveStatus
        })
      }

      if (pageReport) {
        out += colours.bold().yellow('📄 Pages') + '\n'
        out += formatPageValidationReport(pageReport, {
          format: 'console',
          errorCode: targetCodesSet ? Array.from(targetCodesSet) : undefined,
          status: effectiveStatus
        })
      }
    }

    out += colours.gray('─'.repeat(60)) + '\n'

    let summaryColor = colours.green().bold
    if (errorCount > 0) {
      summaryColor = colours.red().bold
    }

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
    components: filteredCompReport,
    plugins: filteredPluginReport,
    pages: filteredPageReport
  }

  return {
    hasFailures,
    summary,
    reports,
    output: outputStr
  }
}
