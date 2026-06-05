import { definePlugin } from '#lib'

export const providerPlugin = definePlugin({
  name: 'provider-plugin',
  server: {
    exports: {
      db: async (pluginContext) => {
        // Artificial delay to test async resolution
        await new Promise(resolve => setTimeout(resolve, 50))
        const db = {
          getData: () => 'Server Data from DB'
        }
        // ✨ EXPOSE TO DOWNSTREAM PLUGINS
        pluginContext.db = db
        return () => db
      }
    }
  },
  client: {
    context: {
      db: async (pluginContext) => {
        // Artificial delay to test async resolution
        await new Promise(resolve => setTimeout(resolve, 50))
        const db = {
          performAction: () => 'Client Action Performed'
        }
        // ✨ EXPOSE TO DOWNSTREAM PLUGINS
        pluginContext.db = db
        return () => db
      }
    }
  }
})
