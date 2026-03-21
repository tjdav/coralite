
/**
 * @import { CoraliteElement, CoraliteComponentRoot, CoraliteTextNode } from './dom.js'
 * @import { CoraliteModuleValues } from './module.js'
 * @import { CoralitePath, CoraliteFilePath } from './core.js'
 */

/**
 * Represents a complete Coralite component with metadata and rendering structure.
 * @typedef {Object} CoraliteComponent
 * @property {CoraliteComponentRoot} root - Array of elements and text nodes in the component
 * @property {CoraliteElement[]} customElements - Custom elements defined in the component
 * @property {CoralitePath & CoraliteFilePath} path - Document's file path
 * @property {Array<string | Attribute>} ignoreByAttribute - An array of attribute names and values to ignore by element type.
 * @property {string[]} [styles] - Collected styles during build process
 * @property {Set<string>} [sharedStyles] - Set of processed shared style IDs
 * @property {CoraliteModuleValues} [values] - The initial values for the component.
 * @property {CoraliteElement[]} [tempElements] - An array of temporary elements created during the parsing process.
 * @property {CoraliteElement[]} [skipRenderElements] - An array of elements to skip rendering.
 */

/**
 * @typedef {Object} CoraliteComponentResult
 * @property {CoraliteModuleValues} values - The module values extracted from the component
 * @property {CoraliteElement[]} tempElements - Temporary elements created during processing
 * @property {CoraliteElement[]} [skipRenderElements] - An array of elements to skip rendering.
 * @property {string[]} [styles] - Collected styles during build process
 * @property {Set<string>} [sharedStyles] - Set of processed shared style IDs
 * @property {CoraliteElement[]} [customElements] - Custom elements defined in the component
 */

/**
 * Represents a rendered output component with metadata and statistics.
 * @typedef {Object} CoraliteResult
 * @property {'page'|'component'} type - Result type.
 * @property {CoraliteFilePath} path - Document's file path
 * @property {string} content - Raw file content of the render process as a string
 * @property {number} [duration] - The duration of the render process in milliseconds
 */

/**
 * @typedef {Object} Attribute
 * @property {string} name - Name of attribute
 * @property {string} value - Value of attribute
 */

/**
 * Holds tokenized metadata extracted from component attributes, element references and text nodes.
 * @typedef {Object} CoraliteComponentValues
 * @property {CoraliteRef[]} refs - List of element references
 * @property {CoraliteAttributeToken[]} attributes - List of attribute tokens from the component
 * @property {CoraliteTextNodeToken[]} textNodes - List of text node tokens from the component
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
 * @property {CoraliteComponentRoot} root - The root element of the parsed HTML component.
 * @property {CoraliteElement[]} customElements - An array of custom elements identified during parsing.
 * @property {CoraliteElement[]} tempElements - An array of temporary elements created during the parsing process.
 * @property {CoraliteElement[]} [skipRenderElements] - An array of elements to skip rendering.
 */

export default {}
