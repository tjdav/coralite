
/**
 * @import { CoraliteModuleValue } from './module.js'
 * @import { CoraliteDocument, CoraliteRef } from './document.js'
 */

/**
 * Coralite module script content
 * @typedef {Object} ScriptContent
 * @property {string} [content] - Script string content
 * @property {string} [setupContent] - Setup string content
 * @property {Object.<string, CoraliteModuleValue>} [values]
 * @property {number} [lineOffset] - Script offset number.
 * @property {ScriptImport[]} [imports] - Script imports.
 * @property {string[]} [components] - Extracted component dependencies.
 * @property {string[]} [tokens] - Extracted reactivity tokens.
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
 * @property {string} [componentId] - component identifier for shared functions
 * @property {CoraliteDocument} metadata - Coralite document with metadata and rendering structure.
 * @property {Object} client - Encapsulated client-side runtime metadata and execution context
 * @property {Object.<string, CoraliteModuleValue>} [client.values] - Instance values
 * @property {Object.<string, string>} [client.refs] - Instance refs
 * @property {ShadowRoot | Document} [client.document=window.document] - Shadow Root for web components
 * @property {Object.<string, any>} [client.helpers] - Plugin helpers available to the script
 */

/**
 * @typedef {Object} ScriptPlugin
 * @property {Object} client - Encapsulated client namespace
 * @property {Object.<string, any>} [client.config] - Plugin configuration
 * @property {function(any): void} [client.setup] - Called when plugin is registered
 * @property {ScriptImport[]} [client.imports] - Module imports for helpers
 * @property {Object.<string, function>} [client.helpers] - Global or instance helpers to add to scripts
 * @property {string[]} [client.components] - Additional component IDs that are imperatively imported and appended to the dom.
 */

/**
 * @typedef {Object} InstanceContext
 * @property {string} instanceId - Unique instance identifier
 * @property {string} componentId - component identifier
 * @property {Object.<string, CoraliteModuleValue>} values - Instance values
 * @property {Object.<string, string>} [refs] - Instance refs
 * @property {CoraliteDocument} [document] - Document context
 * @property {Object.<string, any>} [config] - Plugin configuration
 * @property {Object.<string, any>} [imports] - Plugin imports
 */

export default {}
