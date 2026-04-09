
/**
 * @import { CoraliteElement, CoraliteAnyNode, CoraliteDirective } from './dom.js'
 * @import { CoraliteFilePath, CoraliteValues } from './core.js'
 * @import { CoraliteComponentValues, CoraliteRef } from './component.js'
 * @import { ScriptContent, CoraliteScriptContent } from './script.js'
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
 */

/**
 * Represents a single value that a module can store or process.
 * @typedef {string | string[] | (CoraliteDirective | CoraliteAnyNode)[] | Object.<string, string>} CoraliteModuleValue
 */

/**
 * A collection of module values associated with a module.
 * @typedef {Object.<string, CoraliteModuleValue> & { __script__?: ScriptContent }} CoraliteModuleValues
 */

/**
 * Defines a slot element and its configuration within a module.
 * @typedef {Object} CoraliteModuleSlotElement
 * @property {string} name - Slot element identifier
 * @property {CoraliteElement} element - Corresponding HTML element for the slot
 */

/**
 * @callback CoraliteModuleScript
 * @param {CoraliteScriptContent} context - The module's script context
 */

/**
 * @callback CoraliteModuleSetup
 * @param {CoraliteModuleValues} context
 * @returns {any}
 */

/**
 * @callback CoraliteModuleSlotFunction
 * @param {CoraliteAnyNode[]} slotNodes - The parsed HTML nodes for the slot content
 * @param {CoraliteModuleValues} values - The current component values
 * @returns {CoraliteAnyNode[] | string | void} - The processed nodes, an HTML string, or void to use original content
 */

/**
 * @callback CoraliteModuleTokenFunction
 * @param {CoraliteModuleValues} values - The current component values
 * @returns {any | Promise<any>} - The computed value for the token
 */

export default {}
