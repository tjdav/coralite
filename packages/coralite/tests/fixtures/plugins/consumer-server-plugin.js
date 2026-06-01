import { definePlugin } from '#lib'

export const consumerServerPlugin = definePlugin({
  name: 'consumer-server-plugin',
  server: {
    exports: {
      getServerData: (globalContext) => (instanceContext) => {
        const db = globalContext.db
        return () => db.getData()
      }
    }
  }
})
