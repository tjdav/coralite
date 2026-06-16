import { definePlugin } from '#lib'

export const consumerServerPlugin = definePlugin({
  name: 'consumer-server-plugin',
  server: {
    context: () => {
      return (instanceContext) => ({
        getServerData: () => {
          const provider = instanceContext['provider-plugin']
          const db = provider.db()
          return db.getData()
        }
      })
    }
  }
})
