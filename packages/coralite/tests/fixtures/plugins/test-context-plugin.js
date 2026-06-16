import { definePlugin } from '#lib'

export const testContextPlugin = definePlugin({
  name: 'test-context-plugin',
  server: {
    context: () => {
      return (context) => ({
        getPluginMessage: (name) => {
          return `Hello ${name} from server-side plugin! Page: ${context.page.url.pathname}`
        }
      })
    }
  },
  client: {
    config: {
      globalValue: 'global-state-123'
    },
    context: (pluginContext) => (localContext) => {
      return {
        testHelper: function (element) {
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
})
