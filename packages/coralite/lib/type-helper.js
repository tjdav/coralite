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
 * @param {any} obj - The object to check.
 * @returns {obj is CoraliteElement} True if the object is a CoraliteElement, false otherwise.
 */
function isCoraliteElement (obj) {
  return isObject(obj) && obj.type === 'tag'
}

/**
 * Checks if an object is a CoraliteTextNode.
 * @param {any} obj - The object to check.
 * @returns {obj is CoraliteTextNode} True if the object is a CoraliteTextNode, false otherwise.
 */
function isCoraliteTextNode (obj) {
  return isObject(obj) && obj.type === 'text'
}

/**
 * Checks if an object is a CoraliteComment.
 * @param {any} obj - The object to check.
 * @returns {obj is CoraliteComment} True if the object is a CoraliteComment, false otherwise.
 */
function isCoraliteComment (obj) {
  return isObject(obj) && obj.type === 'comment'
}

/**
 * Checks if an object is a CoraliteDirective.
 * @param {any} obj - The object to check.
 * @returns {obj is CoraliteDirective} True if the object is a CoraliteDirective, false otherwise.
 */
function isCoraliteDirective (obj) {
  return isObject(obj) && obj.type === 'directive'
}

/**
 * Checks if an object is a CoraliteDocumentRoot.
 * @param {any} obj - The object to check.
 * @returns {obj is CoraliteDocumentRoot} True if the object is a CoraliteDocumentRoot, false otherwise.
 */
function isCoraliteDocumentRoot (obj) {
  return isObject(obj) && obj.type === 'root'
}
}

export {
  isCoralitePageItem,
  isCoraliteElement,
  isCoraliteTextNode,
  isCoraliteComment
}
