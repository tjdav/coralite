import { definePlugin } from '#lib'

/**
 * @import { ScriptPluginHelperLocalInstance } from '../types/index.js'
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
        return ({ state, root }) => {
          return function (id) {
            const refId = state[`ref_${id}`]

            if (!refId && typeof refId !== 'string') {
              return null
            }

            const selector = `[ref="${refId}"]`
            // Use root context for scoped query when available, fallback to global document
            const context = root || document

            return context.querySelector(selector) || null
          }
        }
      }
    }
  }
})
