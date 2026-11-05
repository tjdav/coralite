/**
 * Page configuration exports recognized by the compiler and validator.
 * @type {string[]}
 */
export const PAGE_EXPORTS = [
  'paths',
  'server',
  'getters',
  'style',
  'provide',
  'client',
  'onError'
]

/**
 * Page handler exports, which must be declared as `export function`.
 * @type {Set<string>}
 */
export const PAGE_HANDLER_EXPORTS = new Set([
  'paths',
  'server',
  'client',
  'onError'
])

/**
 * Page configuration exports, which must be declared as `export const`.
 * @type {Set<string>}
 */
export const PAGE_CONFIG_EXPORTS = new Set([
  'getters',
  'style',
  'provide'
])

/**
 * Component-only exports rejected on pages, with actionable messages.
 * @type {Record<string, string>}
 */
export const REJECTED_PAGE_EXPORTS = {
  attributes: 'definePage does not support "attributes". Use "server" to fetch page data.',
  slots: 'definePage does not support "slots". Pages are the outermost layer.',
  consume: 'definePage does not support "consume". Pages are the root provider — use "provide".',
  formAssociated: 'definePage does not support "formAssociated". Use a form-associated component instead.'
}

/**
 * Defines a Coralite page configuration object.
 * Acts as an identity function at runtime for type inference and build-time analysis.
 *
 * @param {Object} options - Page configuration options
 * @returns {Object} Page options
 */
export function definePage (options = {}) {
  return options
}
