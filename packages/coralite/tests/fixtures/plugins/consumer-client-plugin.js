import { definePlugin } from '#lib'

export const consumerClientPlugin = definePlugin({
  name: 'consumer-client-plugin',
  server: {
    context: () => () => ({})
  },
  client: {
    context: async (globalContext) => {
      const db = globalContext.db
      return () => ({
        getClientUtility: () => {
          return db.performAction()
        }
      })
    }
  }
})
