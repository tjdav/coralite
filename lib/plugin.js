/**
 * @import Coralite from './coralite.js'
 * @import { CoraliteModule, CoraliteElement } from '#types'
 */

/**
 * @typedef {Object} CoralitePluginContext
 * @property {Object} values
 * @property {Object} document
 * @property {CoraliteModule} module
 * @property {CoraliteElement} element
 * @property {Object} path
 * @property {[string, string][]} excludeByAttribute
 */

/**
 * @callback CoralitePluginModule
 * @param {Object} options
 * @param {CoralitePluginContext} context
 */

/**
 * @typedef {Object} CoralitePlugin
 * @property {string} name
 * @property {CoralitePluginModule} method
 * @property {'system'} [type]
 */

/**
 * @param {CoralitePlugin & ThisType<Coralite>} options
 */
export function createPlugin ({
  name,
  method
}) {
  if (typeof method !== 'function') {
    throw Error('Coralite plugins method expects a function')
  }

  return {
    name,
    method
  }
}
