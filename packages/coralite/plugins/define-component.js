import {
  parseHTML,
  definePlugin,
  isCoraliteComment,
  isCoraliteElement,
  isCoraliteTextNode
} from '#lib'

/**
 * @import { CoraliteElement, CoraliteModuleScript, CoraliteModuleProperties, CoraliteModuleDefinition, CoraliteModuleDefinitions, CoraliteProperties, CoraliteModuleSlotFunction, CoraliteModulePropertiesFunction } from '../types/index.js'
 * @import { ScriptImport } from '../types/script.js'
 */

/**
 * Replaces a custom element with its template content.
 *
 * @param {CoraliteElement} coraliteElement - The custom element to be replaced.
 * @param {CoraliteElement} element - The target element to replace the tokens with.
 */
function replaceCustomElementWithTemplate (coraliteElement, element) {
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
async function processTokenValue (value, context) {
  const { excludeByAttribute, properties, component, createComponentElement, renderContext } = context
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
    const componentElement = await createComponentElement({
      contextId: `${component.path.pathname}${customElement.name}-${i}`,
      id: customElement.name,
      properties,
      element: customElement,
      component: context.component,
      index: i,
      renderContext
    })

    if (componentElement) {
      replaceCustomElementWithTemplate(customElement, componentElement)
    }
  }

  // For static strings, optimize single text nodes
  if (result.root.children.length === 1 && result.root.children[0].type === 'text') {
    return result.root.children[0].data
  }

  return result.root.children
}

export const defineComponent = definePlugin({
  name: 'defineComponent',
  /**
   * This function defines a component plugin for the Coralite framework.
   * It is used to register components with their associated properties and scripts.
   *
   * @param {Object} options - Configuration options for the component
   * @param {CoraliteModulePropertiesFunction} [options.properties] - Component properties setup function or object.
   * @param {Object.<string, CoraliteModuleSlotFunction>} [options.slots] - Computed slots for the component.
   * @param {CoraliteModuleScript} [options.script] - Script function that executes on the client-side.
   * @returns {Promise<CoraliteModuleDefinitions>} A promise resolving to the module properties
   *   associated with this component.
   */
  async method ({
    properties: componentProperties,
    slots,
    script
  },
  context) {
    const {
      properties,
      component,
      root
    } = context
    /** @type {CoraliteModuleDefinitions} */
    let results = Object.assign({}, properties)

    results.__script__ = {
      properties: {},
      defaultValues: {},
      slots: slots || {}
    }

    let initialValues = null
    if (typeof componentProperties === 'function') {
      initialValues = await componentProperties(context)
    } else if (typeof componentProperties === 'object' && componentProperties !== null) {
      initialValues = componentProperties
    }

    if (initialValues) {
      for (const key in initialValues) {
        if (Object.prototype.hasOwnProperty.call(initialValues, key)) {
          let result = initialValues[key]
          results.__script__.defaultValues[key] = result

          if (typeof result === 'function') {
            result = result(results)

            if (result && typeof result?.then === 'function') {
              result = await result
            }
          }

          if (result) {
            results[key] = await processTokenValue(result, {
              ...context,
              properties: results,
              createComponentElement: this.createComponentElement.bind(this)
            })
          } else {
            results[key] = result
          }
        }
      }
    }

    // process computed slots
    if (slots) {
      for (const name in slots) {
        if (Object.prototype.hasOwnProperty.call(slots, name)) {
          const computedSlot = slots[name]

          const methodKey = `slots_method_${name}`
          results.__script__.defaultValues[methodKey] = computedSlot

          // slot content to compute
          const slotContent = []
          // new slot elements
          const elementSlots = []

          if (root && root.slots) {
            for (let i = 0; i < root.slots.length; i++) {
              const slot = root.slots[i]

              if (slot.name === name) {
                // slot content to compute
                slotContent.push(slot.node)
              } else {
                elementSlots.push(slot)
              }
            }
          }

          // compute slot nodes
          const result = computedSlot(slotContent, results) || slotContent

          // append new slot nodes
          if (typeof result === 'string') {
            // process string result through unified processor
            const processedResult = await processTokenValue(result, {
              ...context,
              properties: results,
              createComponentElement: this.createComponentElement.bind(this)
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
                  node
                })
              } else {
                throw new Error('Unexpected slot value, expected a node but found: '
                  + '\n result: ' + JSON.stringify(node)
                  + '\n path: "' + component.path.pathname + '"')
              }
            }
          }

          // update element slots
          if (root) {
            root.slots = elementSlots
          }
        }
      }
    }
    const hasScript = typeof script === 'function'
    const hasProperties = initialValues && Object.keys(initialValues).length > 0
    const hasSlots = slots && Object.keys(slots).length > 0

    if (hasScript || hasProperties || hasSlots) {
      if (hasScript) {
        const scriptTextContent = script.toString().trim()

        // include properties used in script
        /** @type {Object.<string, CoraliteModuleDefinition>} */
        const args = {}
        for (const key in results) {
          if (!Object.hasOwn(results, key)) {
            continue
          }

          if (scriptTextContent.includes(key)) {
            args[key] = results.__script__.defaultValues[key] !== undefined
              ? results.__script__.defaultValues[key]
              : results[key]
          }
        }

        results.__script__.properties = args
      }
    } else {
      // remove custom element parent script
      delete results.__script__
    }

    return results
  }
})

