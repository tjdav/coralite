
/**
 * @import { CoraliteModuleValue } from './module.js'
 * @import { CoraliteDocument, CoraliteRef } from './document.js'
 */

/**
 * Coralite module script content
 * @typedef {Object} ScriptContent
 * @property {string} [content] - Script string content
 * @property {Object.<string, CoraliteModuleValue>} [values]
 * @property {number} [lineOffset] - Script offset number.
 * @property {ScriptImport[]} [imports] - Script imports.
 */

/**
 * @typedef {Object} ScriptImport
 * @property {string} specifier - Module specifier
 * @property {string} [defaultExport] - Default export name
 * @property {string} [namespaceExport] - Namespace export name (import * as namespace)
 * @property {string[]} [namedExports] - Named exports list (supports "original as alias" syntax)
 * @property {Object.<string, string>} [attributes] - Import attributes
 */

/**
 * @typedef {Object} CoraliteScriptContent
 * @property {string} id - Unique instance identifier
 * @property {string} [templateId] - Template identifier for shared functions
 * @property {CoraliteDocument} document - Coralite document with metadata and rendering structure.
 * @property {Object.<string, CoraliteModuleValue>} [values] - Instance values
 * @property {Object} refs - Array of reference identifiers.
 */

/**
 * @typedef {Object} ScriptPlugin
 * @property {Object.<string, any>} [config] - Plugin configuration
 * @property {function(any): void} [setup] - Called when plugin is registered
 * @property {ScriptImport[]} [imports] - Module imports for helpers
 * @property {Object.<string, function>} [helpers] - Global or instance helpers to add to scripts
 */

/**
 * @typedef {Object} InstanceContext
 * @property {string} instanceId - Unique instance identifier
 * @property {string} templateId - Template identifier
 * @property {Object.<string, CoraliteModuleValue>} values - Instance values
 * @property {Object.<string, string>} refs - Instance refs
 * @property {CoraliteDocument} [document] - Document context
 * @property {Object.<string, any>} [config] - Plugin configuration
 * @property {Object.<string, any>} [imports] - Plugin imports
 */

export default {}
