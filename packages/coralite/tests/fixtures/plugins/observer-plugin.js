import { definePlugin } from '#lib'

export const observerPlugin = definePlugin({
  name: 'observer-plugin',
  server: {
    context: (pluginContext) => {
      // Access db from provider-plugin mutation in Phase 1
      const db = pluginContext.db
      return () => ({
        getObservedData: () => (db ? db.getData() : 'DB NOT FOUND')
      })
    }
  }
})
