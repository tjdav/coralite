import path from 'node:path'

/**
 * @import { CoraliteDocumentCollectionItem, CoraliteDocumentSetCallback, HTMLData } from '#types'
 */

/**
 * Represents a collection of documents with methods to organize and retrieve them.
 * @constructor
 * @param {CoraliteDocumentSetCallback} [callback]
 */
function CoraliteDocuments (callback) {
  /**
   * An array of HTMLData objects representing the list of documents.
   * @type {CoraliteDocumentCollectionItem[]}
   */
  this.list = []

  /**
   * An object mapping paths to arrays of HTMLData objects.
   * Used for grouping documents by their file path.
   * @type {Object.<string, CoraliteDocumentCollectionItem[]>}
   */
  this.listByPath = {}

  /**
   * An object mapping unique identifiers to HTMLData objects.
   * Used for quick lookup of documents by their identifier.
   * @type {Object.<string, CoraliteDocumentCollectionItem>}
   */
  this.collection = {}

  /** @type {CoraliteDocumentSetCallback | undefined} */
  this.setItemCallback = callback
}

/**
 * Adds or updates an HTMLData object in the collection and associated lists.
 * @param {HTMLData} value - The HTMLData object to be added or updated.
 */
CoraliteDocuments.prototype.setItem = function (value) {
  const pathname = value.path.pathname
  const dirname = value.path.dirname
  const originalValue = this.collection[pathname]
  /** @type {CoraliteDocumentCollectionItem} */
  const documentValue = value

  if (typeof this.setItemCallback === 'function') {
    const result = this.setItemCallback(value)

    documentValue.result = result.value

    if (typeof result.id === 'string' && result.id) {
      this.collection[result.id] = documentValue
    }
  }

  // set collection value
  this.collection[pathname] = documentValue

  if (!originalValue) {
    if (!this.listByPath[dirname]) {
      this.listByPath[dirname] = []
    }

    this.listByPath[dirname].push(documentValue)
    this.list.push(documentValue)
  } else {
    const pathIndex = this.listByPath[dirname].indexOf(originalValue)
    const listIndex = this.list.indexOf(originalValue)

    this.list[listIndex] = documentValue
    this.listByPath[dirname][pathIndex] = documentValue
  }

  return documentValue
}

/**
 * Removes an HTMLData object from the collection and associated lists.
 * @param {HTMLData | string} value - The HTMLData object or a pathname to be removed.
 */
CoraliteDocuments.prototype.deleteItem = function (value) {
  let pathname = value
  let dirname = ''
  let valuesByPath

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
 * @param {HTMLData} value - The HTMLData object to be updated or added.
 */
CoraliteDocuments.prototype.updateItem = function (value) {
  if (value && value.path) {
    const originalValue = this.collection[value.path.pathname]

    if (!originalValue) {
      // If the document does not exist, add it using the set method
      this.setItem(value)
    } else {
      // If the document exists, update its content
      originalValue.content = value.content
    }
  } else {
    throw new Error('Unexpected type')
  }
}

/**
 * @param {string} id
 */
CoraliteDocuments.prototype.getItem = function (id) {
  return this.collection[id]
}

/**
 * @param {string} dirname
 */
CoraliteDocuments.prototype.getListByPath = function (dirname) {
  const list = this.listByPath[dirname]

  if (list) {
    return list.slice()
  }

  throw new Error('No list exists by the pathname: "' + dirname + '"')
}

export default CoraliteDocuments
