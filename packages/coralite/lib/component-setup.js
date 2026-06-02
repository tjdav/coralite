import { createReadOnlyProxy } from './utils.js'
import { processTokenValue } from './parser.js'
import {
  isCoraliteElement,
  isCoraliteTextNode,
  isCoraliteComment
} from './type-helper.js'

/**
 * @import {
 *  CoralitePluginContext,
 *  CoraliteInstance
 * } from '../types/index.js'
 */

/**
 * Factory to create the component definition function.
 *
 * @param {Object} dependencies
 * @param {CoraliteInstance} dependencies.app
 * @returns {Function}
 */
export function createComponentDefinition ({ app }) {
  /**
   * This function defines a component for the Coralite framework.
   * @param {Object} options - Configuration options for the component
   * @param {CoralitePluginContext} context - The evaluation context
   * @returns {Promise<Object>}
   */
  return async (options, context) => {
    const { attributes, data, getters, slots, script } = options
    const { state: initialState, module, root } = context

    if (attributes) {
      for (const [key, value] of Object.entries(attributes)) {
        if (value.type === Object || value.type === Array) {
          throw new Error(`Coralite Error: Component "${module.id}" defines attribute "${key}" as ${value.type.name}. Object and Array types are blocked in attributes. Use data() for complex data.`)
        }
      }
    }

    const state = Object.assign({}, initialState)
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
      const dataResult = await data({
        ...context,
        ...initialState
      })
      if (dataResult) {
        state.__script__.data = dataResult
        Object.assign(state, dataResult)
        Object.assign(state.__script__.state, dataResult)
      }
    }

    if (getters) {
      const roState = createReadOnlyProxy(state)
      for (const [key, getter] of Object.entries(getters)) {
        const result = getter(roState, { signal: new AbortController().signal })
        state[key] = (result && typeof result.then === 'function') ? await result : result
        if (state.__script__ && state.__script__.state) {
          state.__script__.state[key] = state[key]
        }
      }
    }

    if (slots) {
      for (const name in slots) {
        if (Object.prototype.hasOwnProperty.call(slots, name)) {
          const computedSlot = slots[name]
          const methodKey = `slots_method_${name}`
          state.__script__.defaultValues[methodKey] = computedSlot
          const slotContent = []
          const elementSlots = []

          if (root && 'slots' in root) {
            for (let j = 0; j < root.slots.length; j++) {
              const slot = root.slots[j]

              if (slot.name === name) {
                slotContent.push(slot.node)
              } else {
                elementSlots.push(slot)
              }
            }
          }

          let result = computedSlot(slotContent, state)
          if (result === undefined) {
            result = slotContent
          }
          if (result === null || result === '' || (Array.isArray(result) && result.length === 0)) {
            if (root && 'slots' in root) {
              root.slots = root.slots.filter(s => s.name !== name)
            }

            continue
          }

          if (typeof result === 'string') {
            const processedResult = await processTokenValue(result, {
              ...context,
              state,
              createComponentElement: app.createComponentElement,
              noHydration: context.noHydration
            })
            if (Array.isArray(processedResult)) {
              for (let j = 0; j < processedResult.length; j++) {
                elementSlots.push({
                  name,
                  node: processedResult[j]
                })
              }
            } else {
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
              if (isCoraliteElement(node) || isCoraliteTextNode(node) || isCoraliteComment(node)) {
                elementSlots.push({
                  name,
                  node
                })
              } else {
                throw new Error(`Unexpected slot value in "${module.path.pathname}"`)
              }
            }
          }

          if (root && 'slots' in root) {
            root.slots = elementSlots
          }
        }
      }
    }

    const hasScript = typeof script === 'function'
    const hasSlots = slots && Object.keys(slots).length > 0
    const hasGetters = getters && Object.keys(getters).length > 0
    const hasAttributes = attributes && Object.keys(attributes).length > 0
    const hasData = typeof data === 'function'

    if (hasScript || hasSlots || hasGetters || hasAttributes || hasData) {
      if (hasScript) {
        const scriptTextContent = script.toString().trim()
        const args = {}
        for (const key in state) {
          if (!Object.hasOwn(state, key)) {
            continue
          }
          if (scriptTextContent.includes(key) || key.startsWith('ref_')) {
            args[key] = state.__script__.defaultValues[key] !== undefined
              ? state.__script__.defaultValues[key]
              : state[key]
          }
        }
        Object.assign(state.__script__.state, args)
      }
    } else {
      delete state.__script__
    }

    return state
  }
}
