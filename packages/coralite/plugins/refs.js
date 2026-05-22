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
        return ({ state }) => {
          return function (id) {
            const refId = state[`ref_${id}`]

            if (!refId && typeof refId !== 'string') {
              return null
            }

            return document.querySelector(`[ref="${refId}"]`)
          }
        }
      }
    }
  }
})
