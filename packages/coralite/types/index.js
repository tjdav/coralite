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
 * Represents URL and file path values available during template rendering.
 * @typedef {Object} CoralitePathValues
 * @property {string} $urlPathname - The URL pathname
 * @property {string} $urlDirname - The directory name of the URL
 * @property {string} $filePathname - The file path name
 * @property {string} $fileDirname - The directory name of the file
 * @property {string} $filename - The filename
 * @property {Object<string, string>} [data.values] - Additional values from data
 */

/**
 * Union type representing values available for token replacement in templates.
 * @typedef {CoralitePathValues | Object.<string, string>} CoraliteValues
 */

/**
 * A collection of module values associated with a module.
 * @typedef {Object.<string, CoraliteModuleValue> & { __script__?: ScriptContent }} CoraliteModuleValues
 */

/**
 * Coralite module script content
 * @typedef {Object} ScriptContent
 * @property {function} fn
 * @property {Object.<string, CoraliteModuleValue>} values
 */

/**
 * Represents a single value that a module can store or process.
 * @typedef {string | string[] | (CoraliteDirective | CoraliteAnyNode)[]} CoraliteModuleValue
 */

/**
 * Represents a CSS style definition within a Coralite module.
 * @typedef {Object} CoraliteStyle
 * @property {string} content - The raw CSS content
 * @property {boolean} scoped - Whether the style should be scoped to component instances
 */

/**
 * A module within the Coralite library, containing metadata and rendering logic.
 * @typedef {Object} CoraliteModule
 * @property {string} [id] - Unique module identifier used to reference this module within the application.
 * @property {CoraliteFilePath} [path] - Template paths associated with this module, if any.
 * @property {number} [lineOffset] - Optional offset value for line numbering purposes within the template.
 * @property {CoraliteElement} [template] - Module's rendering template which defines its structure and layout.
 * @property {string|undefined} [script] - Module's JavaScript raw code used for logic or behavior associated with this module.
 * @property {CoraliteStyle[]} [styles] - Styles associated with this module.
 * @property {CoraliteDocumentValues} [values] - Values generated from the module's markup, containing metadata or variable information.
 * @property {CoraliteElement[]} [customElements] - Custom elements defined in the module, allowing extension of HTML capabilities.
 * @property {Object.<string, Object.<string,CoraliteModuleSlotElement>>} [slotElements] - Custom slot elements and their configurations, enabling flexible content insertion points within components.
 * @property {boolean} isTemplate - Indicates whether the module is a template
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
 * Represents the raw data structure of an HTML element before DOM enhancement.
 * @typedef {Object} RawCoraliteElement
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
 * @property {string} nodeName - The name of the node (uppercase tag name)
 * @property {string} tagName - The tag name of the element (uppercase)
 * @property {number} nodeType - The node type constant (1 for elements)
 * @property {string|null} nodeValue - The value of the node (null for elements)
 * @property {Object.<string, string>} attributes - Alias for attribs
 * @property {CoraliteAnyNode[]} childNodes - Alias for children
 * @property {CoraliteContentNode} parentNode - Alias for parent
 * @property {CoraliteContentNode} parentElement - Alias for parent
 * @property {CoraliteAnyNode|null} previousSibling - The node immediately preceding this node
 * @property {CoraliteAnyNode|null} nextSibling - The node immediately following this node
 * @property {CoraliteAnyNode|null} firstChild - The first child node
 * @property {CoraliteAnyNode|null} lastChild - The last child node
 * @property {string} textContent - The text content of the node and its descendants
 * @property {string} id - The element's ID attribute
 * @property {string} className - The element's class attribute
 */

/**
 * Represents the raw data structure of a text node before DOM enhancement.
 * @typedef {Object} RawCoraliteTextNode
 * @property {'text'} type - Text node type
 * @property {string} data - Additional attributes for the text node
 * @property {CoraliteContentNode} parent - Parent element of the text node
 * @property {boolean} [remove] - Mark element to be removed from stack
 */

/**
 * Represents a text node within the Coralite content tree.
 * @typedef {Object} CoraliteTextNode
 * @property {'text'} type - Text node type
 * @property {string} data - Additional attributes for the text node
 * @property {CoraliteContentNode} parent - Parent element of the text node
 * @property {boolean} [remove] - Mark element to be removed from stack
 * @property {string} nodeName - The name of the node (#text)
 * @property {undefined} tagName - Undefined for text nodes
 * @property {number} nodeType - The node type constant (3 for text nodes)
 * @property {string} nodeValue - The text content of the node
 * @property {undefined} attributes - Undefined for text nodes
 * @property {undefined} childNodes - Undefined for text nodes
 * @property {CoraliteContentNode} parentNode - Alias for parent
 * @property {CoraliteContentNode} parentElement - Alias for parent
 * @property {CoraliteAnyNode|null} previousSibling - The node immediately preceding this node
 * @property {CoraliteAnyNode|null} nextSibling - The node immediately following this node
 * @property {null} firstChild - Null for text nodes
 * @property {null} lastChild - Null for text nodes
 * @property {string} textContent - The text content of the node
 */

/**
 * Represents the raw data structure of a comment node before DOM enhancement.
 * @typedef {Object} RawCoraliteComment
 * @property {'comment'} type - Comment type
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
 * @property {string} nodeName - The name of the node (#comment)
 * @property {undefined} tagName - Undefined for comment nodes
 * @property {number} nodeType - The node type constant (8 for comment nodes)
 * @property {string} nodeValue - The content of the comment
 * @property {undefined} attributes - Undefined for comment nodes
 * @property {undefined} childNodes - Undefined for comment nodes
 * @property {CoraliteContentNode} parentNode - Alias for parent
 * @property {CoraliteContentNode} parentElement - Alias for parent
 * @property {CoraliteAnyNode|null} previousSibling - The node immediately preceding this node
 * @property {CoraliteAnyNode|null} nextSibling - The node immediately following this node
 * @property {null} firstChild - Null for comment nodes
 * @property {null} lastChild - Null for comment nodes
 * @property {string} textContent - The content of the comment
 */


/**
 * Union type representing any content node in the Coralite content tree.
 * Can be an HTML element, text node, or comment node.
 * @typedef {CoraliteElement | CoraliteTextNode | CoraliteComment} CoraliteAnyNode
 */

/**
 * Union type representing nodes that can be part of a document's content hierarchy.
 * Includes both standard HTML elements and the document root node.
 * @typedef {CoraliteElement | CoraliteDocumentRoot} CoraliteContentNode
 */

/**
 * Represents the raw data structure of a directive before DOM enhancement.
 * @typedef {Object} RawCoraliteDirective
 * @property {'directive'} type - Node type
 * @property {string} data - Raw HTML Doctype
 * @property {string} name - Doctype name
 * @property {boolean} [remove] - Mark element to be removed from stack
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
 * Represents the raw data structure of a document root before DOM enhancement.
 * @typedef {Object} RawCoraliteDocumentRoot
 * @property {'root'} type - Node type
 * @property {(CoraliteAnyNode | CoraliteDirective)[]} children - Document list
 */

/**
 * Represents the root node of a document containing all content nodes.
 * @typedef {Object} CoraliteDocumentRoot
 * @property {'root'} type - Node type
 * @property {(CoraliteAnyNode | CoraliteDirective)[]} children - Document list
 * @property {string} nodeName - The name of the node (#document)
 * @property {undefined} tagName - Undefined for document nodes
 * @property {number} nodeType - The node type constant (9 for document nodes)
 * @property {null} nodeValue - Null for document nodes
 * @property {undefined} attributes - Undefined for document nodes
 * @property {(CoraliteAnyNode | CoraliteDirective)[]} childNodes - Alias for children
 * @property {null} parentNode - Null for document root
 * @property {null} parentElement - Null for document root
 * @property {null} previousSibling - Null for document root
 * @property {null} nextSibling - Null for document root
 * @property {CoraliteAnyNode|CoraliteDirective|null} firstChild - The first child node
 * @property {CoraliteAnyNode|CoraliteDirective|null} lastChild - The last child node
 * @property {string} textContent - The text content of the node and its descendants
 */

/**
 * Represents a complete Coralite document with metadata and rendering structure.
 * @typedef {Object} CoraliteDocument
 * @property {CoraliteDocumentRoot} root - Array of elements and text nodes in the document
 * @property {CoraliteElement[]} customElements - Custom elements defined in the document
 * @property {CoralitePath & CoraliteFilePath} path - Document's file path
 * @property {IgnoreByAttribute[]} ignoreByAttribute - An array of attribute names and values to ignore by element type.
 * @property {string[]} [styles] - Collected styles during build process
 * @property {Set<string>} [sharedStyles] - Set of processed shared style IDs
 */

/**
 * @typedef {Object} CoraliteDocumentResult
 * @property {CoraliteModuleValues} values - The module values extracted from the document
 * @property {CoraliteElement[]} tempElements - Temporary elements created during processing
 * @property {string[]} [styles] - Collected styles during build process
 * @property {Set<string>} [sharedStyles] - Set of processed shared style IDs
 */

/**
 * Represents a rendered output document with metadata and statistics.
 * @typedef {Object} CoraliteResult
 * @property {CoraliteFilePath} path - Document's file path
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
 * @property {Function} [server] - Server extension hook
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
