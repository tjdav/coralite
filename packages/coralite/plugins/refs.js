import { definePlugin } from '#lib'

/**
 * @import { ScriptPluginHelperGlobalContext, ScriptPluginHelperLocalInstance } from '../types/index.js'
 */

export const refsPlugin = definePlugin({
  name: 'refs',
  client: {
    context: {
      /**
       * Creates a ref resolver function that maps IDs to DOM elements.
       *
       * @returns {ScriptPluginHelperLocalInstance}
       */
      refs () {
        return ({ state }) => {
          const elements = {}

          return function (id) {
            if (elements[id]) {
              return elements[id]
            }

            const refId = state[`ref_${id}`]

            if (!refId && typeof refId !== 'string') {
              return null
            }

            const element = document.querySelector(`[ref="${refId}"]`)

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
