/**
 * @import { CoraliteCollectionItem, CoraliteComment, CoraliteDirective, CoraliteDocumentRoot, CoraliteElement, CoraliteTextNode, CoraliteAnyNode, CoraliteSlotElement } from '../types/index.js'
 */

/**
 * Check if value is a non-null object
 * @param {any} obj - The value to check
 * @returns {boolean} True if the value is a non-null object
 */
function isObject (obj) {
  return typeof obj === 'object' && obj !== null
}

/**
 * Checks if an object is a CoraliteElement.
 * @param {Object} obj - The object to check.
 * @returns {boolean} True if the object is a CoraliteElement, false otherwise.
 */
function isCoraliteElement (obj) {
  return isObject(obj) && obj.type === 'tag'
}

/**
* Checks if an object is a CoraliteTextNode.
* @param {Object} obj - The object to check.
* @returns {boolean} True if the object is a CoraliteTextNode, false otherwise.
*/
function isCoraliteTextNode (obj) {
  return isObject(obj) && obj.type === 'text'
}

/**
* Checks if an object is a CoraliteComment.
* @param {Object} obj - The object to check.
* @returns {boolean} True if the object is a CoraliteComment, false otherwise.
*/
function isCoraliteComment (obj) {
  return isObject(obj) && obj.type === 'comment'
}

/**
 * Determines whether the given object is a CoralitePageItem.
 * @param {Object} obj - The object to check.
 * @returns {boolean} True if the object is a CoralitePageItem, false otherwise.
 */
function isCoralitePageItem (obj) {
  return isObject(obj) && obj.hasOwnProperty('path') && typeof obj.content === 'string'
}

export {
  isCoralitePageItem,
  isCoraliteElement,
  isCoraliteTextNode,
  isCoraliteComment
}
