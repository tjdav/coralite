import { definePlugin } from '#lib'

export const testContextPlugin = definePlugin({
  name: 'test-context-plugin',
  server: {
    exports: {
      getPluginMessage: (globalContext) => (instanceContext) => (name) => {
        return `Hello ${name} from server-side plugin! Page: ${instanceContext.page.url.pathname}`
      }
    }
  },
  client: {
    config: {
      globalValue: 'global-state-123'
    },
    context: {
      testHelper: (pluginContext) => {
        // Phase 1: Global Context
        return (localContext) => {
          // Phase 2: Local Instance Context (receives state, page, signal)
          return function (element) {
            // Phase 3: Callable utility
            if (typeof element === 'string') {
              element = document.querySelector(element)
            }
            if (element) {
              element.textContent = `Global: ${pluginContext.config?.globalValue}, InstanceId: ${localContext.instanceId}, Signal: ${localContext.signal instanceof AbortSignal}`
            }
            return element
          }
        }
      }
    }
  }
})
