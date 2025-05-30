import path from 'node:path'

/**
 * @import {
 *  CoraliteCollectionEventDelete,
 *  CoraliteCollectionEventSet,
 *  CoraliteCollectionEventUpdate,
 *  CoraliteCollectionItem,
 *  HTMLData } from '#types'
 */

/**
 * Represents a collection of documents with methods to organize and retrieve them.
 * Maintains three views: flat list, path-based grouping, and ID lookup.
 * @constructor
 * @param {Object} [options={}]
 * @param {CoraliteCollectionEventSet} [options.onSet]
 * @param {CoraliteCollectionEventUpdate} [options.onUpdate]
 * @param {CoraliteCollectionEventDelete} [options.onDelete]
 */
function CoraliteCollection (options = {}) {
  /**
   * An array of HTMLData objects representing the list of documents.
   * @type {CoraliteCollectionItem[]}
   */
  this.list = []

  /**
   * An object mapping paths to arrays of HTMLData objects.
   * Used for grouping documents by their file path.
   * @type {Object.<string, CoraliteCollectionItem[]>}
   */
  this.listByPath = {}

  /**
   * An object mapping unique identifiers to HTMLData objects.
   * Used for quick lookup of documents by their identifier.
   * @type {Object.<string, CoraliteCollectionItem>}
   */
  this.collection = {}

  /**
   * Callback triggered when setting a new item
   * @type {CoraliteCollectionEventSet | undefined}
   */
  this._onSet = options.onSet

  /**
   * Callback triggered when updating an existing item
   * @type {CoraliteCollectionEventUpdate | undefined}
   */
  this._onUpdate = options.onUpdate

  /**
   * Callback triggered when deleting an item
   * @type {CoraliteCollectionEventDelete | undefined}
   */
  this._onDelete = options.onDelete
}

/**
 * Adds or updates an HTMLData object in the collection and associated lists.
 * If the item already exists, it will be updated in all views.
 * @param {HTMLData} value - The HTMLData object to be added or updated.
 * @returns {CoraliteCollectionItem} The modified document
 */
CoraliteCollection.prototype.setItem = function (value) {
  const pathname = value.path.pathname
  const dirname = value.path.dirname
  const originalValue = this.collection[pathname]
  /** @type {CoraliteCollectionItem} */
  const documentValue = value

  if (!originalValue) {
    // Handle pre-set hook if defined
    if (typeof this._onSet === 'function') {
      const result = this._onSet(value)

      documentValue.result = result.value

      if (result.type === 'page' || result.type === 'template') {
        documentValue.type = result.type
      }

      // Update collection using ID from hook result if available
      if (typeof result.id === 'string' && result.id) {
        this.collection[result.id] = documentValue
      }
    }

    // Always update the collection with current pathname
    this.collection[pathname] = documentValue

    // Initialize directory list if it doesn't exist
    if (!this.listByPath[dirname]) {
      this.listByPath[dirname] = []
    }

    // Add to both directory-specific and general lists
    this.listByPath[dirname].push(documentValue)
    this.list.push(documentValue)
  } else {
    this.updateItem(value)
  }

  return documentValue
}

/**
 * Removes an HTMLData object from the collection and associated lists.
 * Accepts either an HTMLData object or a pathname string.
 * @param {HTMLData | string} value - The HTMLData object or a pathname to be removed.
 * @throws {Error} If invalid input is provided
 */
CoraliteCollection.prototype.deleteItem = function (value) {
  let pathname = value
  let dirname = ''
  let valuesByPath

  if (typeof this._onDelete === 'function') {
    this._onDelete(value)
  }

  if (typeof value !== 'string' && value.path) {
    // If the input is an HTMLData object, extract its pathname and directory name
    pathname = value.path.pathname
    dirname = value.path.dirname
    valuesByPath = this.listByPath[dirname]
  } else if (pathname && typeof pathname == 'string') {
    // If the input is a string, use it as the pathname and determine the directory name
    dirname = path.dirname(pathname)
    valuesByPath = this.listByPath[dirname]
  } else {
    throw new Error('Valid pathname must be provided')
  }

  if (!valuesByPath) {
    throw new Error('Valid dirname must be provided: "' + dirname + '"')
  }

  const originalValue = this.collection[pathname]

  if (originalValue) {
    // Remove the document from the collection
    delete this.collection[pathname]

    // Find and remove the document from the list and by-path grouping
    const listIndex = this.list.indexOf(originalValue)
    const pathIndex = valuesByPath.indexOf(originalValue)

    this.list.splice(listIndex, 1)
    valuesByPath.splice(pathIndex, 1)
  }
}

/**
 * Updates an existing HTMLData object in the collection.
 * If the document does not exist, it will be added using the set method.
 * @param {CoraliteCollectionItem} value - The HTMLData object to be updated or added.
 * @throws {Error} If invalid input is provided
 */
CoraliteCollection.prototype.updateItem = function (value) {
  if (value && value.path) {
    const originalValue = this.collection[value.path.pathname]

    if (!originalValue) {
      // If the document does not exist, add it using the set method
      this.setItem(value)
    } else {
      if (typeof this._onUpdate === 'function') {
        value.result = this._onUpdate(value, originalValue)
      }

      // update content
      originalValue.content = value.content
      originalValue.result = value.result
    }
  } else {
    throw new Error('Unexpected type')
  }
}

/**
 * Retrieves an item by its unique identifier
 * @param {string} id - Unique identifier of the item
 * @returns {CoraliteCollectionItem | undefined} The found item or undefined
 */
CoraliteCollection.prototype.getItem = function (id) {
  return this.collection[id]
}

/**
 * Retrieves a list of items grouped by directory path
 * @param {string} dirname - Directory name to look up
 * @returns {CoraliteCollectionItem[] | undefined} A copy of the item list or undefined
 */
CoraliteCollection.prototype.getListByPath = function (dirname) {
  const list = this.listByPath[dirname]

  if (list) {
    return list.slice()
  }
}

export default CoraliteCollection
