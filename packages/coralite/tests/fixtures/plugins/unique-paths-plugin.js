import { definePlugin } from '#lib/server/plugin/define.js'

export const uniquePathsPlugin = definePlugin({
  name: 'unique-paths-plugin',
  server: {
    onPageSet () {
      return {
        paths: [{ id: 'unique-from-plugin' }]
      }
    }
  }
})
