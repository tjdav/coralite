/**
 * @import {CoraliteConfig} from 'coralite/types'
 * @import {Options} from 'sass'
 */

/**
 * @typedef {Object} CoraliteScriptBaseConfig
 * @property {string} public - The path to the directory containing static assets.
 * @property {Object} [server] - Server configuration options.
 * @property {number} server.port - The port number on which the development server will run.
 * @property {Object} [styles] - The configuration options for style processing.
 * @property {string[]} [styles.input] - Array of inputs, mixing scss and css
 * @property {Object} [styles.processors] - The configuration for style processors like Sass or PostCSS.
 * @property {Options<'async'>} [styles.processors.scss] - Native Dart Sass options
 * @property {Object} [styles.processors.postcss] - The configuration for PostCSS.
 * @property {import('postcss').AcceptedPlugin[]} [styles.processors.postcss.plugins] - Native PostCSS plugins
 * @property {'production' | 'development'} [mode='production'] - Set build mode for the coralite instance.
 * @property {boolean} [incremental=true] - Whether to skip rebuilding unchanged pages and components.
 */

/**
 * @typedef {CoraliteScriptBaseConfig & CoraliteConfig} CoraliteScriptConfig
 */

/**
 * @typedef {Object} CoraliteScriptOptions
 * @property {boolean} [dev] - Start development server with hot-reloading
 * @property {boolean} [build] - Build coralite site for production deployment
 * @property {boolean} [verbose] - Enable verbose logging output
 * @property {boolean} [incremental] - Enable or disable incremental build change detection
 */

/**
 * @typedef {Object} CoraliteCheckOptions
 * @property {string} [components] - Path to components directory
 * @property {string} [plugins] - Path to plugin file or directory
 * @property {string} [pages] - Path to pages directory
 * @property {'console' | 'json'} [format='console'] - Output format
 * @property {boolean} [strict=false] - Fail with non-zero exit code if warnings or unused tokens exist
 * @property {boolean} [coverage=false] - Include component test coverage metrics
 * @property {string} [cwd] - Working directory path override
 */

/**
 * @typedef {Object} CoraliteFixOptions
 * @property {string} [components] - Path to components directory
 * @property {string} [plugins] - Path to plugin file or directory
 * @property {string} [pages] - Path to pages directory
 * @property {boolean} [dryRun=false] - Preview changes without writing to disk
 * @property {string} [cwd] - Working directory path override
 */

/**
 * @typedef {Object} CoraliteCheckSummary
 * @property {number} totalFiles
 * @property {number} validFiles
 * @property {number} errorCount
 * @property {number} warningCount
 * @property {number} fixableCount
 * @property {number} totalUnused
 * @property {number} usageCoveragePercentage
 */

/**
 * @typedef {Object} CoraliteFixResult
 * @property {number} totalFixesCount
 * @property {string[]} modifiedFiles
 * @property {string[]} diffs
 * @property {any} [checkResult]
 * @property {boolean} hasFailures
 */

export default {}
