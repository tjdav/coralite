import { addPluginHook } from '../hooks.js'
import { CoraliteError, handleError } from '../../shared/errors.js'
import { validateValues } from '../../shared/plugin-config-schema.js'

/**
 * @import { CoraliteInstance, CoralitePluginContext } from '../../../types/index.js'
 * @import { ScriptManager } from '../script-manager.js'
 */

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

    if (plugin._isConfiguredInstance) {
      sharedConfig = plugin._valuesByBlock.config || {}
      serverConfig = plugin._valuesByBlock.serverConfig || {}
      clientConfig = plugin._valuesByBlock.clientConfig || {}
    } else if (plugin._normalizedSchemas) {
      const { valuesByBlock } = validateValues(plugin._normalizedSchemas, {})
      sharedConfig = valuesByBlock.config || {}
      serverConfig = valuesByBlock.serverConfig || {}
      clientConfig = valuesByBlock.clientConfig || {}
    } else {
      sharedConfig = plugin.config || {}
      serverConfig = plugin.server?.config || {}
      clientConfig = plugin.client?.config || {}
    }

    const clientConfigStaging = {
      ...sharedConfig,
      ...clientConfig
    }
    plugin._clientConfigStaging = clientConfigStaging

    if (plugin.server) {
      if (typeof plugin.server === 'object') {
        try {
          plugin.server.name = plugin.server.name || plugin.name
        } catch {
          // ignore non-writable property
        }
      }
      plugin.server.config = {
        ...sharedConfig,
        ...serverConfig
      }
    }

    if (plugin.client) {
      if (typeof plugin.client === 'object') {
        try {
          plugin.client.name = plugin.client.name || plugin.name
        } catch {
          // ignore non-writable property
        }
      }
      plugin.client.config = clientConfigStaging
    }

    if (plugin.server) {
      const serverName = plugin.server.name || plugin.name

      if (plugin.server.context) {
        /** @type {any} */
        const pluginContext = new Proxy({
          app,
          config: null
        }, {
          get (target, prop) {
            if (prop === 'config') {
              return plugin.server.config || {}
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
        hookContext.config = plugin.server.config || {}
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

          const clientConfigSchema = plugin._normalizedSchemas?.clientConfig || plugin.client?.config || {}
          const serverConfigSchema = plugin._normalizedSchemas?.serverConfig || plugin.server?.config || {}

          const serverConfigTarget = plugin.server.config || {}

          const clientConfigProxy = new Proxy(clientConfigStaging, {
            get (target, prop) {
              return Reflect.get(target, prop)
            },
            set (target, prop, value) {
              if (!Object.hasOwn(clientConfigSchema, prop)) {
                throw new CoraliteError(
                  `[CORALITE-P207] Late-bound write to key "${String(prop)}" failed: key must be declared in client.config schema.`,
                  { code: 'CORALITE-P207' }
                )
              }

              return Reflect.set(target, prop, value)
            }
          })

          const buildHookConfigProxy = new Proxy(serverConfigTarget, {
            get (target, prop) {
              if (prop === 'clientConfig') {
                return clientConfigProxy
              }
              return Reflect.get(target, prop)
            },
            has (target, prop) {
              if (prop === 'clientConfig') {
                return true
              }
              return Reflect.has(target, prop)
            },
            ownKeys (target) {
              return Array.from(new Set([...Reflect.ownKeys(target), 'clientConfig']))
            },
            getOwnPropertyDescriptor (target, prop) {
              if (prop === 'clientConfig') {
                return {
                  enumerable: true,
                  configurable: true,
                  writable: false,
                  value: clientConfigProxy
                }
              }
              return Reflect.getOwnPropertyDescriptor(target, prop)
            },
            set (target, prop, value) {
              if (prop === 'clientConfig') {
                throw new CoraliteError(
                  '[CORALITE-P207] Cannot reassign clientConfig object in build hook context. Assign individual keys directly to config.clientConfig.<key>.',
                  { code: 'CORALITE-P207' }
                )
              }

              const decl = serverConfigSchema[prop]
              if (!decl || !decl.lateBound) {
                throw new CoraliteError(
                  `[CORALITE-P208] Cannot write to server config key "${String(prop)}" during build hook without "lateBound: true" in server config schema.`,
                  { code: 'CORALITE-P208' }
                )
              }

              return Reflect.set(target, prop, value)
            }
          })

          hookContext.config = buildHookConfigProxy

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
