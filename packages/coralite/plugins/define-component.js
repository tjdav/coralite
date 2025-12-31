import {
  parseHTML,
  createPlugin,
  isCoraliteComment,
  isCoraliteElement,
  isCoraliteTextNode
} from '#lib'

/**
 * @import { CoraliteElement, CoraliteModuleScript, CoraliteModuleValues } from '../types/index.js'
 */


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

/**
 * Process a token value - parse HTML strings and handle custom elements
 * @param {any} value - The value to process
 * @param {Object} context - Processing context
 * @returns {Promise<any>} - Processed value
 */
async function processTokenValue (value, { excludeByAttribute, values, document, createComponent }) {
  // If not a string, return as-is
  if (typeof value !== 'string') {
    return value
  }

  // Parse HTML string
  const result = parseHTML(value, excludeByAttribute)

  // If no children, return undefined (for empty HTML)
  if (!result.root.children.length) {
    return undefined
  }

  // Process custom elements
  for (let i = 0; i < result.customElements.length; i++) {
    const customElement = result.customElements[i]
    const component = await createComponent({
      id: customElement.name,
      values,
      element: customElement,
      document
    })

    if (component) {
      replaceCustomElementWithTemplate(customElement, component)
    }
  }

  // For static strings, optimize single text nodes
  if (result.root.children.length === 1 && result.root.children[0].type === 'text') {
    return result.root.children[0].data
  }

  return result.root.children
}

export const defineComponent = createPlugin({
  name: 'defineComponent',
  /**
   * This function defines a component plugin for the Coralite framework.
   * It is used to register components with their associated tokens and slots.
   *
   * @param {Object} options - Configuration options for the component
   * @param {Object.<string, (string | function)>} [options.tokens] -
   *   Computed tokens that will be available in the template. These can be
   *   strings or functions that return values.
   * @param {Object.<string, Function>} [options.slots] -
   *   Computed slots for the component. These are functions that define
   *   how content should be rendered within the component.
   * @param {CoraliteModuleScript} [options.script] - Script that will be added below the element.
   * @returns {Promise<CoraliteModuleValues>} A promise resolving to the module values
   *   associated with this component.
   */
  async method ({
    tokens,
    slots,
    script
  },
  {
    values,
    document,
    element,
    excludeByAttribute
  }) {
    /** @type {CoraliteModuleValues} */
    const results = { ...values }

    if (typeof tokens === 'object' && tokens !== null) {
      for (const key in tokens) {
        if (Object.prototype.hasOwnProperty.call(tokens, key)) {
          const token = tokens[key]
          let result = token

          // check if the token is a function to compute its value
          if (typeof token === 'function') {
            result = token(values)
          }

          // process the string token using unified token processor
          results[key] = await processTokenValue(result, {
            excludeByAttribute,
            values,
            document,
            createComponent: this.createComponent.bind(this)
          })
        }
      }
    }

    // process computed slots
    if (slots) {
      for (const name in slots) {
        if (Object.prototype.hasOwnProperty.call(slots, name)) {
          const computedSlot = slots[name]
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
            // process string result through unified processor
            const processedResult = await processTokenValue(result, {
              excludeByAttribute,
              values: results,
              document,
              createComponent: this.createComponent.bind(this)
            })

            if (Array.isArray(processedResult)) {
              // multiple nodes from parsed HTML
              for (let i = 0; i < processedResult.length; i++) {
                elementSlots.push({
                  name,
                  node: processedResult[i]
                })
              }
            } else {
              // single text node
              elementSlots.push({
                name,
                node: {
                  type: 'text',
                  data: processedResult
                }
              })
            }
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
                  + '\n path: "' + document.path.pathname +'"')
              }
            }
          }

          // update element slots
          element.slots = elementSlots
        }
      }
    }

    if (typeof script === 'function') {
      const scriptTextContent = script.toString().trim()

      // include values used in script
      /** @type {CoraliteModuleValues} */
      const args = {}
      for (const key in results) {
        if (!Object.hasOwn(results, key)) continue

        if (scriptTextContent.includes(key)) {
          args[key] = results[key]
        }
      }

      results.__script__ = {
        fn: script,
        values: args
      }
    } else {
      // remove custom element parent script
      delete results.__script__
    }

    return results
  }
})

