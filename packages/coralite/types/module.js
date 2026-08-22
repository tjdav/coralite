
/**
 * @import { CoraliteElement, CoraliteAnyNode, CoraliteDirective } from './dom.js'
 * @import { CoraliteFilePath, CoraliteProperties, CoralitePage } from './core.js'
 * @import { CoraliteComponentValues, CoraliteRef } from './component.js'
 * @import { ScriptContent, CoraliteScriptContext } from './script.js'
 * @import { CoralitePluginContext } from './plugin.js'
 */

/**
 * A module within the Coralite library, containing metadata and rendering logic.
 * @typedef {Object} CoraliteModule
 * @property {string} [id] - Unique module identifier used to reference this module within the application.
 * @property {CoraliteFilePath} [path] - Component paths associated with this module, if any.
 * @property {number} [lineOffset] - Optional offset value for line numbering purposes within the component.
 * @property {CoraliteElement} [template] - Module's rendering template which defines its structure and layout.
 * @property {string|undefined} [script] - Module's JavaScript raw code used for logic or behavior associated with this module.
 * @property {string[]} [styles] - Raw CSS associated with this module.
 * @property {CoraliteComponentValues} [values] - Values generated from the module's markup, containing metadata or variable information.
 * @property {CoraliteElement[]} [customElements] - Custom elements defined in the module, allowing extension of HTML capabilities.
 * @property {Object.<string, Object.<string,CoraliteModuleSlotElement>>} [slotElements] - Custom slot elements and their configurations, enabling flexible content insertion points within components.
 * @property {boolean} isTemplate - Indicates whether the module is a template
 * @property {Set<string>} [rootClasses] - Root classes relative to template.
 * @property {Set<string>} [descendantClasses] - Descendant classes.
 * @property {string[]} [_globalsCache] - Internal cache for script globals.
 */

/**
 * Represents a single value that a module can store or process.
 * @typedef {string | number | boolean | string[] | (CoraliteDirective | CoraliteAnyNode)[] | Object.<string, any>} CoraliteModuleDefinition
 */

/**
 * A collection of module values associated with a module.
 * @typedef {Object.<string, CoraliteModuleDefinition> & { __script__?: ScriptContent, page?: CoralitePage }} CoraliteModuleDefinitions
 */

/**
 * Defines a slot element and its configuration within a module.
 * @typedef {Object} CoraliteModuleSlotElement
 * @property {string} name - Slot element identifier
 * @property {CoraliteElement} element - Corresponding HTML element for the slot
 */

/**
 * @callback CoraliteModuleScript
 * @param {CoraliteScriptContext} context - The module's script context
 */

/**
 * @callback CoraliteModulePropertiesFunction
 * @param {CoralitePluginContext} context - The plugin context used to resolve properties.
 * @returns {CoraliteModuleDefinitions | Promise<CoraliteModuleDefinitions> | CoraliteModulePropertiesFunction | Promise<CoraliteModulePropertiesFunction>}
 */

/**
 * @callback CoraliteModuleDataFunction
 * @param {CoralitePluginContext} context - The plugin context used to generate component data.
 * @returns {Object | Promise<Object>}
 */

/**
 * @callback CoraliteModuleGetterFunction
 * @param {CoraliteModuleDefinitions} state - The current state used to compute the getter value.
 * @param {Object} [options] - The configuration options for the getter.
 * @param {AbortSignal} [options.signal] - The optional abort signal to cancel the operation.
 * @returns {any | Promise<any>}
 */

/**
 * @typedef {CoraliteModuleDefinitions | CoraliteModulePropertiesFunction} CoraliteModuleProperties
 */

/**
 * @typedef {Object} CoraliteSlotContextBase
 * @property {Readonly<Object>} state - Reactive proxy (client) or merged state (SSR).
 * @property {(prop: string, callback: (newVal: any, oldVal?: any) => any) => (() => void)} observe - State observer registering fine-grained reactivity and returning a disposer.
 * @property {AbortSignal} signal - Lifecycle abort signal aborted on disconnectedCallback.
 * @property {HTMLElement|null} root - Host element on client, null during SSR build.
 * @property {(name: string) => HTMLElement|null} refs - Refs lookup function (returns null on SSR).
 * @property {string} instanceId - Unique instance identifier.
 */

/** @typedef {CoraliteSlotContextBase & Object.<string, any>} CoraliteSlotContext */

/**
 * @callback CoraliteModuleSlotFunction
 * @param {CoraliteAnyNode[] | any[]} slotNodes - The original slot content nodes.
 * @param {CoraliteSlotContext} context - Component slot context.
 * @param {Object} [legacyState] - @deprecated Accessing state directly via the second argument `(nodes, state)` is deprecated. Destructure `{ state }` from context or use `context.state`.
 * @returns {CoraliteAnyNode[] | CoraliteAnyNode | any[] | any | string | null | void | Promise<any>}
 */

const _moduleExports = {}
export default _moduleExports
