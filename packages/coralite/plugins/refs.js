import { definePlugin } from '#lib'

/**
 * @import { ScriptPluginHelperLocalInstance } from '../types/index.js'
 */

export const refsPlugin = definePlugin({
  name: 'refs',
  server: {
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
    }
  },
  client: {
    onBeforeComponentRender: ({ state, instanceId, element, options }) => {
      // @ts-ignore
      const hydrationMap = options.hydrationMap

      if (hydrationMap && hydrationMap.refs) {
        for (const ref of hydrationMap.refs) {
          const uniqueRefValue = `${instanceId}__${ref.name}`

          // Update state if not already set (e.g. by SSR hydration)
          if (!state[`ref_${ref.name}`]) {
            state[`ref_${ref.name}`] = uniqueRefValue
          }

          // Update the actual DOM element if it exists
          // Since this is client side, we need to find the node
          if (hydrationMap && hydrationMap.refs) {
            const refMap = hydrationMap.refs.find(r => r.name === ref.name)
            if (refMap) {
              const node = element.getNodeByPath(refMap.path)
              if (node && node.setAttribute) {
                node.setAttribute('ref', uniqueRefValue)
              }
            }
          }
        }
      }
    },
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

            return root.querySelector(`[ref="${refId}"]`)
          }
        }
      }
    }
  }
})
