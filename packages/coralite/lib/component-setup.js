import { createReadOnlyProxy } from './utils/core.js'
import { processTokenValue } from './parser.js'
import { CoraliteError } from './utils/errors.js'
import {
  isCoraliteElement,
  isCoraliteTextNode,
  isCoraliteComment
} from './utils/types.js'
import { findAndExtractScript, extractComponentProperty } from './utils/server/server.js'
import { transformCss } from './utils/server/style.js'
import { inferTypeFromValues, validateAttributeValue } from './coralite-element.js'

/**
 * Normalizes and validates component attribute definitions at definition time.
 * @param {Object} attributes - Raw component attributes option.
 * @param {string} componentId - Component ID for error messages.
 * @param {string} [filePath] - Optional file path for error options.
 * @returns {Object} Normalized attributes dictionary.
 */
export function normalizeAndValidateAttributes (attributes, componentId, filePath) {
  if (!attributes) {
    return {}
  }

  const normalized = {}

  for (const [key, rawSchema] of Object.entries(attributes)) {
    let schemaObj
    let values

    if (Array.isArray(rawSchema)) {
      values = rawSchema
      schemaObj = { values: rawSchema }
    } else if (rawSchema && typeof rawSchema === 'object' && 'values' in rawSchema) {
      values = rawSchema.values
      schemaObj = rawSchema
    } else if (rawSchema === Object || rawSchema === Array || (rawSchema && (rawSchema.type === Object || rawSchema.type === Array))) {
      const typeName = rawSchema.name || rawSchema.type?.name || 'Object/Array'
      throw new CoraliteError(`Component "${componentId}" defines attribute "${key}" as ${typeName}. Object and Array types are blocked in attributes. Use server() for complex data.`, {
        componentId,
        filePath
      })
    } else if (typeof rawSchema === 'object' && rawSchema !== null) {
      schemaObj = rawSchema
      values = rawSchema.values
    } else {
      const type = rawSchema
      const typeName = typeof type === 'function' ? type.name : String(type)
      schemaObj = { type: typeName }
    }

    if ('validate' in schemaObj && schemaObj.validate !== undefined && typeof schemaObj.validate !== 'function') {
      throw new CoraliteError(`Component "${componentId}" attribute "${key}" validate property must be a function.`, {
        componentId,
        filePath
      })
    }

    if ('transform' in schemaObj && schemaObj.transform !== undefined && typeof schemaObj.transform !== 'function') {
      throw new CoraliteError(`Component "${componentId}" attribute "${key}" transform property must be a function.`, {
        componentId,
        filePath
      })
    }

    if (values !== undefined) {
      if (!Array.isArray(values)) {
        throw new CoraliteError(`Component "${componentId}" attribute "${key}" values must be an Array.`, {
          componentId,
          filePath
        })
      }

      if (values.length === 0) {
        throw new CoraliteError(`Component "${componentId}" attribute "${key}" values array cannot be empty.`, {
          componentId,
          filePath
        })
      }

      for (const item of values) {
        const itemType = typeof item
        if (item === null || (itemType !== 'string' && itemType !== 'number' && itemType !== 'boolean')) {
          throw new CoraliteError(`Component "${componentId}" attribute "${key}" values array contains non-primitive item: ${JSON.stringify(item)}. Only string, number, and boolean allowed.`, {
            componentId,
            filePath
          })
        }
      }
    }

    const uniqueValues = Array.isArray(values) ? Array.from(new Set(values)) : undefined

    const explicitType = schemaObj.type
    if (explicitType === Object || explicitType === Array) {
      throw new CoraliteError(`Component "${componentId}" defines attribute "${key}" as ${explicitType.name}. Object and Array types are blocked in attributes. Use server() for complex data.`, {
        componentId,
        filePath
      })
    }

    const typeConstructor = explicitType || (uniqueValues ? inferTypeFromValues(uniqueValues) : String)
    const typeName = typeof typeConstructor === 'function' ? typeConstructor.name : String(typeConstructor)

    const normalizedSchema = {
      type: typeName,
      default: schemaObj.default
    }

    if (schemaObj.required) {
      if (schemaObj.default !== undefined) {
        throw new CoraliteError(`Component "${componentId}" attribute "${key}" cannot have both required: true and a default value.`, {
          componentId,
          filePath
        })
      }
      normalizedSchema.required = true
    }
    if (uniqueValues) {
      normalizedSchema.values = uniqueValues
      if (schemaObj.default !== undefined && !uniqueValues.includes(schemaObj.default)) {
        const formattedDefault = JSON.stringify(schemaObj.default)
        const formattedExpected = uniqueValues.map(v => JSON.stringify(v)).join(', ')
        throw new CoraliteError(`Component "${componentId}" attribute "${key}" default value ${formattedDefault} is not in allowed values. Expected one of: ${formattedExpected}.`, {
          componentId,
          filePath
        })
      }
    }
    if (typeof schemaObj.transform === 'function') {
      normalizedSchema.transform = schemaObj.transform
    }
    if (typeof schemaObj.validate === 'function') {
      normalizedSchema.validate = schemaObj.validate
    }

    if (normalizedSchema.default !== undefined) {
      // Validate default value at component definition time
      validateAttributeValue(normalizedSchema.default, normalizedSchema, key, componentId, { filePath })
    }

    normalized[key] = normalizedSchema
  }

  return normalized
}

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

    const normalizedAttributes = normalizeAndValidateAttributes(attributes, module.id, module.path?.pathname)

    const state = Object.assign({}, initialState)
    const serializableAttributes = normalizedAttributes

    const scriptDefaultValues = {}
    for (const [key, schema] of Object.entries(normalizedAttributes)) {
      if (schema.default !== undefined) {
        scriptDefaultValues[key] = schema.default
      }
    }

    state.__script__ = {
      attributes: serializableAttributes,
      getters: getters || {},
      state: {},
      defaultValues: scriptDefaultValues,
      slots: slots || {}
    }

    for (const [key, schema] of Object.entries(normalizedAttributes)) {
      const val = validateAttributeValue(state[key], schema, key, module.id, { filePath: module.path?.pathname })
      if (val !== undefined) {
        state[key] = val
      } else {
        delete state[key]
      }
    }

    let serverToExecute = server

    if (app.options.mode === 'testing' && app.options.testing?.mocks?.components) {
      const mock = app.options.testing.mocks.components[module.id]
      if (mock && typeof mock.server === 'function') {
        serverToExecute = mock.server
      }
    }

    if (typeof serverToExecute === 'function') {
      const serverResult = await serverToExecute({
        ...context,
        ...initialState
      })

      if (serverResult) {
        if (typeof serverResult !== 'object' || Array.isArray(serverResult)) {
          throw new CoraliteError(`Component "${module.id}" server() function must return an object. Received: ${Array.isArray(serverResult) ? 'Array' : typeof serverResult}`, {
            componentId: module.id,
            filePath: module.path?.pathname
          })
        }

        state.__script__.server = serverResult
        Object.assign(state, serverResult)
        if (state.__script__.defaultValues) {
          Object.assign(state.__script__.defaultValues, serverResult)
        }
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

          const slotSignal = new AbortController().signal
          const slotContext = new Proxy({
            state,
            root: null,
            refs: () => null,
            observe: () => () => {
            },
            emit: () => false,
            signal: slotSignal,
            // @ts-ignore
            instanceId: context.instanceId || module.id,
            ...context
          }, {
            get (target, prop, receiver) {
              if (typeof prop === 'symbol') {
                return Reflect.get(target, prop, receiver)
              }
              if (Reflect.has(target, prop)) {
                return Reflect.get(target, prop, receiver)
              }
              if (state && prop in state) {
                return state[prop]
              }
              return Reflect.get(target, prop, receiver)
            },
            has (target, prop) {
              return Reflect.has(target, prop) || Boolean(state && prop in state)
            },
            ownKeys (target) {
              const contextKeys = Reflect.ownKeys(target)
              const stateKeys = state ? Object.keys(state) : []
              return Array.from(new Set([...contextKeys, ...stateKeys]))
            },
            getOwnPropertyDescriptor (target, prop) {
              if (Reflect.has(target, prop)) {
                return Reflect.getOwnPropertyDescriptor(target, prop)
              }
              if (typeof prop === 'string' && state && prop in state) {
                return {
                  enumerable: true,
                  configurable: true,
                  value: state[prop]
                }
              }
              return undefined
            }
          })

          let result
          try {
            result = computedSlot(slotContent, slotContext)
            result = result && typeof result.then === 'function' ? await result : result
          } catch {
            // Gracefully catch browser-only API access or SSR errors, falling back to original slot content
            result = slotContent
          }

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
    const hasStyles = module.styles && module.styles.length > 0

    if (hasClient || hasSlots || hasGetters || hasAttributes || hasServer || hasStyles) {
      const args = {}
      for (const key in state) {
        if (!Object.hasOwn(state, key) || key === '__script__') {
          continue
        }

        args[key] = state[key]
      }
      Object.assign(state.__script__.state, args)
    } else {
      delete state.__script__
    }

    return state
  }
}

/**
 * Helper to ensure a component is registered in the script manager with its styles and template.
 * This is used as a fallback to ensure that even if script evaluation fails,
 * the component's static assets (template and styles) are still available for bundling.
 *
 * @param {Object} component - The raw component document object from the parser.
 * @param {any} scriptManager - The ScriptManager instance to register the component with.
 * @param {Object|null} [scriptResultMeta=null] - Optional metadata resulting from component script evaluation (__script__).
 * @returns {Promise<void>}
 * @private
 */
async function _safeRegister (component, scriptManager, scriptResultMeta = null) {
  const templateAST = component.template?.children || []
  const templateValues = component.values || {}

  if (component.styles?.length && !component._processedCss) {
    const rawCss = component.styles.join('\n')
    const { rootClasses, descendantClasses } = component
    component._processedCss = await transformCss(rawCss, rootClasses, descendantClasses, (err) => console.error(err))
  }

  const stylesHTML = component._processedCss || ''
  const scriptMeta = scriptResultMeta || {
    state: {},
    slots: {},
    defaultValues: {},
    getters: {}
  }

  const scriptObj = {
    ...scriptMeta,
    content: 'function(){}',
    state: scriptMeta.state || {},
    slots: scriptMeta.slots || {}
  }

  let defaultValues = scriptMeta.defaultValues || {}
  let extractedComponents = []

  if (component.script) {
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
      component._extractedServer = extractComponentProperty(component.script, 'server')
    }
    const extractedServer = component._extractedServer

    if (extractedServer) {
      scriptObj.stateContent = extractedServer.content
      scriptObj.stateLineOffset = (component.lineOffset || 0) + extractedServer.lineOffset
    }

    // Attempt to extract getters, attributes, and slots from the script if they weren't provided
    // This provides a fallback if registerBaseComponent evaluation fails.
    if (!scriptResultMeta) {
      const extractedGetters = extractComponentProperty(component.script, 'getters')
      if (extractedGetters) {
        try {
          // Note: we can't easily evaluate the getters content here without a VM context,
          // but we can at least pass the content through if it's an object expression.
          if (extractedGetters.content.trim().startsWith('{')) {
            scriptObj.getters = new Function(`return ${extractedGetters.content}`)()
          }
        } catch {
          /* ignore */
        }
      }

      const extractedAttributes = extractComponentProperty(component.script, 'attributes')
      if (extractedAttributes) {
        try {
          if (extractedAttributes.content.trim().startsWith('{')) {
            const attrs = new Function(`return ${extractedAttributes.content}`)()
            scriptObj.attributes = normalizeAndValidateAttributes(attrs, component.id, component.filePath || (component.path && component.path.pathname))
          }
        } catch {
          /* ignore */
        }
      }

      const extractedSlots = extractComponentProperty(component.script, 'slots')
      if (extractedSlots) {
        try {
          if (extractedSlots.content.trim().startsWith('{')) {
            scriptObj.slots = new Function(`return ${extractedSlots.content}`)()
          }
        } catch {
          /* ignore */
        }
      }
    }
  }

  const declarativeComponents = (component.customElements || []).map(el => el.name)
  const nestedComponents = [...new Set([...declarativeComponents, ...extractedComponents])]
  scriptObj.components = nestedComponents

  templateValues?.refs?.forEach(ref => {
    const refKey = `ref_${ref.name}`
    defaultValues[refKey] = ''
    if (!scriptObj.state[refKey]) {
      scriptObj.state[refKey] = ''
    }
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
    return _safeRegister(component, scriptManager)
  }

  const baseSession = createSession('base-evaluation')

  try {
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

    await _safeRegister(component, scriptManager, scriptResult?.__script__)
  } catch (_err) {
    console.warn(`[Coralite Warning]: Base evaluation for component "${component.id}" failed: ${_err.message}. Registering static fallback definition.`)
    await _safeRegister(component, scriptManager)
  }
}
