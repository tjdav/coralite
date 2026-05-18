import {
  parseHTML,
  definePlugin,
  isCoraliteComment,
  isCoraliteElement,
  isCoraliteTextNode,
  createReadOnlyProxy
} from '#lib'

/**
 * @import { CoraliteElement, CoraliteModuleScript, CoraliteModuleState, CoraliteModuleDefinition, CoraliteModuleDefinitions, CoraliteState, CoraliteModuleSlotFunction, CoraliteModuleStateFunction, CoraliteModuleDataFunction, CoraliteModuleGetterFunction } from '../types/index.js'
 */

/**
 * Replaces a custom element with its template content.
 *
 * @param {CoraliteElement} coraliteElement - The custom element to be replaced.
 * @param {CoraliteElement} element - The target element to replace the tokens with.
 */
function replaceCustomElementWithTemplate (coraliteElement, element) {
  // update parent references for new children to maintain the correct structure in the document
  for (const child of element.children) {
    child.parent = coraliteElement.parent
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
  const { excludeByAttribute, state, module, createComponentElement, renderContext } = context
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
      contextId: `${module.path.pathname}${customElement.name}-${i}`,
      id: customElement.name,
      state,
      element: customElement,
      module,
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
   * It is used to register components with their associated state and scripts.
   *
   * @param {Object} options - Configuration options for the component
   * @param {Object.<string, { type: any, default?: any }>} [options.attributes] - Component attributes schema.
   * @param {CoraliteModuleDataFunction} [options.data] - Component data fetching function (build-time).
   * @param {Object.<string, CoraliteModuleGetterFunction>} [options.getters] - Isomorphic getters.
   * @param {Object.<string, CoraliteModuleSlotFunction>} [options.slots] - Computed slots for the component.
   * @param {CoraliteModuleScript} [options.script] - Script function that executes on the client-side.
   * @returns {Promise<CoraliteModuleDefinitions>} A promise resolving to the module state
   *   associated with this component.
   */
  async exports ({
    attributes,
    data,
    getters,
    slots,
    script
  }) {
    const {
      state: initialState,
      module,
      root
    } = this

    // Validate attributes
    if (attributes) {
      for (const [key, value] of Object.entries(attributes)) {
        if (value.type === Object || value.type === Array) {
          throw new Error(`Coralite Error: Component "${module.id}" defines attribute "${key}" as ${value.type.name}. Object and Array types are blocked in attributes for V1.1 to prevent "JSON-in-HTML" anti-patterns. Use the data() block for complex data.`)
        }
      }
    }
    /** @type {CoraliteModuleDefinitions} */
    let state = Object.assign({}, initialState)

    const serializableAttributes = {}
    if (attributes) {
      for (const [key, schema] of Object.entries(attributes)) {
        serializableAttributes[key] = {
          type: schema.type.name || schema.type,
          default: schema.default
        }
      }
    }

    state.__script__ = {
      attributes: serializableAttributes,
      getters: getters || {},
      state: {},
      defaultValues: {},
      slots: slots || {}
    }

    if (attributes) {
      for (const [key, schema] of Object.entries(attributes)) {
        const typeName = schema.type.name || schema.type
        if (state[key] !== undefined) {
          // Coerce existing attribute values
          const value = state[key]
          if (typeName === 'Number') {
            state[key] = Number(value)
          } else if (typeName === 'Boolean') {
            state[key] = value !== 'false' && value !== null && value !== ''
          } else if (typeName === 'String') {
            state[key] = String(value)
          }
        } else if (schema.default !== undefined) {
          state[key] = schema.default
        }
      }
    }

    if (typeof data === 'function') {
      const dataResult = await data(this)
      if (dataResult) {
        state.__script__.data = dataResult
        Object.assign(state, dataResult)
        // Ensure data results are added to state.__script__.state for serialization to client
        Object.assign(state.__script__.state, dataResult)
      }
    }

    if (getters) {
      /** @type {any} */
      const roState = createReadOnlyProxy(state)
      for (const [key, getter] of Object.entries(getters)) {
        // Ensure getters use read-only proxy to preemptively throw error if developer attempts to mutate the state.
        const result = getter(roState, { signal: new AbortController().signal })

        if (result && typeof result.then === 'function') {
          state[key] = await result
        } else {
          state[key] = result
        }

        // Add getter result to state.__script__.state so it's serialized to the client
        state.__script__.state[key] = state[key]
      }
    }

    // process computed slots
    if (slots) {
      for (const name in slots) {
        if (Object.prototype.hasOwnProperty.call(slots, name)) {
          const computedSlot = slots[name]

          const methodKey = `slots_method_${name}`
          state.__script__.defaultValues[methodKey] = computedSlot

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
          const result = computedSlot(slotContent, state) || slotContent

          // append new slot nodes
          if (typeof result === 'string') {
            // process string result through unified processor
            const processedResult = await processTokenValue(result, {
              ...this,
              state,
              createComponentElement: this.app.createComponentElement
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
                  + '\n path: "' + module.path.pathname + '"')
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
    const hasSlots = slots && Object.keys(slots).length > 0
    const hasGetters = getters && Object.keys(getters).length > 0
    const hasAttributes = attributes && Object.keys(attributes).length > 0

    if (hasScript || hasSlots || hasGetters || hasAttributes) {
      if (hasScript) {
        const scriptTextContent = script.toString().trim()

        // include state used in script
        /** @type {Object.<string, CoraliteModuleDefinition>} */
        const args = {}
        for (const key in state) {
          if (!Object.hasOwn(state, key)) {
            continue
          }

          if (scriptTextContent.includes(key)) {
            args[key] = state.__script__.defaultValues[key] !== undefined
              ? state.__script__.defaultValues[key]
              : state[key]
          }
        }

        state.__script__.state = args
      }
    } else {
      // remove custom element parent script
      delete state.__script__
    }

    return state
  }
})
