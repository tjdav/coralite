import { definePlugin } from 'coralite'

export default definePlugin({
  name: 'init-plugin',
  client: {
    init () {
      if (typeof window !== 'undefined') {
        window.__initPluginRan = true
        window.__initOrder = window.__initOrder || []
        window.__initOrder.push('init-plugin')
      }
    }
  }
})
