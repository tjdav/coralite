import { definePlugin } from '#lib'

export const providerPlugin = definePlugin({
  name: 'provider-plugin',
  server: {
    onBeforeBuild: async ({ app }) => {
      // Artificial delay to test async resolution
      await new Promise(resolve => setTimeout(resolve, 50))
      app.registry.register('db', {
        getData: () => 'Server Data from DB'
      })
    }
  },
  client: {
    setup: async ({ registry }) => {
      // Artificial delay to test async resolution
      await new Promise(resolve => setTimeout(resolve, 50))
      registry.register('db', {
        performAction: () => 'Client Action Performed'
      })
    }
  }
})
