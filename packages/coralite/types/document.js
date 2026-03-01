
/**
 * @import { CoraliteElement, CoraliteDocumentRoot, CoraliteTextNode, CoraliteAnyNode } from './dom.js'
 * @import { CoraliteModuleValues } from './module.js'
 * @import { CoralitePath, CoraliteFilePath } from './core.js'
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
 * @property {CoraliteModuleValues} [values] - The initial values for the document.
 * @property {CoraliteElement[]} [tempElements] - An array of temporary elements created during the parsing process.
 * @property {CoraliteElement[]} [skipRenderElements] - An array of elements to skip rendering.
 */

/**
 * @typedef {Object} CoraliteDocumentResult
 * @property {CoraliteModuleValues} values - The module values extracted from the document
 * @property {CoraliteElement[]} tempElements - Temporary elements created during processing
 * @property {CoraliteElement[]} [skipRenderElements] - An array of elements to skip rendering.
 * @property {string[]} [styles] - Collected styles during build process
 * @property {Set<string>} [sharedStyles] - Set of processed shared style IDs
 * @property {CoraliteElement[]} [customElements] - Custom elements defined in the document
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
 * @typedef {Object} ParseHTMLResult
 * @property {CoraliteDocumentRoot} root - The root element of the parsed HTML document.
 * @property {CoraliteElement[]} customElements - An array of custom elements identified during parsing.
 * @property {CoraliteElement[]} tempElements - An array of temporary elements created during the parsing process.
 * @property {CoraliteElement[]} [skipRenderElements] - An array of elements to skip rendering.
 */

export default {}
