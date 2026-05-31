import { definePlugin } from '#lib'

export const consumerClientPlugin = definePlugin({
  name: 'consumer-client-plugin',
  server: {
    exports: {}
  },
  client: {
    context: {
      getClientUtility: async ({ registry }) => {
        const db = await registry.resolve('db')
        return (localContext) => {
          return () => db.performAction()
        }
      }
    }
  }
})
