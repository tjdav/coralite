/**
 * Represents HTML file data including path and raw content.
 * @typedef {Object} HTMLData
 * @property {CoraliteFilePath} path
 * @property {string} [content] - The raw HTML string contents of the file.
 */

/**
 * Represents a file's path structure within the project.
 * @typedef {Object} CoraliteFilePath
 * @property {string} pathname - relative path
 * @property {string} dirname -
 * @property {string} filename - The file name
 * @property {string} page - Path to the template directory
 * @property {string} pageName - Pathname to template
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
 * @property {CoraliteDocumentTokens} tokens - Tokens generated from the module's markup, containing metadata or variable information.
 * @property {CoraliteElement[]} customElements - Custom elements defined in the module, allowing extension of HTML capabilities.
 * @property {Object.<string, Object.<string,CoraliteModuleSlotElement>>} slotElements - Custom slot elements and their configurations, enabling flexible content insertion points within components.
 */

/**
 * Holds tokenized metadata extracted from document attributes and text nodes.
 * @typedef {Object} CoraliteDocumentTokens
 * @property {CoraliteAttributeToken[]} attributes - Array of attribute tokens from the document
 * @property {CoraliteTextNodeToken[]} textNodes - Array of text node tokens from the document
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
 * A Coralite component containing an HTML structure and associated documents.
 * @typedef {Object} CoraliteComponent
 * @property {CoraliteElement} element - The primary HTML element representing this component, including its structure and attributes.
 * @property {CoraliteDocument[]} [documents] - CoraliteDocument documents used to append to page render list.
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
 */

/**
 * Represents an HTML comment within the Coralite content tree.
 * @typedef {Object} CoraliteComment
 * @property {'comment'} type - Comment type
 * @property {string} data - Additional attributes for the text node
 * @property {CoraliteContentNode} parent - Parent element of the text node
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
 * @property {IgnoreByAttribute} ignoreByAttribute - An array of attribute names and values to ignore by element type.
 */

/**
 * Configuration for templates used to render aggregated results.
 * @typedef {Object} CoraliteAggregateTemplate - Templates used to display the result
 * @property {string} item - Unique identifier for the component used for each document
 */

/**
 * Represents a rendered output document with metadata and statistics.
 * @typedef {Object} CoraliteResult
 * @property {CoraliteDocument} item - The document object from the rendering process
 * @property {string} html - Raw HTML content of the render process as a string
 * @property {number} duration - The duration of the render process in milliseconds
 */

/**
 * An array of attribute name-value pairs to exclude from processing.
 * @typedef {Array<Array<string, string>>} IgnoreByAttribute - An array of attribute names and values to ignore by element type.
 */

/**
 * Callback function for filtering aggregated content based on metadata.
 * @callback CoraliteAggregateFilter
 * @param {CoraliteToken} metadata - Aggregated HTML page metadata
 */

/**
 * Callback function for sorting aggregated results based on metadata.
 * @callback CoraliteAggregateSort
 * @param {Object.<string, (string | CoraliteToken[])>} a - Aggregated HTML page metadata
 * @param {Object.<string, (string | CoraliteToken[])>} b - Aggregated HTML page metadata
 */

/**
 * Configuration object for content aggregation processes.
 * @typedef {Object} CoraliteAggregate – Configuration object for the aggregation process
 * @property {string} path - The path to aggregate, relative to pages directory
 * @property {CoraliteAggregateTemplate | string} template - Templates used to display the result
 * @property {Object} [pagination]
 * @property {string} pagination.token - The token name that was used by the aggregation function
 * @property {string} pagination.template - Pagination template ID
 * @property {string} pagination.path - Pagination page infix (e.g. 'page' will result in 'page/1')
 * @property {CoraliteAggregateFilter} [filter] - Callback to filter out unwanted elements from the aggregated content.
 * @property {boolean} [recursive] - Whether to recursively search subdirectories
 * @property {CoraliteTokenOptions} [tokens] - Token configuration options
 * @property {CoraliteAggregateSort} [sort] - Sort aggregated pages
 * @property {number} [limit] - Specifies the maximum number of results to retrieve.
 * @property {number} [offset] - Specifies the starting index for the results list.
 */
