import { mergePluginState } from './utils.js'

/**
 * Registers a callback function under the specified hook name.
 *
 * @param {Object} hooks - The hooks storage object
 * @param {'onPageSet'|'onPageUpdate'|'onPageDelete'|'onComponentSet'|'onComponentUpdate'|'onComponentDelete'|'onBeforePageRender'|'onAfterPageRender'|'onBeforeComponentRender'|'onAfterComponentRender'|'onBeforeBuild'|'onAfterBuild'} name - Hook name
 * @param {Function} callback - Callback function
 */
export function addPluginHook (hooks, name, callback) {
  if (typeof callback !== 'function') {
    throw new Error(`Plugin hook "${name}" must be a function`)
  }

  if (hooks[name]) {
    hooks[name].push(callback)
  }
}

/**
 * Executes a collecting plugin hook where the results are aggregated.
 *
 * @param {Object} options
 * @param {Object} options.app - Coralite instance
 * @param {Object} options.hooks - Registered hooks
 * @param {Object} options.serverGlobalContext - Global context
 * @param {string} options.name - Hook name
 * @param {any} options.contextData - Context data
 * @returns {Promise<any[]>} Aggregated results
 */
export async function triggerPluginAggregateHook ({ app, hooks, serverGlobalContext, name, contextData }) {
  const pluginHooks = hooks[name]
  const aggregatedResults = []

  if (!pluginHooks || pluginHooks.length === 0) {
    return aggregatedResults
  }

  for (let i = 0; i < pluginHooks.length; i++) {
    let result = pluginHooks[i](Object.assign({ app }, serverGlobalContext, contextData))

    if (result !== null && typeof result === 'object' && typeof result.then === 'function') {
      result = await result
    }

    if (result !== undefined && result !== null) {
      if (Array.isArray(result)) {
        aggregatedResults.push(...result)
      } else {
        aggregatedResults.push(result)
      }
    }
  }

  return aggregatedResults
}

/**
 * Executes all plugin callbacks registered under the specified hook name sequentially.
 *
 * @param {Object} options
 * @param {Object} options.app - Coralite instance
 * @param {Object} options.hooks - Registered hooks
 * @param {Object} options.serverGlobalContext - Global context
 * @param {string} options.name - Hook name
 * @param {any} options.initialData - Initial data
 * @returns {Promise<any>} Merged data
 */
export async function triggerPluginHook ({ app, hooks, serverGlobalContext, name, initialData }) {
  const pluginHooks = hooks[name]

  if (!pluginHooks || pluginHooks.length === 0) {
    return initialData
  }

  let currentData = typeof initialData === 'object' && initialData !== null
    ? Object.assign({ app }, serverGlobalContext, initialData)
    : initialData

  for (let i = 0; i < pluginHooks.length; i++) {
    let result = pluginHooks[i](currentData)

    if (result !== null && typeof result === 'object' && typeof result.then === 'function') {
      result = await result
    }

    if (result !== undefined && result !== null) {
      currentData = mergePluginState(currentData, result)
    }
  }

  return currentData
}

/**
 * Executes Phase 2 of plugin exports with the given instance context.
 *
 * @param {Object} options
 * @param {Object} options.serverGlobalContext - Global context
 * @param {Object} options.phase2Functions - Phase 2 functions
 * @param {Object} options.instanceContext - Instance context
 * @returns {Promise<Object>} Bound plugins
 */
export async function bindPlugins ({ serverGlobalContext, phase2Functions, instanceContext }) {
  const boundPlugins = {}
  const globalContext = Object.assign({ app: serverGlobalContext.app }, instanceContext)

  for (const name in phase2Functions) {
    const pluginExports = phase2Functions[name]
    if (pluginExports !== null && typeof pluginExports === 'object') {
      const boundObj = {}
      for (const prop in pluginExports) {
        if (typeof pluginExports[prop] === 'function') {
          boundObj[prop] = await pluginExports[prop](globalContext)
        } else {
          boundObj[prop] = pluginExports[prop]
        }
      }
      boundPlugins[name] = boundObj
    } else {
      boundPlugins[name] = pluginExports
    }
  }

  return boundPlugins
}
