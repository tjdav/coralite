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

/**
 * Checks if an object is a CoraliteSlotElement.
 * @param {any} obj - The object to check.
 * @returns {obj is CoraliteSlotElement} True if the object is a CoraliteSlotElement, false otherwise.
 */
function isCoraliteSlotElement (obj) {
  return isObject(obj) &&
         typeof obj.name === 'string' &&
         isCoraliteElement(obj.element) &&
         (obj.customElement === undefined || isCoraliteElement(obj.customElement))
}

/**
 * Determines whether the given object is a CoraliteCollectionItem.
 * @param {any} obj - The object to check.
 * @returns {obj is CoraliteCollectionItem} True if the object is a CoraliteCollectionItem, false otherwise.
 */
function isCoraliteCollectionItem (obj) {
  return isObject(obj) &&
         'path' in obj &&
         isObject(obj.path) &&
         typeof obj.content === 'string'
}

/**
 * Checks if an object is any Coralite node type (Element, TextNode, Comment, Directive, or DocumentRoot).
 * @param {any} obj - The object to check.
 * @returns {obj is CoraliteAnyNode | CoraliteDirective | CoraliteDocumentRoot} True if the object is any Coralite node type.
 */
function isCoraliteNode (obj) {
  return isCoraliteElement(obj) ||
         isCoraliteTextNode(obj) ||
         isCoraliteComment(obj) ||
         isCoraliteDirective(obj) ||
         isCoraliteDocumentRoot(obj)
}

/**
 * Checks if an object has a valid CoraliteElement structure with required properties.
 * @param {any} obj - The object to check.
 * @returns {boolean} True if the object has valid CoraliteElement structure.
 */
function hasValidElementStructure (obj) {
  return isCoraliteElement(obj) &&
         typeof obj.name === 'string' &&
         isObject(obj.attribs) &&
         Array.isArray(obj.children)
}

/**
 * Checks if an object has a valid CoraliteTextNode structure with required properties.
 * @param {any} obj - The object to check.
 * @returns {boolean} True if the object has valid CoraliteTextNode structure.
 */
function hasValidTextNodeStructure (obj) {
  return isCoraliteTextNode(obj) &&
         typeof obj.data === 'string'
}

/**
 * Checks if an object has a valid CoraliteComment structure with required properties.
 * @param {any} obj - The object to check.
 * @returns {boolean} True if the object has valid CoraliteComment structure.
 */
function hasValidCommentStructure (obj) {
  return isCoraliteComment(obj) &&
         typeof obj.data === 'string'
}

}

export {
  isCoralitePageItem,
  isCoraliteElement,
  isCoraliteTextNode,
  isCoraliteComment
}
