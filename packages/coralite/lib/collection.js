import path from 'node:path'
import { getHtmlFile } from './html.js'
import { access } from 'node:fs/promises'
import { existsSync } from 'node:fs'

/**
 * @import {
 *  CoraliteCollectionEventDelete,
 *  CoraliteCollectionEventSet,
 *  CoraliteCollectionEventUpdate,
 *  CoraliteCollectionItem,
 *  HTMLData } from '../types/index.js'
 */

/**
 * Represents a collection of documents with methods to organize and retrieve them.
 * Maintains three views: flat list, path-based grouping, and ID lookup.
 * @constructor
 * @param {Object} [options={}]
 * @param {string} [options.rootDir=''] - The root directory path for the collection
 * @param {CoraliteCollectionEventSet} [options.onSet] - Event handler for when documents are set
 * @param {CoraliteCollectionEventUpdate} [options.onUpdate] - Event handler for when documents are updated
 * @param {CoraliteCollectionEventDelete} [options.onDelete] - Event handler for when documents are deleted
 */
function CoraliteCollection (options = { rootDir: '' }) {
  /**
   * Root directory where collection items are located
   */
  this.rootDir = path.join(options.rootDir)

  if (!existsSync(this.rootDir)) {
    throw new Error('Root directory was not found: ' + this.rootDir)
  }

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
 * @param {HTMLData|string} value - The HTMLData object to be added or updated.
 * @returns {Promise<CoraliteCollectionItem>} The modified document
 */
CoraliteCollection.prototype.setItem = async function (value) {
  if (typeof value === 'string') {
    value = await this._loadByPath(value)
  }

  if (!value || !value.path) {
    throw new Error('Valid HTMLData object must be provided')
  }

  const pathname = value.path.pathname
  const dirname = value.path.dirname
  const originalValue = this.collection[pathname]
  /** @type {CoraliteCollectionItem} */
  const documentValue = value

  if (!originalValue) {
    // handle pre-set hook if defined
    if (typeof this._onSet === 'function') {
      const result = await this._onSet(value)

      // abort adding item
      if (!result) {
        return
      }

      documentValue.result = result.value

      if (result.type === 'page' || result.type === 'template') {
        documentValue.type = result.type
      }

      // update collection using ID from hook result if available
      if (typeof result.id === 'string' && result.id) {
        this.collection[result.id] = documentValue
      }
    }

    // always update the collection with current pathname
    this.collection[pathname] = documentValue

    // initialize directory list if it doesn't exist
    if (!this.listByPath[dirname]) {
      this.listByPath[dirname] = []
    }

    // add to both directory-specific and general lists
    // check if already added to avoid duplicates
    if (!this.listByPath[dirname].includes(documentValue)) {
      this.listByPath[dirname].push(documentValue)
    }
    if (!this.list.includes(documentValue)) {
      this.list.push(documentValue)
    }
  } else {
    return await this.updateItem(value)
  }

  return documentValue
}

/**
 * Removes an HTMLData object from the collection and associated lists.
 * Accepts either an HTMLData object or a pathname string.
 * @param {HTMLData | string} value - The HTMLData object or a pathname to be removed.
 * @throws {Error} If invalid input is provided
 */
CoraliteCollection.prototype.deleteItem = async function (value) {
  if (!value) {
    throw new Error('Valid pathname must be provided')
  }

  let pathname
  let dirname
  let valuesByPath
  let originalValue

  if (typeof value !== 'string' && value.path) {
    // if the input is an HTMLData object, extract its pathname and directory name
    pathname = value.path.pathname
    dirname = value.path.dirname
    valuesByPath = this.listByPath[dirname]
    originalValue = value
  } else if (typeof value === 'string') {
    // if the input is a string, use it as the pathname and determine the directory name
    pathname = value
    dirname = path.dirname(pathname)
    valuesByPath = this.listByPath[dirname]
    originalValue = this.collection[pathname]
  } else {
    throw new Error('Valid pathname must be provided')
  }

  if (!originalValue) {
    // item not found, nothing to delete
    return
  }

  if (!valuesByPath) {
    // directory list doesn't exist, but we still need to clean up collection
    // This can happen if the item was stored under a different ID
    for (const key in this.collection) {
      if (this.collection[key] === originalValue) {
        delete this.collection[key]
      }
    }
    return
  }

  if (typeof this._onDelete === 'function') {
    await this._onDelete(originalValue)
  }

  // remove the document from the collection
  // also check if it's stored under a different ID (from hook result)
  for (const key in this.collection) {
    if (this.collection[key] === originalValue) {
      delete this.collection[key]
    }
  }

  // find and remove the document from the list and by-path grouping
  const listIndex = this.list.indexOf(originalValue)
  const pathIndex = valuesByPath.indexOf(originalValue)

  if (listIndex !== -1) {
    this.list.splice(listIndex, 1)
  }
  if (pathIndex !== -1) {
    valuesByPath.splice(pathIndex, 1)
  }

  // clean up empty directory arrays
  if (valuesByPath.length === 0) {
    delete this.listByPath[dirname]
  }
}

/**
 * Updates an existing HTMLData object in the collection.
 * If the document does not exist, it will be added using the set method.
 * @param {CoraliteCollectionItem|string} value - The HTMLData object to be updated or added.
 * @throws {Error} If invalid input is provided
 */
CoraliteCollection.prototype.updateItem = async function (value) {
  if (typeof value === 'string') {
    value = await this._loadByPath(value)
  }

  if (!value || !value.path) {
    throw new Error('Valid HTMLData object must be provided')
  }

  const pathname = value.path.pathname
  const originalValue = this.collection[pathname]

  if (!originalValue) {
    // if the document does not exist, add it using the set method
    return await this.setItem(value)
  }

  if (typeof this._onUpdate === 'function') {
    const result = await this._onUpdate(value, originalValue)

    // abort update
    if (!result) {
      return originalValue
    }

    // handle callback result
    if (result && typeof result === 'object') {
      // if result has a value property, use it
      if (result.value !== undefined) {
        originalValue.result = result.value
      } else {
        originalValue.result = result
      }

      // update type if provided
      if (result.type === 'page' || result.type === 'template') {
        originalValue.type = result.type
      }
    } else {
      originalValue.result = result
    }
  }

  // update core properties
  if (value.content !== undefined) {
    originalValue.content = value.content
  }

  // update path information if it changed
  if (value.path && value.path !== originalValue.path) {
    originalValue.path = value.path
  }

  // update type if explicitly set
  if (value.type) {
    originalValue.type = value.type
  }

  // update any additional properties from value
  if (value.values !== undefined) {
    originalValue.values = value.values
  }

  return originalValue
}

/**
 * Retrieves an item by its unique identifier
 * @param {string} id - Unique identifier of the item
 * @returns {CoraliteCollectionItem | undefined} The found item or undefined
 */
CoraliteCollection.prototype.getItem = function (id) {
  if (!this.collection[id] && id.endsWith('html')) {
    id = path.join(this.rootDir, id)
  }

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

/**
 * Loads a collection item by its file path.
 *
 * @param {string} filepath - The path to the collection item file
 * @returns {Promise<HTMLData>} A promise that resolves to the loaded item object
 * @throws {Error} If the file cannot be found at either the provided path or within the root directory
 */
CoraliteCollection.prototype._loadByPath = async function (filepath) {
  try {
    await access(filepath)
  } catch {
    try {
      filepath = path.join(this.rootDir, filepath)

      await access(filepath)
    } catch {
      throw new Error('Could not find collection item: ' + filepath)
    }
  }

  const content = await getHtmlFile(filepath)

  return {
    type: 'page',
    content,
    path: {
      pathname: filepath,
      dirname: path.dirname(filepath),
      filename: path.basename(filepath)
    }
  }
}

export default CoraliteCollection
