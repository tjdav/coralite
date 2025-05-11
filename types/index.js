/**
 * @typedef {Object} HTMLData
 * @property {CoraliteFilePath} path
 * @property {string} [content] - The raw HTML string contents of the file.
 */

/**
 * @typedef {Object} CoraliteFilePath
 * @property {string} pathname - relative path
 * @property {string} dirname -
 * @property {string} filename - The file name
 * @property {string} page - Path to the template directory
 * @property {string} pageName - Pathname to template
 */

/**
 * Represents the paths to Coralite pages and templates within a project.
 * @typedef {Object} CoralitePath
 * @property {string} pages - The path to the root pages directory
 * @property {string} templates - The path to the root templates directory
 */

/**
 * @typedef {Object} CoraliteTokenOptions
 * @property {Object.<string, string>} [default] - Default token values for properties not explicitly set
 * @property {Object.<string, string[]>} [aliases] - Token aliases and their possible values
 */

/**
 * @typedef {Object.<string, (string | string[] | (CoraliteDirective | CoraliteAnyNode)[])>} CoraliteModuleValues
 */

/**
 * Represents a module in the Coralite framework.
 * @typedef {Object} CoraliteModule
 * @property {string} id - Unique module identifier used to reference this module within the application.
 * @property {CoraliteFilePath} [path] - Template paths associated with this module, if any.
 * @property {number} [lineOffset] - Optional offset value for line numbering purposes within the template.
 * @property {CoraliteElement} template - Module's rendering template which defines its structure and layout.
 * @property {string|undefined} script - Module's JavaScript raw code used for logic or behavior associated with this module.
 * @property {CoraliteDocumentTokens} tokens - Tokens generated from the module's markup, containing metadata or variable information.
 * @property {CoraliteElement[]} customElements - Custom elements defined in the module, allowing extension of HTML capabilities.
 * @property {Object.<string, Object.<string,CoraliteModuleSlotElement>>} slotElements - Custom slot elements and their configurations, enabling flexible content insertion points within components.
 */

/**
 * @typedef {Object} CoraliteDocumentTokens
 * @property {CoraliteAttributeToken[]} attributes - Array of attribute tokens from the document
 * @property {CoraliteTextNodeToken[]} textNodes - Array of text node tokens from the document
 */

/**
 * @typedef {Object} CoraliteToken
 * @property {string} name - Token identifier
 * @property {string} content - Token value or content
 */

/**
 * @typedef {Object} CoraliteAttributeToken
 * @property {string} name - Attribute token identifier
 * @property {CoraliteElement} element - Corresponding HTML element for the attribute
 * @property {CoraliteToken[]} tokens - Array of associated tokens
 */

/**
 * @typedef {Object} CoraliteTextNodeToken
 * @property {CoraliteTextNode} textNode - Text node that contains the token
 * @property {CoraliteToken[]} tokens - Array of associated tokens
 */

/**
 * @typedef {Object} CoraliteModuleSlotElement
 * @property {string} name - Slot element identifier
 * @property {CoraliteElement} element - Corresponding HTML element for the slot
 */

/**
 * @typedef {Object} CoraliteComponent
 * @property {CoraliteElement} element - The primary HTML element representing this component, including its structure and attributes.
 * @property {CoraliteDocument[]} [documents] - CoraliteDocument documents used to append to page render list.
 */

/**
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
 * @typedef {Object} CoraliteTextNode
 * @property {'text'} type - Text node type
 * @property {string} data - Additional attributes for the text node
 * @property {CoraliteContentNode} parent - Parent element of the text node
 */

/**
 * @typedef {Object} CoraliteComment
 * @property {'comment'} type - Comment type
 * @property {string} data - Additional attributes for the text node
 * @property {CoraliteContentNode} parent - Parent element of the text node
 */


/**
 * @typedef {CoraliteElement | CoraliteTextNode | CoraliteComment} CoraliteAnyNode
 * @typedef {CoraliteElement | CoraliteDocumentRoot} CoraliteContentNode
 */

/**
 * @typedef {Object} CoraliteSlotElement
 * @property {string} name - Slot's unique identifier
 * @property {CoraliteElement} customElement - Custom component for the slot
 * @property {CoraliteElement} element - Corresponding HTML element for the slot
 */

/**
 * @typedef {Object} CoraliteDirective
 * @property {'directive'} type - Node type
 * @property {string} data - Raw HTML Doctype
 * @property {string} name - Doctype name
 */

/**
 * @typedef {Object} CoraliteDocumentRoot
 * @property {'root'} type - Node type
 * @property {(CoraliteAnyNode | CoraliteDirective)[]} children - Document list
 */

/**
 * @typedef {Object} CoraliteDocument
 * @property {CoraliteDocumentRoot} root - Array of elements and text nodes in the document
 * @property {CoraliteElement[]} customElements - Custom elements defined in the document
 * @property {CoralitePath & CoraliteFilePath} path - Document's file path
 * @property {IgnoreByAttribute} ignoreByAttribute - An array of attribute names and values to ignore by element type.
 */

/**
 * @typedef {Object} CoraliteAggregateTemplate - Templates used to display the result
 * @property {string} item - Unique identifier for the component used for each document
 */

/**
 * @typedef {Object} CoraliteResult
 * @property {CoraliteDocument} item - The document object from the rendering process
 * @property {string} html - Raw HTML content of the render process as a string
 * @property {number} duration - The duration of the render process in milliseconds
 */

/**
 * @typedef {Array<Array<string, string>>} IgnoreByAttribute - An array of attribute names and values to ignore by element type.
 */

/**
 * @callback CoraliteAggregateFilter
 * @param {CoraliteToken} metadata - Aggregated HTML page metadata
 */

/**
 * @callback CoraliteAggregateSort
 * @param {Object.<string, (string | CoraliteToken[])>} a - Aggregated HTML page metadata
 * @param {Object.<string, (string | CoraliteToken[])>} b - Aggregated HTML page metadata
 */

/**
 * @typedef {Object} CoraliteAggregate – Configuration object for the aggregation process
 * @property {string} path - The path to aggregate, relative to pages directory
 * @property {CoraliteAggregateTemplate | string} template - Templates used to display the result
 * @property {CoraliteAggregateFilter} [filter] - Callback to filter out unwanted elements from the aggregated content.
 * @property {boolean} [recursive] - Whether to recursively search subdirectories
 * @property {CoraliteTokenOptions} [tokens] - Token configuration options
 * @property {CoraliteAggregateSort} [sort] - Sort aggregated pages
 * @property {number} [limit] - Specifies the maximum number of results to retrieve.
 * @property {number} [offset] - Specifies the starting index for the results list.
 */
