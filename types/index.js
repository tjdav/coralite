/**
 * @callback coraliteComputedTokens
 * @param {Object} thisArgs
 * @returns {Promise<Object<string, string>>}
 */

/**
 * @typedef {Object} CoraliteToken
 * @property {string} name - Token name
 * @property {string} content - End position of token
 */

/**
 * @typedef {Object} CoraliteTokenOptions
 * @property {Object.<string, string>} [default] - Token defaults
 * @property {Object.<string, string[]>} [aliases] - Token aliases
 */

/**
 * @typedef {Object} CoraliteComponent
 * @property {string} id
 * @property {string} content
 * @property {CoraliteToken[]} tokens
 * @property {coraliteComputedTokens} computedTokens
 * @property {CoraliteCustomElement[]} customElements
 */

/**
 * @typedef {Object} CoraliteCustomElementResult
 * @property {string} content - Content body
 * @property {CoraliteCustomElement[]} customElements - Custom elements found in content body
 */

/**
 * @typedef {Object} CoraliteCustomElementAttribute
 * @property {string} name - Attribute name
 * @property {string} value - Attribute value
 * @property {CoraliteToken[]} tokens - List of tokens used in attribute value
 */

/**
 * @typedef {Object} CoraliteCustomElement
 * @property {string} id - Custom element ID
 * @property {CoraliteCustomElementAttribute[]} attributes - Custom element attributes
 * @property {string} content
 */

/**
 * @typedef {Object} HTMLData
 * @property {string} parentPath - The path to the parent directory of the file.
 * @property {string} name - The file name.
 * @property {string} content - HTML string
 */

/**
 * @typedef {Object} CoralitePath
 * @property {string} pages
 * @property {string} components
 */
