import { definePlugin } from '#lib'

export const providerPlugin = definePlugin({
  name: 'provider-plugin',
  server: {
    context: async (pluginContext) => {
      // Artificial delay to test async resolution
      await new Promise(resolve => setTimeout(resolve, 50))
      const db = {
        getData: () => 'Server Data from DB'
      }
      pluginContext.db = db

      return (instanceContext) => ({
        db: () => db,
        getOtherData: () => {
          const testPlugin = instanceContext['test-context-plugin']
          return testPlugin.getPluginMessage('Provider')
        }
      })
    }
  },
  client: {
    context: async (pluginContext) => {
      // Artificial delay to test async resolution
      await new Promise(resolve => setTimeout(resolve, 50))
      const db = {
        performAction: () => 'Client Action Performed'
      }
      pluginContext.db = db

      return () => ({
        db: () => db,
        getOtherData: () => {
          // Client side equivalent if needed, though the task mostly mentioned server-side interop
          return 'Client Other Data'
        }
      })
    }
  }
})
