
/**
 * @import { CoraliteModuleValue } from './module.js'
 * @import { CoraliteComponent } from './component.js'
 */

/**
 * Coralite module script content
 * @typedef {Object} ScriptContent
 * @property {string} [content] - Script string content
 * @property {string} [setupContent] - Setup string content
 * @property {Object.<string, CoraliteModuleValue>} [values]
 * @property {number} [lineOffset] - Script offset number.
 * @property {ScriptImport[]} [imports] - Script imports.
 * @property {string[]} [tokens] - Extracted reactivity tokens.
 * @property {string[]} [components] - Imperative components array.
 * @property {Object} [defaultValues] - Initial state from setup.
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
 * @property {string} instanceId - Unique instance identifier
 * @property {string} [componentId] - component identifier for shared functions
 * @property {import('./core.js').CoralitePath & import('./core.js').CoraliteFilePath} [path] - Component AST
 * @property {Object.<string, CoraliteModuleValue>} [values] - Instance values
 * @property {Object.<string, string>} [refs] - Instance refs
 * @property {ShadowRoot | Document} [root] - Shadow Root or DOM
 * @property {Object.<string, any>} [helpers] - Plugin helpers available to the script
 */

/**
 * @typedef {Object} ScriptPluginHelperGlobalContext
 * @property {Object.<string, any>} [config] - Plugin configuration
 * @property {Object.<string, any>} [imports] - Module imports for helpers
 */

/**
 * @callback ScriptPluginHelperGlobalInstance
 * @param {ScriptPluginHelperGlobalContext} globalContext - Global instance context
 * @returns {ScriptPluginHelperLocalInstance}
 */

/**
 * @callback ScriptPluginHelperLocalInstance
 * @param {CoraliteScriptContent} localContext - Local instance context
 * @returns {any}
 */

/**
 * @typedef {Object} ScriptPlugin
 * @property {Object.<string, any>} [config] - Plugin configuration
 * @property {function(any): void} [setup] - Called when plugin is registered
 * @property {ScriptImport[]} [imports] - Module imports for helpers
 * @property {Object.<string, ScriptPluginHelperGlobalInstance>} [helpers] - Global or instance helpers to add to scripts
 */

/**
 * @typedef {Object} InstanceContext
 * @property {string} instanceId - Unique instance identifier
 * @property {string} componentId - component identifier
 * @property {Object.<string, CoraliteModuleValue>} values - Instance values
 * @property {Object.<string, string>} [refs] - Instance refs
 * @property {CoraliteComponent} [component] - Component AST
 * @property {Object.<string, any>} [config] - Plugin configuration
 * @property {Object.<string, any>} [imports] - Plugin imports
 */

export default {}
