import { definePlugin } from '#lib'

export const consumerServerPlugin = definePlugin({
  name: 'consumer-server-plugin',
  server: {
    exports: {
      getServerData: (pluginContext) => () => {
        const db = pluginContext['provider-plugin'].db()
        return () => db.getData()
      }
    }
  }
})
