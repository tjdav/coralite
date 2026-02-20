
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
 * Union type representing any content node in the Coralite content tree.
 * Can be an HTML element, text node, or comment node.
 * @typedef {CoraliteElement | CoraliteTextNode | CoraliteComment} CoraliteAnyNode
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
 * Union type representing nodes that can be part of a document's content hierarchy.
 * Includes both standard HTML elements and the document root node.
 * @typedef {CoraliteElement | CoraliteDocumentRoot} CoraliteContentNode
 */

export default {}
