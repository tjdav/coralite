/**
 * @typedef {Object} CoralitePageValidationResult
 * @property {string} filePath - Path to page file
 * @property {string} [pageName] - Page name
 * @property {boolean} valid - Whether page passed validation without errors/warnings
 * @property {import('./component-validator.js').CoraliteDiagnostic[]} diagnostics - Array of page diagnostics
 * @property {Object} metrics
 * @property {number} metrics.totalErrors
 * @property {number} metrics.totalWarnings
 */

/**
 * @typedef {Object} CoralitePageValidationSummary
 * @property {number} totalPages
 * @property {number} validPages
 * @property {number} errorCount
 * @property {number} warningCount
 * @property {number} fixableCount
 */

/**
 * @typedef {Object} CoralitePageDirectoryValidationReport
 * @property {CoralitePageValidationResult[]} pages
 * @property {CoralitePageValidationSummary} summary
 * @property {Object} metrics
 * @property {number} metrics.totalPages
 * @property {number} metrics.validPages
 * @property {number} metrics.totalErrors
 * @property {number} metrics.totalWarnings
 */

export {}
