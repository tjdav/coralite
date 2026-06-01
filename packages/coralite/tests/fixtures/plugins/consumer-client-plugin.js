import { definePlugin } from '#lib'

export const consumerClientPlugin = definePlugin({
  name: 'consumer-client-plugin',
  server: {
    exports: {}
  },
  client: {
    context: {
      getClientUtility: async (globalContext) => {
        const db = globalContext.db
        return (localContext) => {
          return () => db.performAction()
        }
      }
    }
  }
})
