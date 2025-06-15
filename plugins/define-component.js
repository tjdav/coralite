import {
  parseHTML,
  createPlugin,
  isCoraliteComment,
  isCoraliteElement,
  isCoraliteTextNode
} from '#lib'

/**
 * @import { CoraliteElement, CoraliteModuleValues } from '#types'
 */

export const defineComponent = createPlugin({
  name: 'defineComponent',
  /**
   * This function defines a component plugin for the Coralite framework.
   * It is used to register components with their associated tokens and slots.
   *
   * @param {Object} options - Configuration options for the component
   * @param {Object.<string, (string | function)>} options.tokens -
   *   Computed tokens that will be available in the template. These can be
   *   strings or functions that return values.
   * @param {Object.<string, Function>} options.slots -
   *   Computed slots for the component. These are functions that define
   *   how content should be rendered within the component.
   * @returns {Promise<CoraliteModuleValues>} A promise resolving to the module values
   *   associated with this component.
   */
  async method (options, { values, document, element, excludeByAttribute }) {
    /** @type {CoraliteModuleValues} */
    const results = { ...values }
    const computedValueCollection = []
    const computedTokenKey = []

    if (options.tokens) {
      for (const key in options.tokens) {
        if (Object.prototype.hasOwnProperty.call(options.tokens, key)) {
          const token = options.tokens[key]

          if (typeof token === 'function') {
            const result = token(values) || ''

            if (typeof result.then === 'function') {
              computedValueCollection.push(result)
              computedTokenKey.push(key)
            } else {
              results[key] = result
            }
          }

          if (typeof results[key] === 'string') {
            const result = parseHTML(results[key], excludeByAttribute)
            const children = result.root.children

            if (children.length) {
              if (children.length === 1 && children[0].type === 'text') {
                results[key] = children[0].data
              } else {
                for (let i = 0; i < result.customElements.length; i++) {
                  const customElement = result.customElements[i]
                  // create a component instance from the custom element and its attributes
                  const component = await this.createComponent({
                    id: customElement.name,
                    values,
                    element: customElement,
                    document
                  })

                  if (component) {
                    replaceCustomElementWithTemplate(customElement, component)
                  }
                }

                results[key] = children
              }
            }
          }
        }
      }
    }

    if (computedValueCollection.length) {
      try {
        const computedValues = await Promise.all(computedValueCollection)

        for (let i = 0; i < computedValues.length; i++) {
          const computedValue = computedValues[i]
          const key = computedTokenKey[i]

          if (typeof computedValue === 'string') {
            const result = parseHTML(computedValue, excludeByAttribute)

            if (result.root.children.length) {
              for (let i = 0; i < result.customElements.length; i++) {
                const customElement = result.customElements[i]
                // create a component instance from the custom element and its attributes
                const component = await this.createComponent({
                  id: customElement.name,
                  values,
                  element: customElement,
                  document
                })

                if (component) {
                  replaceCustomElementWithTemplate(customElement, component)
                }
              }

              results[key] = result.root.children
            }
          } else {
            results[key] = computedValue
          }
        }
      } catch (error) {
        console.log(error)
      }
    }

    // process computed slots
    if (options.slots) {
      for (const name in options.slots) {
        if (Object.prototype.hasOwnProperty.call(options.slots, name)) {
          const computedSlot = options.slots[name]
          // slot content to compute
          const slotContent = []
          // new slot elements
          const elementSlots = []

          for (let i = 0; i < element.slots.length; i++) {
            const slot = element.slots[i]

            // exclude empty strings
            if (slot.node.type === 'text' && !slot.node.data.trim()) {
              continue
            }

            if (slot.name === name) {
              // slot content to compute
              slotContent.push(slot.node)
            } else {
              elementSlots.push(slot)
            }
          }

          // compute slot nodes
          const result = computedSlot(slotContent, results) || slotContent

          // append new slot nodes
          if (typeof result === 'string') {
            elementSlots.push({
              name,
              node: {
                type: 'text',
                data: result
              }
            })
          } else if (Array.isArray(result)) {
            for (let index = 0; index < result.length; index++) {
              const node = result[index]

              if (
                isCoraliteElement(node)
                || isCoraliteTextNode(node)
                || isCoraliteComment(node)
              ) {
                elementSlots.push({
                  name,
                  node: result[index]
                })
              } else {
                throw new Error('Unexpected slot value, expected a node but found: '
                  + '\n result: ' + JSON.stringify(node)
                  + '\n component: "' + module.id + '"'
                  + '\n path: "' + document.path.pathname +'"')
              }
            }
          }

          // update element slots
          element.slots = elementSlots
        }
      }
    }

    return results
  }
})

/**
 * Replaces a custom element with its template content.
 *
 * @param {CoraliteElement} coraliteElement - The custom element to be replaced.
 * @param {CoraliteElement} element - The target element to replace the tokens with.
 */
async function replaceCustomElementWithTemplate (coraliteElement, element) {
  // update parent references for new children to maintain the correct structure in the document
  for (let i = 0; i < element.children.length; i++) {
    element.children[i].parent = coraliteElement.parent
  }

  // determine the index of the original custom element within its parent's child list
  const index = coraliteElement.parent.children.indexOf(coraliteElement, coraliteElement.parentChildIndex)

  // replace the custom element with its template children in the document structure
  coraliteElement.parent.children.splice(index, 1, ...element.children)
}
