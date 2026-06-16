import { createReadOnlyProxy } from './utils/core.js'
import { processTokenValue } from './parser.js'
import { CoraliteError } from './utils/errors.js'
import {
  isCoraliteElement,
  isCoraliteTextNode,
  isCoraliteComment
} from './utils/types.js'
import { findAndExtractScript, findAndExtractProperties } from './utils/server/server.js'

/**
 * @import {
 *  CoralitePluginContext,
 *  CoraliteInstance
 * } from '../types/index.js'
 */

/**
 * Factory to create the component definition function.
 *
 * @param {Object} dependencies - The dependencies required to create the component definition.
 * @param {CoraliteInstance} dependencies.app - The global Coralite app instance.
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
    const { attributes, server, getters, slots, client } = options
    const { state: initialState, module, root } = context

    if (attributes) {
      for (const [key, value] of Object.entries(attributes)) {
        if (value.type === Object || value.type === Array) {
          throw new CoraliteError(`Component "${module.id}" defines attribute "${key}" as ${value.type.name}. Object and Array types are blocked in attributes. Use server() for complex data.`, {
            componentId: module.id,
            filePath: module.path?.pathname
          })
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

    const scriptDefaultValues = {}
    if (attributes) {
      for (const [key, schema] of Object.entries(attributes)) {
        if (schema.default !== undefined) {
          scriptDefaultValues[key] = schema.default
        }
      }
    }

    state.__script__ = {
      attributes: serializableAttributes,
      getters: getters || {},
      state: {},
      defaultValues: scriptDefaultValues,
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

    if (typeof server === 'function') {
      const serverResult = await server({
        ...context,
        ...initialState
      })
      if (serverResult) {
        state.__script__.server = serverResult
        Object.assign(state, serverResult)
        Object.assign(state.__script__.state, serverResult)
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

          if (root && 'slots' in root && Array.isArray(root.slots)) {
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
            if (root && 'slots' in root && Array.isArray(root.slots)) {
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
                throw new CoraliteError(`Unexpected slot value in "${module.path.pathname}"`, {
                  componentId: module.id,
                  filePath: module.path.pathname
                })
              }
            }
          }

          if (root && 'slots' in root && Array.isArray(root.slots)) {
            root.slots = elementSlots
          }
        }
      }
    }

    const hasClient = typeof client === 'function'
    const hasSlots = slots && Object.keys(slots).length > 0
    const hasGetters = getters && Object.keys(getters).length > 0
    const hasAttributes = attributes && Object.keys(attributes).length > 0
    const hasServer = typeof server === 'function'

    if (hasClient || hasSlots || hasGetters || hasAttributes || hasServer) {
      if (hasClient) {
        const clientTextContent = client.toString().trim()
        const args = {}
        for (const key in state) {
          if (!Object.hasOwn(state, key)) {
            continue
          }

          if (clientTextContent.includes(key) || key.startsWith('ref_')) {
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

/**
 * Performs base evaluation and registers a component in the script manager.
 * Used during discovery and updates to lock in the pristine component definition.
 *
 * @param {Object} options - The registration options.
 * @param {any} options.component - The component document.
 * @param {Function} options.evaluate - The evaluation function.
 * @param {any} options.scriptManager - The script manager instance.
 * @param {Function} options.createSession - The session creation function.
 * @param {string} options.mode - The current build mode.
 * @returns {Promise<void>}
 */
export async function registerBaseComponent ({
  component,
  evaluate,
  scriptManager,
  createSession,
  mode
}) {
  if (!component) {
    return
  }

  if (!component.script) {
    const templateAST = component.template?.children || []
    const templateValues = component.values || {}
    const stylesHTML = component._processedCss || ''
    const defaultValues = {}

    templateValues?.refs?.forEach(ref => {
      defaultValues[`ref_${ref.name}`] = ''
    })

    scriptManager.registerComponent({
      id: component.id,
      getters: {},
      script: {
        content: 'function(){}',
        state: {},
        slots: {},
        components: (component.customElements || []).map(el => el.name),
        defaultValues
      },
      filePath: component.filePath || (component.path && component.path.pathname),
      templateAST,
      templateValues,
      defaultValues,
      styles: stylesHTML,
      slots: {},
      override: true
    })
    return
  }

  try {
    const baseSession = createSession('base-evaluation')
    const scriptResult = await evaluate({
      module: component,
      state: {},
      page: {
        url: { pathname: component.path?.pathname || '' },
        file: { pathname: component.path?.pathname || '' },
        meta: {}
      },
      root: null,
      contextId: `base-${component.id}`,
      session: baseSession,
      mode
    })

    if (scriptResult && scriptResult.__script__) {
      const scriptMeta = scriptResult.__script__
      const templateAST = component.template?.children || []
      const templateValues = component.values || {}
      const stylesHTML = component._processedCss || ''

      const scriptObj = {
        ...scriptMeta,
        content: 'function(){}',
        state: scriptMeta.state || {},
        slots: scriptMeta.slots || {}
      }
      let defaultValues = scriptMeta.defaultValues || {}
      let extractedComponents = []

      if (!component._extractedClient) {
        component._extractedClient = findAndExtractScript(component.script)
      }
      const extractedClient = component._extractedClient

      if (extractedClient) {
        scriptObj.content = extractedClient.content
        scriptObj.lineOffset = (component.lineOffset || 0) + extractedClient.lineOffset
        extractedComponents = extractedClient.components || []
      }

      if (!component._extractedServer) {
        component._extractedServer = findAndExtractProperties(component.script)
      }
      const extractedServer = component._extractedServer

      if (extractedServer) {
        scriptObj.stateContent = extractedServer.content
        scriptObj.stateLineOffset = (component.lineOffset || 0) + extractedServer.lineOffset
      }

      const declarativeComponents = (component.customElements || []).map(el => el.name)
      const nestedComponents = [...new Set([...declarativeComponents, ...extractedComponents])]
      scriptObj.components = nestedComponents

      templateValues?.refs?.forEach(ref => {
        const refKey = `ref_${ref.name}`
        defaultValues[refKey] = ''
        scriptObj.state[refKey] = ''
      })
      scriptObj.defaultValues = defaultValues

      scriptManager.registerComponent({
        id: component.id,
        getters: scriptMeta.getters,
        script: scriptObj,
        filePath: component.filePath || (component.path && component.path.pathname),
        templateAST,
        templateValues,
        defaultValues,
        styles: stylesHTML,
        slots: scriptMeta.slots,
        override: true
      })
    }
  } catch {
    // Base evaluation is allowed to fail silently
  }
}
