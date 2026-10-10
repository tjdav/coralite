import { definePlugin } from 'coralite'

export default definePlugin({
  name: 'dependent-plugin',
  dependencies: ['init-plugin'],
  client: {
    init () {
      if (typeof window !== 'undefined') {
        window.__dependentPluginRan = true
        window.__initOrder = window.__initOrder || []
        window.__initOrder.push('dependent-plugin')
      }
    }
  }
})
