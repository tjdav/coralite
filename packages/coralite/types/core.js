
/**
 * @import { CoraliteModuleValues } from './module.js'
 * @import { CoralitePluginInstance } from './plugin.js'
 * @import { Attribute } from './document.js'
 */

/**
 * Represents HTML file data including path and raw content.
 * @typedef {Object} HTMLData
 * @property {'page'|'template'} [type] - The type of HTML file. 'page' for main pages, 'template' for reusable components.
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
 * Defines root directories for pages and templates in a Coralite project.
 * @typedef {Object} CoralitePath
 * @property {string} pages - The path to the root pages directory
 * @property {string} templates - The path to the root templates directory
 */

/**
 * @typedef {Object} CoraliteConfig
 * @property {string} output - The path to the output directory where built files will be placed.
 * @property {string} templates - The path to the directory containing Coralite templates.
 * @property {string} pages - The path to the directory containing pages that will be rendered using the provided templates.
 * @property {CoralitePluginInstance[]} [plugins] - Optional array of plugin instances to extend Coralite functionality.
 * @property {Attribute[]} [ignoreByAttribute] - An array of attribute names and values to ignore by element type.
 * @property {Attribute[]} [skipRenderByAttribute] - An array of attribute names and values to skip rendering by element type.
 */

/**
 * Represents URL and file path values available during template rendering.
 * @typedef {Object} CoralitePathValues
 * @property {string} $urlPathname - The URL pathname
 * @property {string} $urlDirname - The directory name of the URL
 * @property {string} $filePathname - The file path name
 * @property {string} $fileDirname - The directory name of the file
 * @property {string} $filename - The filename
 * @property {Object<string, string>} [data.values] - Additional values from data
 */

/**
 * Union type representing values available for token replacement in templates.
 * @typedef {CoralitePathValues | Object.<string, string>} CoraliteValues
 */

export default {}
