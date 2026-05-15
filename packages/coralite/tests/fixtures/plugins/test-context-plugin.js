import { definePlugin } from '../../../lib/index.js'

export const testContextPlugin = definePlugin({
  name: 'test-context-plugin',
  client: {
    config: {
      globalValue: 'global-state-123'
    },
    context: {
      testHelper: (globalContext) => {
        // Phase 1: Global Context
        return (localContext) => {
          // Phase 2: Local Instance Context (receives state, page, signal)
          return function (selector) {
            // Phase 3: Callable utility
            const element = document.querySelector(selector)
            if (element) {
              element.textContent = `Global: ${globalContext.config.globalValue}, Path: ${localContext.page.url.pathname}, Signal: ${localContext.signal instanceof AbortSignal}`
            }
            return element
          }
        }
      }
    }
  }
})
