/**
 * @import { CoraliteElement, CoraliteTextNode, CoraliteAggregateTemplate } from '#types'
 */

/**
 * These exports are placeholder for types
 * The HTML module code is run in the `parseScript` function in parse.js
 */

/**
 * @type {Object.<string, string>}
 */
export const tokens = {}

/**
 * Defines a Coralite component
 *
 * @param {Object} options
 * @param {string} [options.id] - Optional component id, if not defined, the id will be extracted from the first top level element with the id attribute
 * @param {Object.<string, (string | Function)>} options.tokens - Token names and values are either strings or functions representing the corresponding tokens' content or behavior.
 * @param {Object.<string, Function>} options.slots - Middleware for slot content
 * @returns {Promise<Object.<string, string>>}
 */
export async function defineComponent (options) {
  /** @type {Object.<string, string>} */
  return {}
}

/**
 * Aggregates HTML content from specified paths into a single collection of components.
 *
 * @param {Object} options - Configuration object for the aggregation process
 * @param {CoraliteAggregateTemplate | string} options.template - Templates used to display the result
 * @param {string} options.path - The path to aggregate, relative to pages directory
 * @returns {Promise<(CoraliteElement | CoraliteTextNode)[]>}
 */
export async function aggregate (options) {
  return []
}
