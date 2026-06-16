import { definePlugin } from '#lib'

export const consumerServerPlugin = definePlugin({
  name: 'consumer-server-plugin',
  server: {
    context: (pluginContext) => {
      return () => ({
        getServerData: () => {
          const db = pluginContext.db
          return db.getData()
        }
      })
    }
  }
})
