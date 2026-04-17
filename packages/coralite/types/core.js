
/**
 * @import { CoraliteModuleValues } from './module.js'
 * @import { CoralitePluginInstance } from './plugin.js'
 * @import { Attribute } from './component.js'
 */

/**
 * Represents HTML file data including path and raw content.
 * @typedef {Object} HTMLData
 * @property {'page'|'component'} [type] - The type of HTML file. 'page' for main pages, 'component' for reusable components.
 * @property {CoraliteModuleValues} [values] - The initial values for the HTML module.
 * @property {CoraliteFilePath} path - The file's path information within the project structure.
 * @property {string} [content] - The raw HTML string contents of the file (optional, may be omitted for templates).
 */

/**
 * Represents a file's path structure within the project.
 * @typedef {Object} CoraliteFilePath
 * @property {string} pathname - Full relative path from the project root to the file.
 * @property {string} dirname - Directory name containing the file.
 * @property {string} filename - The base file name (including extension).
 */

/**
 * Defines root directories for pages and components in a Coralite project.
 * @typedef {Object} CoralitePath
 * @property {string} pages - The path to the root pages directory
 * @property {string} components - The path to the root components directory
 */

/**
 * @typedef {Object} CoraliteStaticAsset
 * @property {string} [pkg] - The package name to copy assets from.
 * @property {string} [path] - The path to the asset within the package.
 * @property {string} dest - The destination path for the asset in the output directory.
 * @property {string} [src] - The absolute path to the source file (bypasses package resolution).
 */

/**
 * Error or warning data passed to the onError callback.
 * @typedef {Object} CoraliteErrorData
 * @property {'WARN'|'ERR'|'LOG'} level - The severity level.
 * @property {string} message - The message describing the error or warning.
 * @property {Error} [error] - Optional error object for tracing.
 */

/**
 * Callback function for handling errors and warnings.
 * @callback CoraliteOnError
 * @param {CoraliteErrorData} data - The error or warning data.
 * @returns {void}
 */

/**
 * @typedef {Object} CoraliteConfig
 * @property {string} output - The path to the output directory where built files will be placed.
 * @property {string} components - The path to the directory containing Coralite components.
 * @property {string} pages - The path to the directory containing pages that will be rendered using the provided templates.
 * @property {CoralitePluginInstance[]} [plugins] - Optional array of plugin instances to extend Coralite functionality.
 * @property {string} [options.baseURL] - Optional base URL for asset paths. Defaults to '/'.
 * @property {CoraliteStaticAsset[]} [assets] - Static assets to copy during build.
 * @property {Array<string | Attribute>} [ignoreByAttribute] - An array of attribute names and values to ignore by element type.
 * @property {Array<string | Attribute>} [skipRenderByAttribute] - An array of attribute names and values to skip rendering by element type.
 * @property {CoraliteOnError} [onError] - Optional callback function for handling errors and warnings.
 * @property {string} [options.mode='production'] - Build mode: "development" or "production"
 */

/**
 * Represents URL and file path values available during component rendering.
 * @typedef {Object} CoralitePathValues
 * @property {string} page_url_pathname - The URL pathname
 * @property {string} page_url_dirname - The directory name of the URL
 * @property {string} page_pathname - The file path name
 * @property {string} page_dirname - The directory name of the file
 * @property {string} page_filename - The filename
 * @property {Object<string, string>} [data.values] - Additional values from data
 */

/**
 * Union type representing values available for token replacement in components.
 * @typedef {CoralitePathValues | Object.<string, string>} CoraliteValues
 */

export default {}
