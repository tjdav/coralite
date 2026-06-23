import { definePlugin } from '../../../lib/index.js'

export const configTypesPlugin = definePlugin({
  name: 'configTypes',
  server: {
    context: () => {
      return () => ({})
    }
  },
  client: {
    config: {
      regex: /test-regex/g,
      date: new Date('2024-01-01T00:00:00.000Z'),
      func: (a, b) => a + b,
      map: new Map([['key', 'value']]),
      set: new Set([1, 2, 3])
    },
    context: (pluginContext) => {
      return () => {
        return {
          getConfig: () => pluginContext.config
        }
      }
    }
  }
})
