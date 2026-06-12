
/**
 * @import { CoraliteModuleDefinition, CoraliteModuleSlotFunction } from './module.js'
 * @import { CoralitePage, CoraliteSession } from './core.js'
 * @import { CoraliteClientPluginBeforeComponentRenderCallback, CoraliteClientPluginAfterComponentRenderCallback, CoraliteClientPluginDisconnectedCallback } from './plugin.js'
 */

/**
 * Coralite module script content
 * @typedef {Object} ScriptContent
 * @property {string} [content] - Script string content
 * @property {string} [setupContent] - Setup string content
 * @property {Object.<string, CoraliteModuleDefinition>} [state] - The initial state to be applied to the instance.
 * @property {number} [lineOffset] - Script offset number.
 * @property {string[]} [components] - Imperative components array.
 * @property {Object} [defaultValues] - Initial state from setup.
 * @property {Object.<string, CoraliteModuleSlotFunction>} [slots] - Computed slots.
 * @property {Object} [attributes] - Attribute schema.
 * @property {Object} [getters] - Isomorphic getters.
 * @property {Object} [server] - Hydrated server data.
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
 * @typedef {Object} CoraliteScriptContext
 * @property {string} id - Unique instance identifier
 * @property {string} instanceId - Unique instance identifier
 * @property {HTMLElement} root - The custom element instance (available in browser runtime)
 * @property {Object.<string, CoraliteModuleDefinition>} state - Instance state
 * @property {Function} refs - Instance refs
 * @property {AbortSignal} signal - Lifecycle abort signal for unmount events (null for declarative components).
 */

/**
 * @typedef {Object.<string, any>} ScriptPluginHelperGlobalContext
 */

/**
 * @typedef {ScriptPluginHelperGlobalContext & { config: Object.<string, any> }} ScriptPluginHelperPhase1Context
 */

/**
 * @typedef {Object} ScriptPlugin
 * @property {string} [name] - The name of the plugin
 * @property {string} [rootDir] - The root directory of the plugin
 * @property {Object.<string, any>} [config] - Plugin configuration
 * @property {function(any): void} [setup] - Called when plugin is registered
 * @property {CoraliteClientPluginBeforeComponentRenderCallback} [onBeforeComponentRender] - Called before component is rendered
 * @property {CoraliteClientPluginAfterComponentRenderCallback} [onAfterComponentRender] - Called after component is rendered
 * @property {CoraliteClientPluginDisconnectedCallback} [onDisconnected] - Called when component is removed from the DOM
 * @property {(pluginContext: ScriptPluginHelperPhase1Context) => any} [context] - Symmetrical context function
 * @property {string[]} [_extractedComponents] - Extracted imperative components
 */

/**
 * @typedef {Object} InstanceContext
 * @property {string} instanceId - Unique instance identifier
 * @property {string} componentId - component identifier
 * @property {Object.<string, CoraliteModuleDefinition>} state - Instance state
 * @property {CoraliteSession} [session] - Build-time render context.
 * @property {CoralitePage} [page] - The global page object
 * @property {Object.<string, string>} [refs] - Instance refs
 */

export default {}
