import { createPlugin } from '#lib'

export const refsPlugin = createPlugin({
  name: 'refs',
  client: {
    helpers: {
      /**
       * Creates a ref resolver function that maps IDs to DOM elements.
       *
       * @param {import('../types/index.js').ScriptPluginHelperGlobalContext} globalContext
       * @returns {import('../types/index.js').ScriptPluginHelperLocalInstance}
       */
      refs (globalContext) {
        return ({ values, root }) => {
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
            const element = root.querySelector(`[ref="${refId}"]`)

            if (element) {
              elements[id] = element
            }

            return element
          }
        }
      }
    }
  }
})
