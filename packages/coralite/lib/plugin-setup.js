import { addPluginHook } from './hooks.js'

/**
 * Logic for initializing plugins.
 *
 * @param {Object} dependencies
 * @param {import('../types/index.js').CoraliteInstance} dependencies.app
 * @param {import('../types/index.js').CoralitePluginContext} dependencies.serverGlobalContext
 * @param {Object} dependencies.plugins
 * @param {import('./script-manager.js').ScriptManager} dependencies.scriptManager
 * @param {Object} dependencies.source
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
  for (const plugin of pluginsToInit) {
    if (plugin.server) {
      if (plugin.server.exports) {
        const phase2Obj = {}
        for (const prop in plugin.server.exports) {
          phase2Obj[prop] = typeof plugin.server.exports[prop] === 'function'
            // @ts-ignore
            ? await plugin.server.exports[prop](serverGlobalContext, plugin.server.config)
            : plugin.server.exports[prop]
        }
        source.plugins[plugin.name] = phase2Obj
        serverGlobalContext[plugin.name] = phase2Obj
      }
      if (plugin.server.components) {
        plugin.server.components.forEach(c => plugins.components.push(c))
      }
      const wrapHook = (hook) => (ctx) => hook(Object.assign({ config: plugin.server.config }, ctx))

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
          const res = await plugin.server.onBeforeBuild(Object.assign({ config: plugin.server.config }, ctx))
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
      scriptManager.use(plugin.client)
    }
  }
}
