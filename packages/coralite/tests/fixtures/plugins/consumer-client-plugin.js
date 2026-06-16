import { definePlugin } from '#lib'

export const consumerClientPlugin = definePlugin({
  name: 'consumer-client-plugin',
  server: {
    context: () => () => ({})
  },
  client: {
    context: async () => {
      return (instanceContext) => ({
        getClientUtility: () => {
          const provider = instanceContext['provider-plugin']
          const db = provider.db()
          return db.performAction()
        }
      })
    }
  }
})
