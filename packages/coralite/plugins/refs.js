import { createPlugin } from '#lib'

export const refsPlugin = createPlugin({
  name: 'refs',
  client: {
    helpers: {
      /**
       * Creates a ref resolver function that maps IDs to DOM elements.
       *
       * @param {import('../types/index.js').CoraliteScriptContent} context - An array of ref attribute values to be mapped
       * @returns {function(string): HTMLElement | null} A function that resolves refs by their ID
       */
      refs ({ values, root }) {
        const elements = {}

        return function (id) {
          if (elements[id]) {
            return elements[id]
          }

          const refId = values[`ref_${id}`]

          if (!refId && typeof refId !== 'string') {
            return null
          }

          // @ts-ignore
          const element = root.getElementById(refId)

          if (element) {
            elements[id] = element
          }

          return element
        }
      }
    }
  }
})
