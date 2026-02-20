/**
 * @import { CoraliteResult, HTMLData, CoraliteModuleValue, CoraliteAnyNode, CoraliteDocument, CoraliteModule, CoraliteElement, CoraliteFilePath, CoraliteDocumentRoot } from './index.js'
 */

/**
 * @typedef {Object} IgnoreByAttribute
 * @property {string} name - Name of attribute
 * @property {string} value - Value of attribute
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
 */

/**
 * @typedef {Object} ParseHTMLResult
 * @property {CoraliteDocumentRoot} root - The root element of the parsed HTML document.
 * @property {CoraliteElement[]} customElements - An array of custom elements identified during parsing.
 * @property {CoraliteElement[]} tempElements - An array of temporary elements created during the parsing process.
 */

/**
 * @typedef {Object} CoraliteConfig
 * @property {string} output - The path to the output directory where built files will be placed.
 * @property {string} templates - The path to the directory containing Coralite templates.
 * @property {string} pages - The path to the directory containing pages that will be rendered using the provided templates.
 * @property {CoralitePluginInstance[]} [plugins] - Optional array of plugin instances to extend Coralite functionality.
 */

/**
 * @typedef {Object} CoraliteScriptContent
 * @property {string} id - Unique instance identifier
 * @property {string} [templateId] - Template identifier for shared functions
 * @property {CoraliteDocument} document - Coralite document with metadata and rendering structure.
 * @property {Object.<string, CoraliteModuleValue>} [values] - Instance values
 * @property {Object} refs - Array of reference identifiers.
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


/**
 * @typedef {Object} ScriptPlugin
 * @property {function(any): void} [setup] - Called when plugin is registered
 * @property {Object.<string, function>} [helpers] - Global or instance helpers to add to scripts
 * @property {Object.<'register'|'beforeExecute'|'afterExecute'|'onScriptCompile', function>} [lifecycle] - Lifecycle hooks
 * @property {function(string, Object): string} [transform] - Transform script content
 */

/**
 * @typedef {Object} InstanceContext
 * @property {string} instanceId - Unique instance identifier
 * @property {string} templateId - Template identifier
 * @property {Object.<string, CoraliteModuleValue>} values - Instance values
 * @property {Object.<string, string>} refs - Instance refs
 * @property {CoraliteDocument} [document] - Document context
 */

export default {}
