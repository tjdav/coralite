/**
 * Callback function for computing tokens based on provided arguments.
 * @callback coraliteComputedTokens
 * @param {Object} thisArgs - The object containing data for the computation.
 * @returns {Promise<Object<string, string>>} A promise resolving to an object with token names as keys and their respective contents as values.
 */

/**
 * Represents a single Coralite token with a name and content position.
 * @typedef {Object} CoraliteToken
 * @property {string} name - The unique identifier of the token.
 * @property {string} content - The token value
 */

/**
 * @typedef {Object} CoraliteTokenOptions
 * @property {Object.<string, string>} [default] - Token defaults
 * @property {Object.<string, string[]>} [aliases] - Token aliases
 */

/**
 * Represents a Coralite component
 * @typedef {Object} CoraliteComponent
 * @property {string} id - A unique identifier for the component.
 * @property {string} content - The component's raw HTML content.
 * @property {CoraliteToken[]} tokens - Array of tokens found in the component's content.
 * @property {coraliteComputedTokens} computedTokens - Function to compute additional token values based on provided arguments.
 * @property {CoraliteCustomElement[]} customElements - List of custom elements within this component.
 */

/**
 * Result object containing custom element content and found custom elements.
 * @typedef {Object} CoraliteCustomElementResult
 * @property {string} content - The HTML string representing the content body with embedded custom elements.
 * @property {CoraliteCustomElement[]} customElements - Array of found custom elements within the content body.
 */

/**
 * Represents a single attribute for a custom element, including its name, value, and associated tokens.
 * @typedef {Object} CoraliteCustomElementAttribute
 * @property {string} name - The attribute's name (e.g., 'data-*').
 * @property {string} value - The attribute's value within the component content.
 * @property {CoraliteToken[]} tokens - Array of tokens used in constructing this attribute's value.
 */

/**
 * Represents a custom element with its ID, attributes, and content.
 * @typedef {Object} CoraliteCustomElement
 * @property {string} id - The unique identifier for the custom element within its component.
 * @property {CoraliteCustomElementAttribute[]} attributes - Array of attributes associated with this custom element.
 * @property {string} content - The inner HTML content of the custom element.
 */

/**
 * Represents data about an HTML file, including its path and content.
 * @typedef {Object} HTMLData
 * @property {string} parentPath  - Path to the directory containing this file (e.g., '../my-component').
 * @property {string} name - The file's name without extension (e.g., 'my-component').
 * @property {string} content - The raw HTML string contents of the file.
 */

/**
 * Represents the paths to Coralite pages and components within a project.
 * @typedef {Object} CoralitePath
 * @property {string} pages - Path to the directory containing page files (e.g., 'pages').
 * @property {string} components - Path to the directory containing component files (e.g., 'components').
 */
