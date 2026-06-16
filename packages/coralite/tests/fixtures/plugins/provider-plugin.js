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
      // ✨ EXPOSE TO DOWNSTREAM PLUGINS
      pluginContext.db = db
      return () => ({
        db: () => db
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
      // ✨ EXPOSE TO DOWNSTREAM PLUGINS
      pluginContext.db = db
      return () => ({
        db: () => db
      })
    }
  }
})
