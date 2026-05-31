import { definePlugin } from '#lib'

export const consumerServerPlugin = definePlugin({
  name: 'consumer-server-plugin',
  server: {
    exports: {
      getServerData: async (context) => {
        const db = await context.registry.resolve('db')
        return () => db.getData()
      }
    }
  }
})
