
/**
 * @import { HTMLData } from './core.js'
 */

/**
 * @typedef {Object} CoraliteCollectionCallbackResult
 * @property {'page'|'component'} [type] - Document type
 * @property {*} [result] - Result value returned from event handlers
 */

/**
 * A component object with both HTMLData state and result handling capabilities
 * @typedef {(CoraliteCollectionCallbackResult & HTMLData)} CoraliteCollectionItem
 */

/**
 * @typedef {Object} CoraliteCollectionEventResult
 * @property {*} value - The processed value
 * @property {'page'|'component'} [type] - Document type
 * @property {string} [id] - Optional identifier for the item
 * @property {*} [state] - Optional state to associate with the item
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

/**
 * @typedef {Object} CoraliteCollection
 * @property {string} rootDir - Root directory where collection items are located
 * @property {CoraliteCollectionItem[]} list - An array of HTMLData objects representing the list of documents.
 * @property {Object.<string, CoraliteCollectionItem[]>} listByPath - An object mapping paths to arrays of HTMLData objects.
 * @property {Object.<string, CoraliteCollectionItem>} collection - An object mapping unique identifiers to HTMLData objects.
 * @property {(value: HTMLData|string) => Promise<CoraliteCollectionItem>} setItem - Adds or updates an HTMLData object in the collection.
 * @property {(value: CoraliteCollectionItem|string) => Promise<void>} deleteItem - Deletes an item from the collection.
 * @property {(value: HTMLData|string) => Promise<CoraliteCollectionItem>} updateItem - Updates an existing item in the collection.
 * @property {(id: string) => CoraliteCollectionItem | undefined} getItem - Retrieves an item by its ID.
 * @property {(dirname: string) => CoraliteCollectionItem[] | undefined} getListByPath - Retrieves a list of items grouped by directory path.
 */

export default {}
