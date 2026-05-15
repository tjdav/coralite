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
        return ({ state, root }) => {
          return function (id) {
            const refId = state[`ref_${id}`]

            if (!refId && typeof refId !== 'string') {
              return null
            }

            const selector = `[ref="${refId}"]`
            // use root context for scoped query when available
            const element = (root || document).querySelector(selector)

            if (!element && !root) {
              // fallback to global query if root is missing (declarative)
              return document.querySelector(selector)
            }

            return element
          }
        }
      }
    }
  }
})
