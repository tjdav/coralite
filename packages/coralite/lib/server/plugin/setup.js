import { addPluginHook } from '../hooks.js'
import { CoraliteError, handleError } from '../../shared/errors.js'
import { validatePluginConfigBlocks, validateValues } from '../../shared/plugin-config-schema.js'

/**
 * @import { CoraliteInstance, CoralitePluginContext } from '../../../types/index.js'
 * @import { ScriptManager } from '../script-manager.js'
 */

/**
 * Creates a server hook config view proxy that exposes read-only server.config
 * and a mutable staging object for client.config.
 *
 * @param {Object} serverConfig - Read-only server config object
 * @param {Object} clientConfigStaging - Mutable staging object for client config
 * @param {Set<string>} declaredClientKeys - Set of keys declared in client.config or shared config schemas
 * @returns {Proxy} Config proxy
 */
function createServerHookConfig (serverConfig, clientConfigStaging, declaredClientKeys) {
  const clientConfigProxy = new Proxy(clientConfigStaging || {}, {
    get (target, prop) {
      if (typeof prop === 'symbol') {
        return Reflect.get(target, prop)
      }
      return target[prop]
    },
    set (target, prop, value) {
      if (typeof prop === 'symbol') {
        return Reflect.set(target, prop, value)
      }
      if (!declaredClientKeys || !declaredClientKeys.has(prop)) {
        throw new CoraliteError(
          `[CORALITE-P207] Unknown plugin config key "${String(prop)}". Key must be declared in client.config or config schema.`,
          { code: 'CORALITE-P207' }
        )
      }
      target[prop] = value
      return true
    }
  })

  return new Proxy(serverConfig || {}, {
    get (target, prop) {
      if (prop === 'clientConfig') {
        return clientConfigProxy
      }
      return target[prop]
    },
    set (target, prop, value) {
      if (prop === 'clientConfig') {
        throw new CoraliteError(
          '[CORALITE-P209] Cannot reassign config.clientConfig. Write to config.clientConfig.<key> instead.',
          { code: 'CORALITE-P209' }
        )
      }
      throw new CoraliteError(
        `[CORALITE-P209] Cannot write to server config property "${String(prop)}". Server config is read-only after registration.`,
        { code: 'CORALITE-P209' }
      )
    }
  })
}

/**
 * Logic for initializing plugins.
 *
 * @param {Object} dependencies - The dependencies required to initialize the plugins.
 * @param {CoraliteInstance} dependencies.app - The global Coralite app instance.
 * @param {CoralitePluginContext} dependencies.serverGlobalContext - The global server context for plugins.
 * @param {Object} dependencies.plugins - The collection of registered plugins and hooks.
 * @param {ScriptManager} dependencies.scriptManager - The script manager for handling client-side scripts.
 * @param {Object} dependencies.source - The framework source utilities and context.
 * @returns {Promise<void>}
 */
export async function setupPlugins ({
  app,
  serverGlobalContext,
  plugins,
  scriptManager,
  source
}) {
  const pluginsToInit = app.options.plugins
  const allExportNames = new Set()

  if (app.options.mode === 'testing' && app.options.testing?.mocks?.plugins) {
    const mockKeys = Object.keys(app.options.testing.mocks.plugins)
    const registeredPluginNames = pluginsToInit.map(p => p.server?.name || p.name)

    for (const mockKey of mockKeys) {
      if (!registeredPluginNames.includes(mockKey)) {
        handleError({
          onErrorCallback: app?.onError,
          data: {
            level: 'WARN',
            type: 'unmatched_plugin_mock',
            message: `Mock defined for plugin "${mockKey}", but no plugin with that name is registered.`
          }
        })
      }
    }
  }

  for (const plugin of pluginsToInit) {
    let sharedConfig = {}
    let serverConfig = {}
    let clientConfig = {}
    let normalizedSchemas = plugin._normalizedSchemas

    if (plugin._isConfiguredInstance) {
      sharedConfig = plugin._valuesByBlock.config || {}
      serverConfig = plugin._valuesByBlock.serverConfig || {}
      clientConfig = plugin._valuesByBlock.clientConfig || {}
    } else if (normalizedSchemas) {
      const { valuesByBlock } = validateValues(normalizedSchemas, {})
      sharedConfig = valuesByBlock.config || {}
      serverConfig = valuesByBlock.serverConfig || {}
      clientConfig = valuesByBlock.clientConfig || {}
    } else {
      normalizedSchemas = validatePluginConfigBlocks({
        pluginName: plugin.name,
        config: plugin.config,
        serverConfig: plugin.server?.config,
        clientConfig: plugin.client?.config
      })
      const { valuesByBlock } = validateValues(normalizedSchemas, {})
      sharedConfig = valuesByBlock.config || {}
      serverConfig = valuesByBlock.serverConfig || {}
      clientConfig = valuesByBlock.clientConfig || {}
    }

    plugin._normalizedSchemas = normalizedSchemas

    const clientConfigStaging = {
      ...sharedConfig,
      ...clientConfig
    }
    plugin._clientConfigStaging = clientConfigStaging

    const declaredClientKeys = new Set([
      ...Object.keys(normalizedSchemas?.config || {}),
      ...Object.keys(normalizedSchemas?.clientConfig || {})
    ])

    if (plugin.server) {
      plugin.server.name = plugin.server.name || plugin.name
      plugin.server.config = Object.freeze({
        ...sharedConfig,
        ...serverConfig
      })
    }

    if (plugin.client) {
      plugin.client.name = plugin.client.name || plugin.name
      plugin.client.config = clientConfigStaging
    }

    if (plugin.server) {
      const serverName = plugin.server.name || plugin.name
      const hookConfig = createServerHookConfig(plugin.server.config, clientConfigStaging, declaredClientKeys)

      if (plugin.server.context) {
        /** @type {any} */
        const pluginContext = new Proxy({
          app,
          config: null
        }, {
          get (target, prop) {
            if (prop === 'config') {
              return hookConfig
            }
            if (prop in target) {
              return target[prop]
            }
            // Block access to other plugins' Phase 2 factories in Phase 1
            if (allExportNames.has(prop)) {
              return undefined
            }
            return serverGlobalContext[prop]
          },
          set (target, prop, value) {
            serverGlobalContext[prop] = value
            return Reflect.set(target, prop, value)
          }
        })

        if (allExportNames.has(serverName)) {
          throw new Error(`Coralite Error: Plugin export name conflict. The export name "${serverName}" from plugin "${plugin.name}" is already defined by another plugin.`)
        }

        allExportNames.add(serverName)

        const contextResult = await plugin.server.context(pluginContext)

        if (typeof contextResult !== 'function') {
          throw new CoraliteError(`Coralite Plugin Error: The "context" function of server plugin "${plugin.name}" must return a function for the second phase (instance context). Received: ${typeof contextResult}`)
        }

        source.plugins[serverName] = contextResult
        serverGlobalContext[serverName] = contextResult
      }
      if (plugin.server.components) {
        plugin.server.components.forEach(c => plugins.components.push(c))
      }
      const wrapHook = (hook) => (ctx) => {
        const hookContext = Object.create(ctx)
        hookContext.config = hookConfig
        return hook(hookContext)
      }

      if (plugin.server.onPageSet) {
        addPluginHook(plugins.hooks, 'onPageSet', wrapHook(plugin.server.onPageSet))
      }
      if (plugin.server.onPageDelete) {
        addPluginHook(plugins.hooks, 'onPageDelete', wrapHook(plugin.server.onPageDelete))
      }
      if (plugin.server.onPageUpdate) {
        addPluginHook(plugins.hooks, 'onPageUpdate', wrapHook(plugin.server.onPageUpdate))
      }
      if (plugin.server.onComponentSet) {
        addPluginHook(plugins.hooks, 'onComponentSet', wrapHook(plugin.server.onComponentSet))
      }
      if (plugin.server.onComponentDelete) {
        addPluginHook(plugins.hooks, 'onComponentDelete', wrapHook(plugin.server.onComponentDelete))
      }
      if (plugin.server.onComponentUpdate) {
        addPluginHook(plugins.hooks, 'onComponentUpdate', wrapHook(plugin.server.onComponentUpdate))
      }
      if (plugin.server.onBeforePageRender) {
        addPluginHook(plugins.hooks, 'onBeforePageRender', wrapHook(plugin.server.onBeforePageRender))
      }
      if (plugin.server.onAfterPageRender) {
        addPluginHook(plugins.hooks, 'onAfterPageRender', wrapHook(plugin.server.onAfterPageRender))
      }
      if (plugin.server.onBeforeComponentRender) {
        addPluginHook(plugins.hooks, 'onBeforeComponentRender', wrapHook(plugin.server.onBeforeComponentRender))
      }
      if (plugin.server.onAfterComponentRender) {
        addPluginHook(plugins.hooks, 'onAfterComponentRender', wrapHook(plugin.server.onAfterComponentRender))
      }
      if (plugin.server.onBeforeBuild) {
        addPluginHook(plugins.hooks, 'onBeforeBuild', async (ctx) => {
          const hookContext = Object.create(ctx)
          hookContext.config = hookConfig
          const res = await plugin.server.onBeforeBuild(hookContext)
          if (res && typeof res === 'object') {
            Object.assign(serverGlobalContext, res)
          }
          return res
        })
      }
      if (plugin.server.onAfterBuild) {
        addPluginHook(plugins.hooks, 'onAfterBuild', wrapHook(plugin.server.onAfterBuild))
      }
    }
    if (plugin.client) {
      plugin.client.name = plugin.client.name || plugin.name
      scriptManager.use(plugin.client)
    }
  }
}
