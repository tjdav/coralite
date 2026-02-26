
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
 * @property {function(any): void} [setup] - Called when plugin is registered
 * @property {Object.<string, function>} [helpers] - Global or instance helpers to add to scripts
 * @property {Object.<'register'|'beforeExecute'|'afterExecute'|'onScriptCompile', function>} [lifecycle] - Lifecycle hooks
 * @property {function(string, Object): string} [transform] - Transform script content
 */

/**
 * @typedef {Object} InstanceContext
 * @property {string} instanceId - Unique instance identifier
 * @property {string} templateId - Template identifier
 * @property {Object.<string, CoraliteModuleValue>} values - Instance values
 * @property {Object.<string, string>} refs - Instance refs
 * @property {CoraliteDocument} [document] - Document context
 */

export default {}
