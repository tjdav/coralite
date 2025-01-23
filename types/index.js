/**
 * @typedef {Object} HTMLData
 * @property {string} parentPath - The path to the parent directory of the file.
 * @property {string} name - The file name.
 * @property {string} content - HTML string
 */

/**
 * @typedef {Object} CoralitePath
 * @property {string} pages - The path to the root pages directory
 * @property {string} components - The path to the root components directory
 */

/**
 * @typedef {Object} CoraliteTokenOptions
 * @property {Object.<string, string>} [default] - Default token values for properties not explicitly set
 * @property {Object.<string, string[]>} [aliases] - Token aliases and their possible values
 */


/**
 * @typedef {Object} CoraliteModule
 * @property {string} id - Unique module identifier
 * @property {CoraliteElement} template - Module's rendering template
 * @property {string|undefined} script - Module's JavaScript raw code
 * @property {CoraliteDocumentTokens} tokens - Tokens generated from the module's markup
 * @property {CoraliteElement[]} customElements - Custom elements defined in the module
 * @property {Object.<string, Object.<string,CoraliteModuleSlotElement>>} slotElements - Custom slot elements and their configurations
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
 * @property {'text'} type - Type of text node ('text')
 * @property {string} data - Text node raw data
 * @property {CoraliteElement} parent - Parent element of the text node
 */

/**
 * @typedef {Object} CoraliteModuleSlotElement
 * @property {string} name - Slot element identifier
 * @property {CoraliteElement} element - Corresponding HTML element for the slot
 */

/**
 * @typedef {Object} CoraliteElement
 * @property {'tag'} type - Element type
 * @property {string} name - Tag name
 * @property {Object.<string, string>} attribs - Element attributes
 * @property {(CoraliteElement | CoraliteTextNode)[]} children - Child nodes of the element
 * @property {CoraliteElement} parent - Parent element
 * @property {number} [parentChildIndex] - Position in parent's child list
 */


/**
 * @typedef {Object} CoraliteTextNode
 * @property {'text'} type - Text node type
 * @property {string} data - Additional attributes for the text node
 * @property {CoraliteElement} parent - Parent element of the text node
 */

/**
 * @typedef {Object} CoraliteSlotElement
 * @property {string} name - Slot's unique identifier
 * @property {CoraliteElement} customElement - Custom component for the slot
 * @property {CoraliteElement} element - Corresponding HTML element for the slot
 */

/**
 * @typedef {Object} CoraliteDocument
 * @property {string} name - Document file name
 * @property {string} parentPath - Parent file path
 * @property {(CoraliteElement | CoraliteTextNode)[]} nodes - Array of elements and text nodes in the document
 * @property {CoraliteElement[]} customElements - Custom elements defined in the document
 * @property {Object.<string, CoraliteSlotElement[]>} customElementSlots - Slots with their respective elements
 * @property {CoralitePath} path - Document's file path
 */
