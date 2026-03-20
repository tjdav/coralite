import { createPlugin } from '#lib'

export const refsPlugin = createPlugin({
  name: 'refs',
  client: {
    client: {
      helpers: {
        /**
         * Creates a ref resolver function that maps IDs to DOM elements.
         *
         * @param {Object} globalContext - The global context
         * @returns {function(Object): function(string): HTMLElement | null} A function that resolves refs by their ID
         */
        refs (globalContext) {
          return function (localContext) {
            const { values, document: contextDocument, root } = localContext
            const elements = {}
            const doc = (root && 'getElementById' in root && typeof root.getElementById === 'function')
              ? root
              : ((contextDocument && 'getElementById' in contextDocument && typeof contextDocument.getElementById === 'function')
                ? contextDocument
                : (typeof document !== 'undefined' ? document : null))

            return function (id) {
              if (elements[id]) {
                return elements[id]
              }

              const refId = values[`ref_${id}`]

              if (!refId && typeof refId !== 'string') {
                return null
              }

              // @ts-ignore
              const element = doc ? doc.getElementById(refId) : null

              if (element) {
                elements[id] = element
              }

              return element
            }
          }
        }
      }
    }
  }
})
