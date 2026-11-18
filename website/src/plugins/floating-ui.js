import { definePlugin } from 'coralite'

export default definePlugin({
  name: '$floating',
  client: {
    context: () => () => ({
      /**
       * Positions a floating element against a reference element.
       *
       * @param {Object} options - Floating element configuration.
       * @param {Element} options.reference - Anchor element.
       * @param {HTMLElement} options.floating - Element to position.
       * @param {HTMLElement} [options.arrow] - Optional arrow element.
       * @param {import('@floating-ui/dom').Placement} [options.placement] - Preferred placement.
       * @param {(cleanup: () => void) => void} [options.onCleanup] - Receives the auto-update cleanup function.
       * @returns {Promise<() => void>} Cleanup function returned by autoUpdate.
       */
      createFloating: async ({ reference, floating, arrow, placement = 'top', onCleanup }) => {
        const {
          computePosition,
          autoUpdate,
          offset,
          flip,
          shift,
          arrow: arrowMiddleware
        } = await import('@floating-ui/dom')

        const update = async () => {
          const middleware = [offset(8), flip(), shift({ padding: 8 })]
          if (arrow) middleware.push(arrowMiddleware({ element: arrow }))

          const { x, y, placement: finalPlacement, middlewareData } = await computePosition(
            reference,
            floating,
            { placement, middleware }
          )

          floating.setAttribute('data-placement', finalPlacement)

          Object.assign(floating.style, {
            left: `${x}px`,
            top: `${y}px`,
            position: 'absolute'
          })

          if (arrow && middlewareData.arrow) {
            const { x: arrowX, y: arrowY } = middlewareData.arrow
            const staticSide = {
              top: 'bottom',
              right: 'left',
              bottom: 'top',
              left: 'right'
            }[finalPlacement.split('-')[0]]

            Object.assign(arrow.style, {
              left: arrowX != null ? `${arrowX}px` : '',
              top: arrowY != null ? `${arrowY}px` : '',
              right: '',
              bottom: '',
              [staticSide]: '-4px'
            })
          }
        }

        const cleanup = autoUpdate(reference, floating, update)
        if (onCleanup) onCleanup(cleanup)
        return cleanup
      }
    })
  }
})
