/**
 * @typedef {Object} ComponentValidationDefinedSymbols
 * @property {string[]} getters - Defined getter names
 * @property {string[]} serverProps - Properties returned from server block
 * @property {string[]} attributes - Defined attribute schema keys
 * @property {string[]} refs - Element ref names in template
 * @property {string[]} [imports] - Top level imported symbols
 */

/**
 * @typedef {Object} ComponentValidationUnusedSymbols
 * @property {string[]} getters - Unreferenced getters
 * @property {string[]} serverProps - Unreferenced server properties
 * @property {string[]} attributes - Unreferenced attributes
 * @property {string[]} refs - Unreferenced template element refs
 * @property {string[]} missingRefs - Called refs missing in HTML template
 * @property {string[]} [invalidClientImports] - Top-level imports referenced inside client block
 * @property {string[]} [invalidImports] - Alias for invalidClientImports
 */

/**
 * @typedef {Object} ComponentValidationMetrics
 * @property {number} totalDefined - Total defined symbols count
 * @property {number} totalUnused - Total unused symbols count
 * @property {number} [totalErrors] - Total error count
 * @property {number} usageCoveragePercentage - Percentage of symbols actively used
 */

/**
 * @typedef {'error' | 'warning' | 'info'} CoraliteDiagnosticSeverity
 */

/**
 * @typedef {Object} CoraliteDiagnosticGetter
 * @property {string} name - Name of the derived getter
 * @property {string} code - Getter implementation function code
 */

/**
 * @typedef {Object} CoraliteDiagnosticFix
 * @property {string} description - Human-readable fix explanation
 * @property {'lift_to_getter' | 'dynamic_import' | 'inject_ref' | 'remove_attribute' | 'strip_default'} [action] - Programmatic fix action type (omitted for guidance-only fixes)
 * @property {string} [replacement] - Replacement string snippet
 * @property {CoraliteDiagnosticGetter} [getter] - Getter definition if lifting to getter
 */

/**
 * @typedef {Object} CoraliteDiagnostic
 * @property {string} code - Diagnostic rule code (e.g. CORALITE-E201)
 * @property {CoraliteDiagnosticSeverity} severity - Diagnostic severity
 * @property {string} message - Diagnostic summary message
 * @property {string} [filePath] - File path where diagnostic occurred
 * @property {number} [line] - 1-based line number
 * @property {number} [column] - 1-based column number
 * @property {string} [codeframe] - Formatted codeframe snippet
 * @property {string} [cause] - Root-cause explanation
 * @property {CoraliteDiagnosticFix} [fix] - Actionable fix metadata
 */

/**
 * @typedef {Object} CoraliteValidationSummary
 * @property {number} totalComponents - Total components validated
 * @property {number} validComponents - Number of valid components (0 errors, 0 warnings)
 * @property {number} errorCount - Total errors found across all components
 * @property {number} warningCount - Total warnings found across all components
 * @property {number} fixableCount - Total diagnostics with fix.action
 * @property {number} usageCoveragePercentage - Overall usage coverage percentage
 */

/**
 * @typedef {Object} CoraliteComponentValidationResult
 * @property {string} filePath - Path to component file
 * @property {boolean} valid - Whether component is valid without errors or warnings
 * @property {CoraliteDiagnostic[]} diagnostics - Structured diagnostic errors, warnings, and fixes
 * @property {ComponentValidationDefinedSymbols} defined - Defined symbols in component
 * @property {ComponentValidationUnusedSymbols} unused - Unused/missing symbols in component
 * @property {ComponentValidationMetrics} metrics - Component coverage metrics
 */

/**
 * @typedef {Object} ComponentDirectoryValidationMetrics
 * @property {number} totalComponents - Total components validated
 * @property {number} [validComponents] - Number of valid components
 * @property {number} totalDefined - Total defined symbols across all components
 * @property {number} totalUnused - Total unused symbols across all components
 * @property {number} [totalErrors] - Total errors across all components
 * @property {number} overallCoveragePercentage - Overall usage coverage percentage
 * @property {boolean} coverageReportEnabled - Whether runtime coverage metrics were included
 */

/**
 * @typedef {Object} CoraliteComponentDirectoryValidationReport
 * @property {CoraliteComponentValidationResult[]} components - Array of component validation results
 * @property {CoraliteValidationSummary} [summary] - High-level diagnostic summary statistics
 * @property {ComponentDirectoryValidationMetrics} [metrics] - Aggregate metrics
 */

// Legacy typedef aliases
/** @typedef {ComponentValidationDefinedSymbols} ComponentAnalysisDefinedSymbols */
/** @typedef {ComponentValidationUnusedSymbols} ComponentAnalysisUnusedSymbols */
/** @typedef {ComponentValidationMetrics} ComponentAnalysisMetrics */
/** @typedef {CoraliteComponentValidationResult} CoraliteComponentAnalysisResult */
/** @typedef {ComponentDirectoryValidationMetrics} ComponentDirectoryAnalysisMetrics */
/** @typedef {CoraliteComponentDirectoryValidationReport} CoraliteComponentDirectoryAnalysisReport */

export {}
