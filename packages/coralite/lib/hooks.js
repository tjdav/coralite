import { mergePluginState } from './utils/core.js'
import { CoraliteError } from './utils/errors.js'

/**
 * Registers a callback function under the specified hook name.
 *
 * @param {Object} hooks - The hooks storage object
 * @param {'onPageSet'|'onPageUpdate'|'onPageDelete'|'onComponentSet'|'onComponentUpdate'|'onComponentDelete'|'onBeforePageRender'|'onAfterPageRender'|'onBeforeComponentRender'|'onAfterComponentRender'|'onBeforeBuild'|'onAfterBuild'} name - Hook name
 * @param {Function} callback - Callback function
 */
export function addPluginHook (hooks, name, callback) {
  if (typeof callback !== 'function') {
    throw new CoraliteError(`Plugin hook "${name}" must be a function`)
  }

  if (hooks[name]) {
    hooks[name].push(callback)
  }
}

/**
 * Executes a collecting plugin hook where the results are aggregated.
 *
 * @param {Object} options - The options used to trigger the aggregated plugin hook.
 * @param {Object} options.app - The global Coralite app instance.
 * @param {Object} options.hooks - The collection of registered plugin hooks.
 * @param {Object} options.serverGlobalContext - The global server-side context.
 * @param {string} options.name - The name of the hook to trigger.
 * @param {any} options.contextData - The data associated with the hook context.
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
 * @param {Object} options - The options used to trigger the plugin hook.
 * @param {Object} options.app - The global Coralite app instance.
 * @param {Object} options.hooks - The collection of registered plugin hooks.
 * @param {Object} options.serverGlobalContext - The global server-side context.
 * @param {string} options.name - The name of the hook to trigger.
 * @param {any} options.initialData - The initial data to be modified by the hooks.
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
 * Binds plugins to the instance context using a lazy, cached Proxy.
 *
 * @param {Object} options - The options used to bind plugins.
 * @param {Object} options.pluginFactories - The map of Phase 2 factory functions.
 * @param {Object} [options.instanceContext] - The specific instance context.
 * @param {Object} [options.app] - The global Coralite app instance.
 * @returns {Object} A Proxy that resolves plugins lazily.
 */
export function bindPlugins ({ pluginFactories, instanceContext = {}, app }) {
  const cache = new Map()

  const proxy = new Proxy(instanceContext, {
    get (target, prop) {
      if (prop === 'then') {
        return undefined
      }

      if (Reflect.has(target, prop)) {
        return Reflect.get(target, prop)
      }

      if (cache.has(prop)) {
        return cache.get(prop)
      }

      const factory = pluginFactories[prop]
      if (factory === undefined) {
        return undefined
      }

      if (typeof factory !== 'function') {
        throw new CoraliteError(`Coralite Plugin Error: The plugin "${String(prop)}" must be a function for the second phase (instance context). Received: ${typeof factory}`)
      }

      let resolved = factory(proxy)

      // Handle plugin mocks in testing mode
      if (app?.options?.mode === 'testing' && app.options.testing?.mocks?.plugins) {
        const pluginMock = app.options.testing.mocks.plugins[prop]
        if (pluginMock?.server?.context) {
          if (typeof resolved === 'object' && resolved !== null) {
            resolved = Object.assign({}, resolved, pluginMock.server.context)
          } else {
            resolved = pluginMock.server.context
          }
        }
      }

      cache.set(prop, resolved)
      return resolved
    },
    has (target, prop) {
      return Reflect.has(target, prop) || prop in pluginFactories
    },
    ownKeys (target) {
      return Array.from(new Set([
        ...Reflect.ownKeys(target),
        ...Object.keys(pluginFactories)
      ]))
    },
    getOwnPropertyDescriptor (target, prop) {
      if (Reflect.has(target, prop)) {
        return Reflect.getOwnPropertyDescriptor(target, prop)
      }
      if (prop in pluginFactories) {
        return {
          enumerable: true,
          configurable: true,
          writable: true
        }
      }
      return undefined
    }
  })

  return proxy
}
