import { definePlugin } from '#lib'

export const consumerServerPlugin = definePlugin({
  name: 'consumer-server-plugin',
  server: {
    context: () => {
      return (instanceContext) => {
        const provider = instanceContext['provider-plugin']

        return {
          getServerData: () => {
            const db = provider.db()
            return db.getData()
          },
          getInterPluginData: () => {
            return provider.getOtherData()
          }
        }
      }
    }
  }
})
