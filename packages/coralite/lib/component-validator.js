import { readFile, readdir, stat, access } from 'node:fs/promises'
import { join, extname, relative, resolve } from 'node:path'
import { formatValidationReport } from './utils/diagnostics.js'
import {
  createValidationContext,
  parseIgnoreDirectives,
  parseScriptAST,
  validateTemplate,
  validateAttributes,
  validateContextOptions,
  validateServerBlock,
  validateGetters,
  validateSlots,
  validateStyle,
  validateClientBlock,
  collectDeadCode
} from './validator/index.js'

/**
 * @import {
 *   CoraliteComponentValidationResult,
 *   CoraliteComponentDirectoryValidationReport
 * } from '../types/index.js'
 */

/**
 * Validates component source code for unused getters, server state, attributes, refs, top-level client imports,
 * template expressions, serialization boundaries, reactive loops, and attribute mutexes.
 *
 * @param {string} sourceCode - Raw component file content
 * @param {string} [filePath=''] - Path to component file for context
 * @returns {CoraliteComponentValidationResult} Validation result with diagnostics, defined, unused, and coverage metrics
 */
export function validateComponentSource (sourceCode, filePath = '') {
  const context = createValidationContext(sourceCode, filePath)

  parseIgnoreDirectives(context)
  parseScriptAST(context)
  validateTemplate(context)

  if (context.configObj) {
    validateAttributes(context)
    validateContextOptions(context)
    validateServerBlock(context)
    validateGetters(context)
    validateSlots(context)
    validateStyle(context)
    validateClientBlock(context)
  }

  return collectDeadCode(context)
}

/**
 * Validates a component file on disk statically.
 *
 * @param {string} filePath - Path to component file
 * @returns {Promise<CoraliteComponentValidationResult>} Validation result
 */
export async function validateComponentFile (filePath) {
  const absPath = resolve(filePath)

  try {
    await access(absPath)
  } catch {
    throw new Error(`Component file not found: ${absPath}`)
  }

  const st = await stat(absPath)
  if (st.isDirectory()) {
    throw new Error(`Expected a file but found directory: ${absPath}`)
  }

  const content = await readFile(absPath, 'utf8')
  const relPath = relative(process.cwd(), absPath)

  return validateComponentSource(content, relPath)
}

/**
 * Scans a directory recursively for component files (.html / .js) and validates usage.
 * If passed a file path, delegates to validateComponentFile and returns a 1-entry report.
 *
 * @param {string} componentsDir - Path to components directory or file
 * @param {Object} [options={}] - Options like coverage flag
 * @returns {Promise<CoraliteComponentDirectoryValidationReport>} Aggregated directory validation report
 */
export async function validateComponentsDir (componentsDir, options = {}) {
  const absoluteDir = resolve(componentsDir)

  try {
    await access(absoluteDir)
  } catch {
    throw new Error(`Components directory not found: ${absoluteDir}`)
  }

  const targetStat = await stat(absoluteDir)
  if (targetStat.isFile()) {
    const result = await validateComponentFile(absoluteDir)
    const errs = (result.diagnostics || []).filter(d => d.severity === 'error').length
    const warns = (result.diagnostics || []).filter(d => d.severity === 'warning').length
    const fixables = (result.diagnostics || []).filter(d => Boolean(d.fix && d.fix.action)).length
    const totalDefined = result.metrics?.totalDefined || 0
    const totalUnused = result.metrics?.totalUnused || 0
    const overallCoveragePercentage = totalDefined > 0
      ? Math.round(((totalDefined - totalUnused) / totalDefined) * 100)
      : 100

    return {
      components: [result],
      summary: {
        totalComponents: 1,
        validComponents: result.valid ? 1 : 0,
        errorCount: errs,
        warningCount: warns,
        fixableCount: fixables,
        usageCoveragePercentage: overallCoveragePercentage
      },
      metrics: {
        totalComponents: 1,
        validComponents: result.valid ? 1 : 0,
        totalDefined,
        totalUnused,
        totalErrors: errs,
        overallCoveragePercentage,
        coverageReportEnabled: !!options.coverage
      }
    }
  }

  const results = []

  const scanDir = async (dir) => {
    const entries = await readdir(dir)
    await Promise.all(entries.map(async (entry) => {
      const fullPath = join(dir, entry)
      const st = await stat(fullPath)

      if (st.isDirectory()) {
        await scanDir(fullPath)
      } else if (st.isFile() && (extname(entry) === '.html' || extname(entry) === '.js')) {
        const content = await readFile(fullPath, 'utf8')
        if (content.includes('defineComponent') || content.includes('<template')) {
          const relPath = relative(process.cwd(), fullPath)
          const result = validateComponentSource(content, relPath)
          results.push(result)
        }
      }
    }))
  }

  await scanDir(absoluteDir)

  results.sort((a, b) => (a.filePath || '').localeCompare(b.filePath || ''))

  let totalDefined = 0
  let totalUnused = 0
  let errorCount = 0
  let warningCount = 0
  let fixableCount = 0
  let validComponents = 0

  for (const res of results) {
    totalDefined += res.metrics?.totalDefined || 0
    totalUnused += res.metrics?.totalUnused || 0
    const errs = (res.diagnostics || []).filter(d => d.severity === 'error').length
    const warns = (res.diagnostics || []).filter(d => d.severity === 'warning').length
    const fixables = (res.diagnostics || []).filter(d => Boolean(d.fix && d.fix.action)).length

    errorCount += errs
    warningCount += warns
    fixableCount += fixables

    if (res.valid) {
      validComponents++
    }
  }

  const overallCoveragePercentage = totalDefined > 0
    ? Math.round(((totalDefined - totalUnused) / totalDefined) * 100)
    : 100

  return {
    components: results,
    summary: {
      totalComponents: results.length,
      validComponents,
      errorCount,
      warningCount,
      fixableCount,
      usageCoveragePercentage: overallCoveragePercentage
    },
    metrics: {
      totalComponents: results.length,
      validComponents,
      totalDefined,
      totalUnused,
      totalErrors: errorCount,
      overallCoveragePercentage,
      coverageReportEnabled: !!options.coverage
    }
  }
}

/**
 * Formats component validation results into human-readable terminal output or JSON string.
 *
 * @param {Object} report - Validation report from validateComponentsDir
 * @param {Object} [options={}] - Formatting options (format: 'console'|'json')
 * @returns {string} Formatted output string
 */
export function formatComponentValidationReport (report, options = {}) {
  return formatValidationReport(report, options)
}

// Backwards compatibility aliases
export const analyseComponentSource = validateComponentSource
export const analyseComponentFile = validateComponentFile
export const analyseComponentsDir = validateComponentsDir
export const formatComponentAnalysis = formatComponentValidationReport
export const analyzeComponentSource = validateComponentSource
export const analyzeComponentFile = validateComponentFile
export const analyzeComponentsDir = validateComponentsDir
