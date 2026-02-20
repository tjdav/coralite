
/**
 * @import { HTMLData } from './core.js'
 */

/**
 * @typedef {Object} CoraliteCollectionCallbackResult
 * @property {'page'|'template'} [type] - Document type
 * @property {*} [result] - Result value returned from event handlers
 */

/**
 * A document object with both HTMLData properties and result handling capabilities
 * @typedef {(CoraliteCollectionCallbackResult & HTMLData)} CoraliteCollectionItem
 */

/**
 * @typedef {Object} CoraliteCollectionEventResult
 * @property {*} value - The processed value
 * @property {'page'|'template'} [type] - Document type
 * @property {string} [id] - Optional identifier for the item
 */

/**
 * @callback CoraliteCollectionEventSet
 * @param {CoraliteCollectionItem} value - Item to be set
 * @returns {Promise<CoraliteCollectionEventResult>} Returns a result object with processed value and optional ID
 * @async
 */

/**
 * @callback CoraliteCollectionEventDelete
 * @param {CoraliteCollectionItem} value - Item or pathname to delete
 * @async
 */

/**
 * @callback CoraliteCollectionEventUpdate
 * @param {CoraliteCollectionItem} newValue - New item value
 * @param {CoraliteCollectionItem} oldValue - Original item value
 * @async
 */

export default {}
