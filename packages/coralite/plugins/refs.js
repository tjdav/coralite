import { definePlugin } from '#lib'

/**
 * @import { ScriptPluginHelperLocalInstance } from '../types/index.js'
 */

export const refsPlugin = definePlugin({
  name: 'refs',
  onBeforeComponentRender: ({ state, instanceId, refs }) => {
    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i]
      const uniqueRefValue = `${instanceId}__${ref.name}`

      // Update the ref attribute value to be unique
      if (ref.element && ref.element.attribs) {
        ref.element.attribs.ref = uniqueRefValue
      }

      // inject flat token into component state
      state[`ref_${ref.name}`] = uniqueRefValue
    }
  },
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
