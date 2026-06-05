import { definePlugin } from '#lib'

export const consumerServerPlugin = definePlugin({
  name: 'consumer-server-plugin',
  server: {
    exports: {
      getServerData: (pluginContext) => () => {
        const db = pluginContext.db
        return () => db.getData()
      }
    }
  }
})
