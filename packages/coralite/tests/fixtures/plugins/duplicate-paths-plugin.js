import { definePlugin } from '#lib/server/plugin/define.js'

export const duplicatePathsPlugin = definePlugin({
  name: 'duplicate-paths-plugin',
  server: {
    onPageSet () {
      return {
        paths: [{ id: 'intro' }]
      }
    }
  }
})
