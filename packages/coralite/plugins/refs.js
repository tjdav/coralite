import { createPlugin } from '#lib'

// Export as plugin for the new system
export const refsPlugin = createPlugin({
  name: 'refs',
  script: {
    helpers: {
      /**
       * Creates a ref resolver function that maps IDs to DOM elements.
       *
       * @param {import('../types/index.js').CoraliteScriptContent} context - An array of data-coralite-ref attribute values to be mapped
       * @returns {function(string): HTMLElement | null} A function that resolves refs by their ID
       */
      refs ({ refs }) {
        const elements = {}

        return function (id) {
          if (elements[id]) {
            return elements[id]
          }

          const refId = refs[id]

          if (!refId) {
            return null
          }

          const element = document.querySelector('[data-coralite-ref="' + refId + '"]')

          if (element) {
            elements[id] = element
          }

          return element
        }
      }
    }
  }
})
