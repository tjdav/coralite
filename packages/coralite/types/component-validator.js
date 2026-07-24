/**
 * @typedef {Object} ComponentAnalysisDefinedSymbols
 * @property {string[]} getters - Defined getter names
 * @property {string[]} serverProps - Properties returned from server block
 * @property {string[]} attributes - Defined attribute schema keys
 * @property {string[]} refs - Element ref names in template
 */

/**
 * @typedef {Object} ComponentAnalysisUnusedSymbols
 * @property {string[]} getters - Unreferenced getters
 * @property {string[]} serverProps - Unreferenced server properties
 * @property {string[]} attributes - Unreferenced attributes
 * @property {string[]} refs - Unreferenced template element refs
 * @property {string[]} missingRefs - Called refs missing in HTML template
 */

/**
 * @typedef {Object} ComponentAnalysisMetrics
 * @property {number} totalDefined - Total defined symbols count
 * @property {number} totalUnused - Total unused symbols count
 * @property {number} usageCoveragePercentage - Percentage of symbols actively used
 */

/**
 * @typedef {Object} CoraliteComponentAnalysisResult
 * @property {string} filePath - Path to component file
 * @property {ComponentAnalysisDefinedSymbols} defined - Defined symbols in component
 * @property {ComponentAnalysisUnusedSymbols} unused - Unused/missing symbols in component
 * @property {ComponentAnalysisMetrics} metrics - Component coverage metrics
 */

/**
 * @typedef {Object} ComponentDirectoryAnalysisMetrics
 * @property {number} totalComponents - Total components analyzed
 * @property {number} totalDefined - Total defined symbols across all components
 * @property {number} totalUnused - Total unused symbols across all components
 * @property {number} overallCoveragePercentage - Overall usage coverage percentage
 * @property {boolean} coverageReportEnabled - Whether runtime coverage metrics were included
 */

/**
 * @typedef {Object} CoraliteComponentDirectoryAnalysisReport
 * @property {CoraliteComponentAnalysisResult[]} components - Array of component analysis results
 * @property {ComponentDirectoryAnalysisMetrics} metrics - Aggregate metrics
 */

export {}
