import { definePlugin } from '../../../lib/index.js'

export const mockPlugin = definePlugin({
  name: 'mock-plugin',
  client: {
    context: async () => {
      // Phase 1: Global Context
      const mod = await import('./mock-module.js')
      return () => {
        // Phase 2: Local Instance Context
        return {
          renderPluginChild: async (containerElement) => {
            if (!containerElement || !containerElement.replaceWith) {
              throw new Error('renderPluginChild requires a valid DOM element to replace.')
            }

            const child = document.createElement('plugin-injected-child')

            child.textContent = mod.default()

            // Respect component encapsulation: Replace the specific target
            containerElement.replaceWith(child)
          }
        }
      }
    }
  }
})
