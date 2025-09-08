/**
 * @import {Coralite} from '#lib'
 */

/**
 * Represents HTML file data including path and raw content.
 * @typedef {Object} HTMLData
 * @property {'page'|'template'} [type] - The type of HTML file. 'page' for main pages, 'template' for reusable components.
 * @property {CoraliteModuleValues} [values] - The initial values for the HTML module.
 * @property {CoraliteFilePath} path - The file's path information within the project structure.
 * @property {string} [content] - The raw HTML string contents of the file (optional, may be omitted for templates).
 */

/**
 * Represents a file's path structure within the project.
 * @typedef {Object} CoraliteFilePath
 * @property {string} pathname - Full relative path from the project root to the file.
 * @property {string} dirname - Directory name containing the file.
 * @property {string} filename - The base file name (including extension).
 */

/**
 * Defines root directories for pages and templates in a Coralite project.
 * @typedef {Object} CoralitePath
 * @property {string} pages - The path to the root pages directory
 * @property {string} templates - The path to the root templates directory
 */

/**
 * Configuration options for token handling during processing.
 * @typedef {Object} CoraliteTokenOptions
 * @property {Object.<string, string>} [default] - Default token values for properties not explicitly set
 * @property {Object.<string, string[]>} [aliases] - Token aliases and their possible values
 */

/**
 * A collection of module values associated with a module.
 * @typedef {Object.<string, CoraliteModuleValue>} CoraliteModuleValues
 */

/**
 * Represents a single value that a module can store or process.
 * @typedef {string | string[] | (CoraliteDirective | CoraliteAnyNode)[]} CoraliteModuleValue
 */

/**
 * A module within the Coralite library, containing metadata and rendering logic.
 * @typedef {Object} CoraliteModule
 * @property {string} id - Unique module identifier used to reference this module within the application.
 * @property {CoraliteFilePath} [path] - Template paths associated with this module, if any.
 * @property {number} [lineOffset] - Optional offset value for line numbering purposes within the template.
 * @property {CoraliteElement} template - Module's rendering template which defines its structure and layout.
 * @property {string|undefined} script - Module's JavaScript raw code used for logic or behavior associated with this module.
 * @property {CoraliteDocumentValues} values - Values generated from the module's markup, containing metadata or variable information.
 * @property {CoraliteElement[]} customElements - Custom elements defined in the module, allowing extension of HTML capabilities.
 * @property {Object.<string, Object.<string,CoraliteModuleSlotElement>>} slotElements - Custom slot elements and their configurations, enabling flexible content insertion points within components.
 */

/**
 * Holds tokenized metadata extracted from document attributes, element references and text nodes.
 * @typedef {Object} CoraliteDocumentValues
 * @property {CoraliteRef[]} refs - List of element references
 * @property {CoraliteAttributeToken[]} attributes - List of attribute tokens from the document
 * @property {CoraliteTextNodeToken[]} textNodes - List of text node tokens from the document
 */

/**
 * A representation of a token with name and value.
 * @typedef {Object} CoraliteToken
 * @property {string} name - Token identifier
 * @property {string} content - Token value or content
 */

/**
 * Represents an HTML attribute token linked to its parent element.
 * @typedef {Object} CoraliteAttributeToken
 * @property {string} name - Attribute token identifier
 * @property {CoraliteElement} element - Corresponding HTML element for the attribute
 * @property {CoraliteToken[]} tokens - Array of associated tokens
 */

/**
 * @typedef {Object} CoraliteRef
 * @property {string} name - Ref identifier
 * @property {CoraliteElement} element - Corresponding HTML element for the attribute
 */


/**
 * Represents a text node token with associated metadata.
 * @typedef {Object} CoraliteTextNodeToken
 * @property {CoraliteTextNode} textNode - Text node that contains the token
 * @property {CoraliteToken[]} tokens - Array of associated tokens
 */

/**
 * Defines a slot element and its configuration within a module.
 * @typedef {Object} CoraliteModuleSlotElement
 * @property {string} name - Slot element identifier
 * @property {CoraliteElement} element - Corresponding HTML element for the slot
 */

/**
 * Represents a standard HTML element in the Coralite content tree.
 * @typedef {Object} CoraliteElement
 * @property {'tag'} type - Element type
 * @property {string} name - Tag name
 * @property {Object.<string, string>} attribs - Element attributes
 * @property {CoraliteAnyNode[]} children - Child nodes of the element
 * @property {CoraliteContentNode} parent - Parent element
 * @property {number} [parentChildIndex] - Position in parent's child list
 * @property {Object[]} [slots]
 * @property {boolean} [remove] - Mark element to be removed from stack
 */

/**
 * Represents a text node within the Coralite content tree.
 * @typedef {Object} CoraliteTextNode
 * @property {'text'} type - Text node type
 * @property {string} data - Additional attributes for the text node
 * @property {CoraliteContentNode} parent - Parent element of the text node
 * @property {boolean} [remove] - Mark element to be removed from stack
 */

/**
 * Represents an HTML comment within the Coralite content tree.
 * @typedef {Object} CoraliteComment
 * @property {'comment'} type - Comment type
 * @property {string} data - Additional attributes for the text node
 * @property {CoraliteContentNode} parent - Parent element of the text node
 * @property {boolean} [remove] - Mark element to be removed from stack
 */


/**
 * Union type representing any content node (element, text, or comment).
 * @typedef {CoraliteElement | CoraliteTextNode | CoraliteComment} CoraliteAnyNode
 */

/**
 * Union type representing nodes that can be part of a document's content hierarchy.
 * @typedef {CoraliteElement | CoraliteDocumentRoot} CoraliteContentNode
 */

/**
 * Defines a slot with its associated HTML element and custom component.
 * @typedef {Object} CoraliteSlotElement
 * @property {string} name - Slot's unique identifier
 * @property {CoraliteElement} customElement - Custom component for the slot
 * @property {CoraliteElement} element - Corresponding HTML element for the slot
 */

/**
 * Represents a directive found in HTML content, like a DOCTYPE declaration.
 * @typedef {Object} CoraliteDirective
 * @property {'directive'} type - Node type
 * @property {string} data - Raw HTML Doctype
 * @property {string} name - Doctype name
 * @property {boolean} [remove] - Mark element to be removed from stack
 */

/**
 * Represents the root node of a document containing all content nodes.
 * @typedef {Object} CoraliteDocumentRoot
 * @property {'root'} type - Node type
 * @property {(CoraliteAnyNode | CoraliteDirective)[]} children - Document list
 */

/**
 * Represents a complete Coralite document with metadata and rendering structure.
 * @typedef {Object} CoraliteDocument
 * @property {CoraliteDocumentRoot} root - Array of elements and text nodes in the document
 * @property {CoraliteElement[]} customElements - Custom elements defined in the document
 * @property {CoralitePath & CoraliteFilePath} path - Document's file path
 * @property {IgnoreByAttribute[]} ignoreByAttribute - An array of attribute names and values to ignore by element type.
 */

/**
 * @typedef {Object} CoraliteDocumentResult
 * @property {CoraliteModuleValues} values
 * @property {CoraliteElement[]} tempElements
 */

/**
 * Represents a rendered output document with metadata and statistics.
 * @typedef {Object} CoraliteResult
 * @property {CoraliteDocument} item - The document object from the rendering process
 * @property {string} html - Raw HTML content of the render process as a string
 * @property {number} [duration] - The duration of the render process in milliseconds
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
 * @callback CoralitePluginModule
 * @param {Object} options - Configuration options passed to the plugin
 * @param {CoralitePluginContext} context - Runtime context providing access to values, document data, module info, and path details
 */

/**
 * @this {ThisType<Coralite>}
 * @callback CoralitePluginPageSetCallback
 * @param {Object} param
 * @param {ParseHTMLResult} param.elements
 * @param {CoraliteFilePath & Object.<string, any>} param.values
 * @param {CoraliteCollectionItem} param.data
 * @async
 */

/**
 * @this {ThisType<Coralite>}
 * @callback CoralitePluginPageUpdateCallback
 * @param {Object} param
 * @param {CoraliteElement[]} param.elements
 * @param {CoraliteCollectionItem} param.newValue
 * @param {CoraliteCollectionItem} param.oldValue
 * @async
 */

/**
 * @this {ThisType<Coralite>}
 * @callback CoralitePluginPageDeleteCallback
 * @param {CoraliteCollectionItem} value
 * @async
 */


/**
 * @this {ThisType<Coralite>}
 * @callback CoralitePluginTemplateCallback
 * @param {CoraliteModule} template
 * @async
 */

/**
 * @typedef {Object} CoralitePlugin
 * @property {string} name - Unique identifier/name of the plugin
 * @property {CoralitePluginModule} [method] - Execution function that processes content using plugin logic
 * @property {string[]} [templates=[]] - List of custom templates to be included in the coralite instance
 * @property {CoralitePluginPageSetCallback} [onPageSet] - Async callback triggered when a page is created
 * @property {CoralitePluginPageUpdateCallback} [onPageUpdate] - Async callback triggered when a page is updated
 * @property {CoralitePluginPageDeleteCallback} [onPageDelete] - Async callback triggered when a page is deleted
 * @property {CoralitePluginTemplateCallback} [onTemplateSet] - Async callback triggered when a template is created
 * @property {CoralitePluginTemplateCallback} [onTemplateUpdate] - Async callback triggered when a template is updated
 * @property {CoralitePluginTemplateCallback} [onTemplateDelete] - Async callback triggered when a template is deleted
 */

/**
 * @typedef {Object} CoralitePluginInstance
 * @property {string} name - Unique identifier/name of the plugin
 * @property {CoralitePluginModule} [method] - Execution function that processes content using plugin logic
 * @property {HTMLData[]} [templates=[]] - List of custom templates to be included in the coralite instance
 * @property {CoralitePluginPageSetCallback} [onPageSet] - Async callback triggered when a page is created
 * @property {CoralitePluginPageUpdateCallback} [onPageUpdate] - Async callback triggered when a page is updated
 * @property {CoralitePluginPageDeleteCallback} [onPageDelete] - Async callback triggered when a page is deleted
 * @property {CoralitePluginTemplateCallback} [onTemplateSet] - Async callback triggered when a template is created
 * @property {CoralitePluginTemplateCallback} [onTemplateUpdate] - Async callback triggered when a template is updated
 * @property {CoralitePluginTemplateCallback} [onTemplateDelete] - Async callback triggered when a template is deleted
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
 * @typedef {Object} CoraliteScriptTextContent
 * @property {string} id
 * @property {CoraliteDocument} document - Coralite document with metadata and rendering structure.
 * @property {string} refs - Array of reference identifiers.
 * @property {string} content - The script content as a string.
 */
