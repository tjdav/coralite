export default {
  name: 'mock-plugin',
  client: {
    context: {
      // Phase 1: Global Context
      renderPluginChild: async (globalContext) => {
        // Dynamically resolve mock-module.js
        const mod = await import('./mock-module.js')
        // Phase 2: Local Instance Context
        return (localContext) => {
          // Phase 3: The actual callable utility expecting a target element
          return async (containerElement) => {
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
}
