
/**
 * @import { CoraliteElement, CoraliteAnyNode, CoraliteDirective } from './dom.js'
 * @import { CoraliteFilePath, CoraliteValues } from './core.js'
 * @import { CoraliteDocumentValues, CoraliteRef } from './document.js'
 * @import { ScriptContent } from './script.js'
 */

/**
 * A module within the Coralite library, containing metadata and rendering logic.
 * @typedef {Object} CoraliteModule
 * @property {string} [id] - Unique module identifier used to reference this module within the application.
 * @property {CoraliteFilePath} [path] - Template paths associated with this module, if any.
 * @property {number} [lineOffset] - Optional offset value for line numbering purposes within the template.
 * @property {CoraliteElement} [template] - Module's rendering template which defines its structure and layout.
 * @property {string|undefined} [script] - Module's JavaScript raw code used for logic or behavior associated with this module.
 * @property {string[]} [styles] - Raw CSS associated with this module.
 * @property {CoraliteDocumentValues} [values] - Values generated from the module's markup, containing metadata or variable information.
 * @property {CoraliteElement[]} [customElements] - Custom elements defined in the module, allowing extension of HTML capabilities.
 * @property {Object.<string, Object.<string,CoraliteModuleSlotElement>>} [slotElements] - Custom slot elements and their configurations, enabling flexible content insertion points within components.
 * @property {boolean} isTemplate - Indicates whether the module is a template
 * @property {Set<string>} [rootClasses] - Root classes relative to template.
 * @property {Set<string>} [descendantClasses] - Descendant classes.
 */

/**
 * Represents a single value that a module can store or process.
 * @typedef {string | string[] | (CoraliteDirective | CoraliteAnyNode)[]} CoraliteModuleValue
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
 * @param {CoraliteValues} values - The module's current values
 * @param {CoraliteRef} refs - References template elements
 */

/**
 * @callback CoraliteModuleSetup
 * @param {CoraliteModuleValues} context
 */

export default {}
