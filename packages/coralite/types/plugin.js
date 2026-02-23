
/**
 * @import { CoraliteResult, CoraliteDocument, ParseHTMLResult, IgnoreByAttribute } from './document.js'
 * @import { HTMLData, CoraliteFilePath } from './core.js'
 * @import { CoraliteModule } from './module.js'
 * @import { CoraliteElement, CoraliteAnyNode } from './dom.js'
 * @import { CoraliteCollectionItem } from './collection.js'
 * @import { ScriptPlugin } from './script.js'
 * @import { Coralite } from '#lib'
 */

/**
 * @typedef {Object} CoralitePluginContext
 * @property {Object.<string, string|string[]|CoraliteAnyNode[]>} values - Key-value pairs of data relevant to plugin execution
 * @property {CoraliteDocument} document - The HTML file data being processed by the plugin
 * @property {CoraliteModule} module - The module context the plugin is operating within (contains template/script)
 * @property {CoraliteElement} element - The specific HTML element the plugin is applied to (if applicable)
 * @property {Object} path - File path information for the current document/module being processed
 * @property {IgnoreByAttribute[]} excludeByAttribute - List of attribute name-value pairs to ignore during processing by element type
 * @property {string} id - Unique identifier for the value context.
 */

/**
 * @template T
 * @this {ThisType<Coralite>}
 * @callback CoralitePluginModule
 * @param {T} options - Configuration options passed to the plugin
 * @param {CoralitePluginContext} context - Runtime context providing access to values, document data, module info, and path details
 */

/**
 * @this {ThisType<Coralite>}
 * @callback CoralitePluginPageSetCallback
 * @description Async callback triggered when a page is created. Called with elements, values, and data.
 * @param {Object} param
 * @param {ParseHTMLResult} param.elements - Parsed HTML elements from the page
 * @param {CoraliteFilePath & Object.<string, any>} param.values - Values associated with the page path
 * @param {CoraliteCollectionItem} param.data - Data item representing the newly created page
 * @async
 */

/**
 * @this {ThisType<Coralite>}
 * @callback CoralitePluginPageUpdateCallback
 * @description Async callback triggered when a page is updated. Called with elements, new and old values.
 * @param {Object} param
 * @param {CoraliteElement[]} param.elements - Updated HTML elements from the page
 * @param {CoraliteCollectionItem} param.newValue - The updated data item
 * @param {CoraliteCollectionItem} param.oldValue - The previous data item before update
 * @async
 */

/**
 * @this {ThisType<Coralite>}
 * @callback CoralitePluginPageDeleteCallback
 * @description Async callback triggered when a page is deleted. Called with the deleted data.
 * @param {CoraliteCollectionItem} value - The data item being deleted
 * @async
 */

/**
 * @this {ThisType<Coralite>}
 * @callback CoralitePluginTemplateCallback
 * @description Async callback triggered for template-related events (set, update, delete).
 * @param {CoraliteModule} template - The template module that was set, updated, or deleted
 * @async
 */

/**
 * @this {ThisType<Coralite>}
 * @callback CoralitePluginAfterPageRenderCallback
 * @description Async callback triggered after a page has been rendered but before saving.
 * @param {CoraliteResult} result - The rendered page result
 * @returns {Promise<CoraliteResult[]|CoraliteResult|void>} New result(s) to add to the build output
 * @async
 */

/**
 * @this {ThisType<Coralite>}
 * @callback CoralitePluginBuildCompleteCallback
 * @description Async callback triggered when a build process completes (success or failure).
 * @param {Object} context
 * @param {CoraliteResult[]} context.results - The results of the build (pages generated)
 * @param {Error|null} context.error - The error if the build failed
 * @param {number} context.duration - The duration of the build in milliseconds
 * @returns {Promise<void>}
 * @async
 */

/**
 * @template T
 * @typedef {Object} CoralitePlugin
 * @property {string} name - Unique identifier/name of the plugin
 * @property {CoralitePluginModule<T>} [method] - Execution function that processes content using plugin logic
 * @property {HTMLData[]} [templates] - Array of loaded template data
 * @property {ScriptPlugin} [script] - Script plugin configuration
 * @property {CoralitePluginPageSetCallback} [onPageSet] - Async callback triggered when a page is created
 * @property {CoralitePluginPageUpdateCallback} [onPageUpdate] - Async callback triggered when a page is updated
 * @property {CoralitePluginPageDeleteCallback} [onPageDelete] - Async callback triggered when a page is deleted
 * @property {CoralitePluginTemplateCallback} [onTemplateSet] - Async callback triggered when a template is created
 * @property {CoralitePluginTemplateCallback} [onTemplateUpdate] - Async callback triggered when a template is updated
 * @property {CoralitePluginTemplateCallback} [onTemplateDelete] - Async callback triggered when a template is deleted
 * @property {CoralitePluginAfterPageRenderCallback} [onAfterPageRender] - Async callback triggered after page render
 * @property {CoralitePluginBuildCompleteCallback} [onBuildComplete] - Async callback triggered when a build completes
 * @property {Function} [server] - Server extension hook
 */

/**
 * @template T
 * @typedef {Object} CoralitePluginResult
 * @property {string} name - Unique identifier/name of the plugin
 * @property {CoralitePluginModule<T>} [method] - Execution function that processes content using plugin logic
 * @property {HTMLData[]} [templates] - Array of loaded template data
 * @property {Object} [metadata] - Plugin metadata
 * @property {Object} [script] - Script plugin configuration
 * @property {CoralitePluginPageSetCallback} [onPageSet] - Async callback triggered when a page is created
 * @property {CoralitePluginPageUpdateCallback} [onPageUpdate] - Async callback triggered when a page is updated
 * @property {CoralitePluginPageDeleteCallback} [onPageDelete] - Async callback triggered when a page is deleted
 * @property {CoralitePluginTemplateCallback} [onTemplateSet] - Async callback triggered when a template is created
 * @property {CoralitePluginTemplateCallback} [onTemplateUpdate] - Async callback triggered when a template is updated
 * @property {CoralitePluginTemplateCallback} [onTemplateDelete] - Async callback triggered when a template is deleted
 * @property {CoralitePluginAfterPageRenderCallback} [onAfterPageRender] - Async callback triggered after page render
 * @property {CoralitePluginBuildCompleteCallback} [onBuildComplete] - Async callback triggered when a build completes
 * @property {Function} [server] - Server extension hook
 */

/**
 * @typedef {Object} CoralitePluginInstance
 * @property {string} name - Unique identifier/name of the plugin
 * @property {Function} [method] - Execution function that processes content using plugin logic
 * @property {HTMLData[]} [templates=[]] - List of custom templates to be included in the coralite instance
 * @property {ScriptPlugin} [script] - Script plugin configuration for extending script functionality
 * @property {CoralitePluginPageSetCallback} [onPageSet] - Async callback triggered when a page is created
 * @property {CoralitePluginPageUpdateCallback} [onPageUpdate] - Async callback triggered when a page is updated
 * @property {CoralitePluginPageDeleteCallback} [onPageDelete] - Async callback triggered when a page is deleted
 * @property {CoralitePluginTemplateCallback} [onTemplateSet] - Async callback triggered when a template is created
 * @property {CoralitePluginTemplateCallback} [onTemplateUpdate] - Async callback triggered when a template is updated
 * @property {CoralitePluginTemplateCallback} [onTemplateDelete] - Async callback triggered when a template is deleted
 * @property {CoralitePluginAfterPageRenderCallback} [onAfterPageRender] - Async callback triggered after page render
 * @property {CoralitePluginBuildCompleteCallback} [onBuildComplete] - Async callback triggered when a build completes
 * @property {Function} [server] - Server extension hook
 */

export default {}
