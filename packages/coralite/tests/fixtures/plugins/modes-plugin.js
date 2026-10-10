import { definePlugin } from 'coralite'

export default definePlugin({
  name: 'modes-plugin',
  modes: ['testing'],
  server: {
    onBeforeBuild () {
      // modes-plugin server hook
    }
  },
  client: {
    context: () => () => ({
      modesPluginActive: true
    })
  }
})
