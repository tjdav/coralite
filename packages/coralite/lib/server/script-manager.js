import { build, context } from 'esbuild'
import serialize from 'serialize-javascript'
import { normalizeFunction, normalizeObjectFunctions, hasObjectKeys, hasContextEntries, mergeUniqueObjects, cleanAST, cleanValues, generateHydrationMap, generateBindingTree, validateSerializable } from '../shared/core.js'
import { findAndExtractImperativeComponents, astTransformer } from './utils/server.js'
import { buildDependencyStylesheets, createStylesheetHandle, extractScriptStylesheets } from './utils/dependency-stylesheets.js'
import { CoraliteError } from '../shared/errors.js'
import { readFile } from 'node:fs/promises'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { resolve, parse, dirname, basename, isAbsolute, join } from 'node:path'
import { nodeModulesPolyfillPlugin } from 'esbuild-plugins-node-modules-polyfill'
import render from 'dom-serializer'

// The canonical empty fallback signature shared by component scripts.
export const EMPTY_FUNCTION_SIGNATURE = 'function(){}'

/**
 * Detects whether a code point is whitespace.
 * Uses charCodeAt for a full-whitespace set comparison.
 *
 * @param {string} char - A single character string
 * @returns {boolean} - True if the character is whitespace or a line terminator
 */
export const isWhitespace = (char) => {
  const code = char.charCodeAt(0)
  // ASCII: \t (0x09), \n (0x0a), \v (0x0b), \f (0x0c), \r (0x0d), space (0x20)
  if (code === 0x09 || code === 0x0a || code === 0x0b || code === 0x0c || code === 0x0d || code === 0x20) {
    return true
  }
  // Non-ASCII whitespace: NBSP, OGHAM, en/em spaces (2000-200A), LS/PS,
  // narrow no-break, medium math space, ideographic space, BOM.
  if (code === 0x00a0 || code === 0x1680 || (code >= 0x2000 && code <= 0x200a) ||
      code === 0x2028 || code === 0x2029 || code === 0x202f || code === 0x205f ||
      code === 0x3000 || code === 0xfeff) {
    return true
  }
  return false
}

/**
 * Helper to unify empty function checks. Scans the content once without
 * allocating a whitespace-stripped copy of the whole script (the regex
 * variant does this for every component on every build).
 *
 * @param {string} [content] - The content of the function to check.
 * @returns {boolean} - Returns true if the function matches the empty fallback signature.
 */
/**
 * Helper to extract client configuration from a script module or plugin.
 * @param {any} module - Script module or plugin object.
 * @returns {any} Resolved plugin config object or empty object fallback.
 */
export function getPluginConfig (module) {
  if (module?.client?.config !== undefined) {
    return module.client.config
  }
  if (module?.config !== undefined) {
    return module.config
  }
  return {}
}

/**
 * Checks whether a script string represents an empty function.
 * @param {string} [content] - The content of the function to check.
 * @returns {boolean} True if empty or absent.
 */
export const isEmptyFunction = (content) => {
  if (!content) {
    return true
  }

  let matchIndex = 0
  const signatureLength = EMPTY_FUNCTION_SIGNATURE.length

  for (let i = 0; i < content.length; i++) {
    const char = content[i]
    if (isWhitespace(char)) {
      continue
    }
    // Early-exit as soon as a non-whitespace char stops matching the empty
    // signature. Real client scripts bail out within the first few chars.
    if (matchIndex >= signatureLength || char !== EMPTY_FUNCTION_SIGNATURE[matchIndex]) {
      return false
    }
    matchIndex++
  }

  return matchIndex === signatureLength
}

/**
 * Recursively checks if any AST node is a <script> element.
 * @param {Array} nodes - AST nodes.
 * @returns {boolean}
 */
export function hasExecutableScriptTag (nodes) {
  if (!Array.isArray(nodes)) {
    return false
  }
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (node && node.type === 'tag' && node.name === 'script') {
      return true
    }
    if (node && node.children && hasExecutableScriptTag(node.children)) {
      return true
    }
  }
  return false
}

/**
 * Recursively checks if any AST node is a <slot> element.
 * @param {Array} nodes - AST nodes.
 * @returns {boolean}
 */
export function hasSlotTag (nodes) {
  if (!Array.isArray(nodes)) {
    return false
  }
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (node && node.type === 'tag' && node.name === 'slot') {
      return true
    }
    if (node && node.children && hasSlotTag(node.children)) {
      return true
    }
  }
  return false
}

/**
 * Counts total occurrences of a tag name in an AST tree.
 * @param {Array} nodes - AST nodes.
 * @param {string} tag - Tag name to count.
 * @returns {number}
 */
export function countTagOccurrencesInAST (nodes, tag) {
  if (!Array.isArray(nodes)) {
    return 0
  }
  let count = 0
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (node && node.type === 'tag' && node.name === tag) {
      count++
    }
    if (node && node.children) {
      count += countTagOccurrencesInAST(node.children, tag)
    }
  }
  return count
}

/**
 * Checks if a single parent AST node contains multiple instances of tag.
 * @param {Array} nodes - AST nodes.
 * @param {string} tag - Tag name.
 * @returns {boolean}
 */
export function hasMultipleTagInSingleParent (nodes, tag) {
  if (!Array.isArray(nodes)) {
    return false
  }
  let countInParent = 0
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (node && node.type === 'tag' && node.name === tag) {
      countInParent++
    }
    if (node && node.children && hasMultipleTagInSingleParent(node.children, tag)) {
      return true
    }
  }
  return countInParent > 1
}

/**
 * Determines whether template cloning should be emitted for a component.
 * @param {Object} sharedFn - Component record.
 * @param {Object} allSharedFunctions - Map of all component records.
 * @param {string} [compilerOptimizations='all'] - Optimization setting.
 * @returns {boolean}
 */
/**
 * Generates JS code for updating a single binding given a token key.
 * @param {Object} binding - The binding object from hydrationMap.
 * @param {number} bindingIndex - Index of the binding in _bindings.
 * @param {string} tokenKey - The token key being updated.
 * @param {boolean} isGetter - Whether tokenKey corresponds to a getter.
 * @returns {string} JS code snippet.
 */
export function generateTokenUpdaterCode (binding, bindingIndex, tokenKey, isGetter) {
  /*
   * Derived getters are read from raw state so the computed value is evaluated
   * without clearing its tracked dependencies in the reactive state proxy.
   */
  const readState = isGetter
    ? `const value = this._stateRaw[${JSON.stringify(tokenKey)}]`
    : `const _rawValue = this._stateRaw[${JSON.stringify(tokenKey)}]\n    const value = typeof _rawValue === 'function' ? this._state[${JSON.stringify(tokenKey)}] : _rawValue`

  const bindingRef = `const binding = this._bindings[${bindingIndex}]`
  const nodeRef = 'const node = this._resolveBindingNode(binding)'

  if (binding.type === 'text') {
    if (binding.isSingleToken) {
      return `    ${readState}\n    ${bindingRef}\n    ${nodeRef}\n    if (!node) return\n    const next = value == null ? '' : String(value)\n    if (node.nodeType === 3) {\n      if (node.nodeValue !== next) node.nodeValue = next\n    } else {\n      if (node.textContent !== next) node.textContent = next\n    }`
    } else if (binding.segments) {
      const segExprs = binding.segments.map(seg => {
        if (seg[0] === 0) {
          return JSON.stringify(seg[1])
        }
        return `String(this._stateRaw[${JSON.stringify(seg[1])}] ?? '')`
      })
      return `    ${bindingRef}\n    ${nodeRef}\n    if (!node) return\n    const next = ${segExprs.join(' + ')}\n    if (node.nodeType === 3) {\n      if (node.nodeValue !== next) node.nodeValue = next\n    } else {\n      if (node.textContent !== next) node.textContent = next\n    }`
    } else {
      return `    ${readState}\n    ${bindingRef}\n    ${nodeRef}\n    if (!node) return\n    const rawMap = this._stateRaw || {}\n    const next = binding.template.replace(/\\{\\{\\s*(.+?)\\s*\\}\\}/g, (_, k) => rawMap[k] ?? '')\n    if (node.nodeType === 3) {\n      if (node.nodeValue !== next) node.nodeValue = next\n    } else {\n      if (node.textContent !== next) node.textContent = next\n    }`
    }
  }

  if (binding.type === 'html') {
    return `    ${readState}\n    ${bindingRef}\n    ${nodeRef}\n    if (!node) return\n    const next = value == null ? '' : String(value)\n    if (node.innerHTML !== next) {\n      node.innerHTML = next\n    }`
  }

  if (binding.type === 'attribute' || (!binding.type && binding.name)) {
    const kind = binding.attrKind ?? 0
    if (kind === 1) {
      return `    ${readState}\n    ${bindingRef}\n    const element = this._resolveBindingNode(binding)\n    if (!element) return\n    const strVal = String(value)\n    const isFalsy = strVal === '' || strVal === 'false' || strVal === 'null' || strVal === '0' || strVal === 'undefined'\n    if (isFalsy) {\n      element.removeAttribute(binding.name)\n    } else {\n      element.setAttribute(binding.name, '')\n    }`
    } else if (kind === 2) {
      return `    ${readState}\n    ${bindingRef}\n    const element = this._resolveBindingNode(binding)\n    if (!element) return\n    const targetVal = value === true || value === 'true' ? 'true' : (value === false || value === 'false' ? 'false' : null)\n    if (targetVal === null) {\n      element.removeAttribute(binding.name)\n    } else if (element.getAttribute(binding.name) !== targetVal) {\n      element.setAttribute(binding.name, targetVal)\n    }`
    } else if (kind === 3) {
      return `    ${readState}\n    ${bindingRef}\n    const element = this._resolveBindingNode(binding)\n    if (!element) return\n    const strVal = String(value)\n    const isFalsy = strVal === '' || strVal === 'false' || strVal === 'null' || strVal === 'undefined'\n    if (isFalsy) {\n      element.removeAttribute(binding.name)\n    } else if (element.getAttribute(binding.name) !== strVal) {\n      element.setAttribute(binding.name, strVal)\n    }`
    } else {
      if (binding.isSingleToken) {
        return `    ${readState}\n    ${bindingRef}\n    const element = this._resolveBindingNode(binding)\n    if (!element) return\n    if (value == null) {\n      if (element.hasAttribute(binding.name)) element.removeAttribute(binding.name)\n    } else {\n      const strVal = String(value)\n      if (element.getAttribute(binding.name) !== strVal) element.setAttribute(binding.name, strVal)\n    }`
      } else if (binding.segments) {
        const segExprs = binding.segments.map(seg => {
          if (seg[0] === 0) {
            return JSON.stringify(seg[1])
          }
          return `String(this._stateRaw[${JSON.stringify(seg[1])}] ?? '')`
        })
        return `    ${bindingRef}\n    const element = this._resolveBindingNode(binding)\n    if (!element) return\n    const strVal = ${segExprs.join(' + ')}\n    if (element.getAttribute(binding.name) !== strVal) element.setAttribute(binding.name, strVal)`
      } else {
        return `    ${readState}\n    ${bindingRef}\n    const element = this._resolveBindingNode(binding)\n    if (!element) return\n    const rawMap = this._stateRaw || {}\n    const strVal = binding.template.replace(/\\{\\{\\s*(.+?)\\s*\\}\\}/g, (_, k) => rawMap[k] ?? '')\n    if (element.getAttribute(binding.name) !== strVal) element.setAttribute(binding.name, strVal)`
      }
    }
  }

  return ''
}

/**
 * Generates the serialized `_updaters` object for a component definition.
 * @param {Object} hydrationMap - Hydration map containing tokenBindings, texts, and attributes.
 * @param {Set<string>} getterKeys - Set of getter keys defined on the component.
 * @param {string} [compilerOptimizations='all'] - Optimization setting.
 * @returns {string} Serialized code for `_updaters` object or `'null'`.
 */
export function generateCompiledUpdaters (hydrationMap, getterKeys = new Set(), compilerOptimizations = 'all') {
  if (compilerOptimizations === 'none' || !hydrationMap || !hydrationMap.tokenBindings) {
    return 'null'
  }

  const tokenBindings = hydrationMap.tokenBindings
  const tokenKeys = Object.keys(tokenBindings)
  if (tokenKeys.length === 0) {
    return 'null'
  }

  const allBindings = []
  if (hydrationMap.texts) {
    allBindings.push(...hydrationMap.texts)
  }
  if (hydrationMap.attributes) {
    allBindings.push(...hydrationMap.attributes)
  }

  const updaterEntries = []

  for (const key of tokenKeys) {
    const indices = tokenBindings[key] || []
    if (indices.length === 0) {
      continue
    }

    const isGetter = getterKeys.has(key)
    const codeBlocks = []

    for (const idx of indices) {
      const binding = allBindings[idx]
      if (binding) {
        const snippet = generateTokenUpdaterCode(binding, idx, key, isGetter)
        if (snippet) {
          codeBlocks.push(snippet)
        }
      }
    }

    if (codeBlocks.length > 0) {
      if (codeBlocks.length === 1) {
        updaterEntries.push(`  ${JSON.stringify(key)}: function () {\n${codeBlocks[0]}\n  }`)
      } else {
        const wrappedBlocks = codeBlocks.map(block => `    {\n${block}\n    }`).join('\n')
        updaterEntries.push(`  ${JSON.stringify(key)}: function () {\n${wrappedBlocks}\n  }`)
      }
    }
  }

  if (updaterEntries.length === 0) {
    return 'null'
  }

  return `{\n${updaterEntries.join(',\n')}\n}`
}

/**
 *
 */
export function shouldUseTemplateCloning (sharedFn, allSharedFunctions = {}, compilerOptimizations = 'all') {
  if (compilerOptimizations === 'none') {
    return false
  }

  if (!sharedFn || !sharedFn.templateAST || !Array.isArray(sharedFn.templateAST) || sharedFn.templateAST.length === 0) {
    return false
  }

  if (hasExecutableScriptTag(sharedFn.templateAST)) {
    return false
  }

  if (hasSlotTag(sharedFn.templateAST)) {
    return false
  }

  if (sharedFn.isRepeated || sharedFn.inSlotOrObserve) {
    return true
  }

  const tag = sharedFn.id
  let totalOccurrences = 0
  let isMultipleInParent = false

  for (const fn of Object.values(allSharedFunctions)) {
    if (!fn || !fn.templateAST) {
      continue
    }
    const occurrences = countTagOccurrencesInAST(fn.templateAST, tag)
    totalOccurrences += occurrences
    if (hasMultipleTagInSingleParent(fn.templateAST, tag)) {
      isMultipleInParent = true
    }
  }

  if (totalOccurrences > 1 || isMultipleInParent) {
    return true
  }

  return false
}

/**
 * Script Manager for Coralite
 * @import { ScriptPlugin, InstanceContext, CoralitePlugin } from '../../types/index.js'
 * @import { ScriptContent } from '../../types/script.js'
 */

/**
 * ScriptManager constructor function
 * @class
 * @param {Object} options - The configuration options for the script manager.
 */
export function ScriptManager (options = {}) {
  this.sharedFunctions = Object.create(null)
  this.contextProps = Object.create(null)
  this.plugins = []
  this.scriptModules = []
  this.options = options
  this.context = null
  this.virtualModules = new Map()
  this.componentStylesheets = new Map()
  this.pageStylesheets = new Map()
}

/**
 * Register a plugin
 * @param {CoralitePlugin | ScriptPlugin} plugin - Plugin object or setup function
 * @returns {Promise<ScriptManager>} - Returns this for method chaining
 */
ScriptManager.prototype.use = async function (plugin) {
  // Register script modules (client plugins)
  if (
    plugin
    && typeof plugin !== 'function'
  ) {
    // @ts-ignore
    const client = plugin.client || plugin

    if (plugin.context
      || client.context
      || client.init
      || typeof client.onBeforeComponentRender === 'function'
      || typeof client.onAfterComponentRender === 'function'
      || typeof client.onDisconnected === 'function') {
      /** @type {any} */
      const pluginObj = plugin
      const moduleRecord = {
        ...plugin,
        client: pluginObj.client || plugin,
        context: pluginObj.context || client.context,
        isIsomorphicContext: pluginObj.isIsomorphicContext ?? (Boolean(pluginObj.context) && pluginObj.client !== pluginObj),
        init: pluginObj.init || client.init,
        onBeforeComponentRender: pluginObj.onBeforeComponentRender || client.onBeforeComponentRender,
        onAfterComponentRender: pluginObj.onAfterComponentRender || client.onAfterComponentRender,
        onDisconnected: pluginObj.onDisconnected || client.onDisconnected,
        rootDir: pluginObj.rootDir || client.rootDir,
        filePath: pluginObj.filePath || client.filePath
      }
      this.scriptModules.push(moduleRecord)

      if (client.context) {
        const contextStr = serialize(client.context)
        const extractedComponents = findAndExtractImperativeComponents(contextStr)

        if (extractedComponents.length > 0) {
          client._extractedComponents = Array.from(new Set(extractedComponents))
        }
      }
    }
  }

  this.plugins.push(plugin)
  return this
}

/**
 * Get context object content string
 * @returns {string} String containing all context as object state
 */
ScriptManager.prototype.getClientContextContent = function () {
  let contextPropsStr = ''

  for (const [key, value] of Object.entries(this.contextProps)) {
    const safeKey = JSON.stringify(key)

    contextPropsStr += `${safeKey}: async (globalContext) => {
      const phase1 = ${value};
      const phase2 = await phase1(globalContext);
      if (typeof phase2 !== 'function') {
        throw new Error('Coralite Plugin Error: The "context" function of client plugin ' + ${safeKey} + ' must return a function for the second phase (instance context). Received: ' + typeof phase2);
      }
      return (localContext) => phase2(localContext);
    },`
  }

  return contextPropsStr
}

/**
 * Add a context property function
 * @param {string} name - Property name
 * @param {function} method - The property function
 * @returns {Promise<ScriptManager>} - Returns this for method chaining
 */
ScriptManager.prototype.addContextProp = async function (name, method) {
  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw new CoraliteError('addContextProp requires a non-empty string name')
  }

  this.contextProps[name] = normalizeFunction(method)

  return this
}

/**
 * Registers dependency stylesheet declarations for a component.
 *
 * @param {string} id - Component identifier.
 * @param {string} filePath - Component source file path.
 * @param {Array<Object>|null|undefined} declarations - Extracted component stylesheet declarations.
 * @returns {void}
 */
ScriptManager.prototype.registerComponentStylesheets = function (id, filePath, declarations) {
  if (!Array.isArray(declarations) || declarations.length === 0) {
    this.componentStylesheets.delete(id)
    return
  }

  this.componentStylesheets.set(id, {
    filePath,
    declarations
  })
}

/**
 * Registers dependency stylesheet declarations for a page.
 *
 * @param {string} filePath - Page source file path.
 * @param {Array<Object>|null|undefined} declarations - Extracted page stylesheet declarations.
 * @returns {void}
 */
ScriptManager.prototype.registerPageStylesheets = function (filePath, declarations) {
  if (!Array.isArray(declarations) || declarations.length === 0) {
    this.pageStylesheets.delete(filePath)
    return
  }

  this.pageStylesheets.set(filePath, declarations)
}

/**
 * Removes dependency stylesheet declarations for a page.
 *
 * @param {string} filePath - Page source file path.
 * @returns {void}
 */
ScriptManager.prototype.unregisterPageStylesheets = function (filePath) {
  this.pageStylesheets.delete(filePath)
}

/**
 * Collects all registered dependency stylesheet declarations in deterministic order.
 *
 * @returns {Array<Object>} Normalized stylesheet declarations.
 */
ScriptManager.prototype.collectStylesheetDeclarations = function () {
  const declarations = []
  const componentIds = Array.from(this.componentStylesheets.keys()).sort()

  for (const id of componentIds) {
    const entry = this.componentStylesheets.get(id)
    declarations.push(...entry.declarations)
  }

  const pagePaths = Array.from(this.pageStylesheets.keys()).sort()

  for (const filePath of pagePaths) {
    declarations.push(...this.pageStylesheets.get(filePath))
  }

  return declarations
}

/**
 * Register shared functions for a component
 * @param {Object} options - Registration options.
 * @param {string} options.id - The component identifier.
 * @param {ScriptContent} [options.script={}] - The script content or function associated with the component.
 * @param {string} [options.filePath] - The source file path used to map back to the original source.
 * @param {Array<Object>|null} [options.templateAST=null] - The parsed HTML template AST for client-side rendering.
 * @param {Object|null} [options.templateValues=null] - The token positions for AST updates.
 * @param {Object|null} [options.hydrationMap=null] - Precomputed hydration map (binding markers already stamped).
 * @param {Object} [options.defaultValues={}] - The initial default state from setup().
 * @param {Object} [options.getters={}] - The component getters.
 * @param {string} [options.styles=''] - The raw CSS string for the component.
 * @param {Object.<string, Function>} [options.slots={}] - The transformation functions for computed slots.
 * @param {Object} [options.style={}] - Reactive style definitions.
 * @param {Object} [options.provide={}] - Provided context definitions.
 * @param {Array|Object|null} [options.consume=null] - Consumed context keys.
 * @param {boolean} [options.formAssociated=false] - Whether the element is a form-associated custom element.
 * @param {boolean} [options.formControl] - Whether the element is a form control.
 * @param {string|object|null} [options.listStrategy=null] - List reconciliation strategy.
 * @param {string|object|null} [options.reconcile=null] - Legacy reconciliation strategy.
 * @param {Function|null} [options.onError=null] - Error boundary hook callback.
 * @param {boolean} [options.override=false] - Whether to override existing component definition.
 * @param {boolean} [options.isRepeated=false] - Whether component is instantiated multiple times.
 * @param {boolean} [options.inSlotOrObserve=false] - Whether component is in slot or observe block.
 */
ScriptManager.prototype.registerComponent = function ({
  id,
  script = {},
  filePath,
  templateAST = null,
  templateValues = null,
  hydrationMap = null,
  defaultValues = {},
  getters = {},
  styles = '',
  slots = {},
  style = {},
  provide = {},
  consume = null,
  formAssociated = false,
  formControl,
  listStrategy = null,
  reconcile = null,
  onError = null,
  override = false,
  isRepeated = false,
  inSlotOrObserve = false
}) {
  // Initialize base object if it's the first time we are seeing this ID
  const isNew = !this.sharedFunctions[id]
  if (isNew) {
    /** @type {any} */
    const initialObj = {
      id,
      components: [],
      filePath: `/component-${id}.js`,
      isRepeated: false,
      inSlotOrObserve: false
    }
    this.sharedFunctions[id] = initialObj
  }

  /** @type {any} */
  const target = this.sharedFunctions[id]

  if (hasObjectKeys(script)) {
    if (isNew || override) {
      target.script = script
    }
  }

  if (hasObjectKeys(getters)) {
    if (isNew || override) {
      target.getters = getters
    }
  }

  if (templateAST) {
    if (isNew || override) {
      target.templateAST = templateAST
    }
  }

  if (templateValues) {
    if (isNew || override) {
      target.templateValues = templateValues
    }
  }

  if (hydrationMap) {
    if (isNew || override || !target.hydrationMap) {
      target.hydrationMap = hydrationMap
    }
  }

  if (styles) {
    if (isNew || override) {
      target.styles = styles
    }
  }

  if (filePath) {
    if (isNew || override || !target.filePath || target.filePath.startsWith('/component-')) {
      target.filePath = resolve(filePath)
    }
  }


  if (hasObjectKeys(defaultValues)) {
    if (isNew || override) {
      target.defaultValues = defaultValues
    }
  }

  if (hasObjectKeys(slots)) {
    if (isNew || override) {
      target.slots = slots
    }
  }

  if (hasObjectKeys(style)) {
    if (isNew || override) {
      target.style = style
    }
  }

  if (hasContextEntries(provide)) {
    if (isNew || override) {
      target.provide = provide
    }
  }

  if (consume) {
    if (isNew || override) {
      target.consume = consume
    }
  }

  const resolvedFormControl = formControl !== undefined ? formControl : formAssociated
  if (resolvedFormControl !== undefined) {
    if (isNew || override) {
      target.formControl = Boolean(resolvedFormControl)
      target.formAssociated = Boolean(resolvedFormControl)
    }
  }

  const resolvedListStrategy = listStrategy ?? reconcile
  if (resolvedListStrategy !== undefined && resolvedListStrategy !== null) {
    if (isNew || override) {
      target.listStrategy = resolvedListStrategy
      target.reconcile = resolvedListStrategy
    }
  }

  if (typeof onError === 'function') {
    if (isNew || override) {
      target.onError = onError
    }
  }

  if (isRepeated) {
    target.isRepeated = true
  }

  if (inSlotOrObserve) {
    target.inSlotOrObserve = true
  }

  if (script) {
    if (script.components?.length) {
      if (isNew || override) {
        target.components = script.components
      } else {
        target.components = mergeUniqueObjects(target.components, script.components)
      }
    }
  }
}

/**
 * Disposes the current esbuild context if it exists.
 * @returns {Promise<void>}
 */
ScriptManager.prototype.disposeContext = async function () {
  if (this.context) {
    await this.context.dispose()
    this.context = null
  }
}

/**
 * Compiles and bundles all registered components and the coralite-runtime client module using esbuild.
 * Eagerly bundles the entire component registry to support declarative rendering and lazy imperative loading.
 * @param {string} [mode='production'] - Build mode ('development', 'production', or 'testing')
 * @returns {Promise<{ manifest: Object, stylesheetManifest: Object, outputFiles: Object, importMap: Object }>}
 */
ScriptManager.prototype.compileComponents = async function (mode = 'production') {
  const entryCodeParts = []
  const moduleNamespace = 'coralite-script-module:'
  const componentNamespace = 'coralite-component:'
  const cssNamespace = 'coralite-css:'
  const virtualPrefix = 'coralite-virtual:'

  // Collect and validate client.config for each registered script module
  const clientPluginConfigs = {}
  for (let i = 0; i < this.scriptModules.length; i++) {
    const module = this.scriptModules[i]
    const pluginName = module.client?.name || module.name || `plugin-${i}`
    const rawConfig = getPluginConfig(module)
    try {
      validateSerializable(rawConfig, `plugin "${pluginName}" client.config`)
    } catch (err) {
      throw new CoraliteError(
        `[CORALITE-P210] Non-serializable value in client.config for plugin "${pluginName}": ${err.message}`,
        {
          code: 'CORALITE-P210',
          cause: err
        }
      )
    }
    clientPluginConfigs[pluginName] = rawConfig
  }

  // Generate ESM imports for each script module
  for (let i = 0; i < this.scriptModules.length; i++) {
    entryCodeParts.push(`import { clientContextProps as clientContextProps_${i}, isomorphicContextProps as isomorphicContextProps_${i}, onBeforeComponentRender as onBeforeComponentRender_${i}, onAfterComponentRender as onAfterComponentRender_${i}, onDisconnected as onDisconnected_${i}, init as init_${i} } from "${virtualPrefix}${moduleNamespace}${i}";\n`)
  }

  entryCodeParts.push(`const clientPluginConfigs = ${serialize(clientPluginConfigs)};\n`)

  // Setup store runtime
  const hasStore = this.options.store && typeof this.options.store === 'object'
  if (hasStore) {
    const storeModulePath = fileURLToPath(import.meta.resolve('../utils/store.js'))
    entryCodeParts.push(`import { createStore } from ${JSON.stringify(storeModulePath)};\n`)
    entryCodeParts.push(`const storeDefaults = ${serialize(this.options.store)};\n`)
    entryCodeParts.push('const store = createStore(storeDefaults);\n')
  } else {
    entryCodeParts.push('const store = undefined;\n')
  }

  // Setup client context state
  const contextParts = [
    ...this.scriptModules.map((_, i) => `...clientContextProps_${i}`),
    this.getClientContextContent()
  ].filter(Boolean).join(',\n')

  entryCodeParts.push(`const coraliteComponentClientContextProps = {
    ${contextParts}
  };\n`)

  const isomorphicParts = [
    ...this.scriptModules.map((_, i) => `...isomorphicContextProps_${i}`)
  ].filter(Boolean).join(',\n')

  entryCodeParts.push(`const coraliteIsomorphicContextProps = {
    ${isomorphicParts}
  };\n`)

  // Global context initialization
  entryCodeParts.push(`if (typeof window !== 'undefined') {
  if (!window.__coralite__) {
    Object.defineProperty(window, '__coralite__', {
      value: {},
      writable: true,
      configurable: true,
      enumerable: false
    });
  }
  window.__coralite__.config = window.__coralite__.config || {};
  window.__coralite__.state = window.__coralite__.state || {};
  window.__coralite__.dom = window.__coralite__.dom || {};
  window.__coralite__.plugins = window.__coralite__.plugins || {};
  window.__coralite__.state.hydration = window.__coralite__.state.hydration || {};
  if (store !== undefined) {
    window.__coralite__.state.store = store;
  }
}\n`)
  entryCodeParts.push('const globalContext = typeof window !== "undefined" && window.__coralite__ ? { ...window.__coralite__, store } : { store };\n')

  entryCodeParts.push(`if (typeof window !== 'undefined') {
  window.__coralite__.plugins.isomorphic = {};
  for (const [key, initFn] of Object.entries(coraliteIsomorphicContextProps)) {
    try {
      if (typeof initFn === 'function') {
        window.__coralite__.plugins.isomorphic[key] = initFn(globalContext);
      }
    } catch (e) {
      console.error('Coralite Plugin Error: Failed to initialize isomorphic context for plugin "' + key + '":', e);
    }
  }
}\n`)

  entryCodeParts.push(`const resolvedContextFactoriesPromise = (async () => {
    const factories = {};
    const keys = Object.keys(coraliteComponentClientContextProps);
    for (const key of keys) {
      try {
        factories[key] = await coraliteComponentClientContextProps[key](globalContext);
      } catch (e) {
        console.error('Coralite Plugin Error: Failed to initialize client context for plugin "' + key + '":', e);
        throw e;
      }
    }
    return factories;
  })();\n`)

  const clientMocks = {}
  if (mode === 'testing' && this.options.testing?.mocks?.plugins) {
    for (const [key, mock] of Object.entries(this.options.testing.mocks.plugins)) {
      if (mock.client) {
        clientMocks[key] = { client: mock.client }
      }
    }
  }
  const clientMocksStr = serialize(clientMocks)

  entryCodeParts.push(`const getClientContext = async (instanceContext) => {
    const factories = await resolvedContextFactoriesPromise;
    const cache = new Map();
    const clientMocks = ${clientMocksStr};
    const getIsoPlugins = () => (typeof window !== 'undefined' && window.__coralite__?.plugins?.isomorphic) || null;
    const isIsoKey = (prop) => {
      const isoPlugins = getIsoPlugins();
      return Boolean(isoPlugins && prop in isoPlugins);
    };

    return new Proxy(instanceContext, {
      get(target, prop, receiver) {
        if (prop === 'then') return undefined;
        if (Reflect.has(target, prop)) return Reflect.get(target, prop, receiver);
        if (cache.has(prop)) return cache.get(prop);

        if (isIsoKey(prop)) {
          const isoFn = getIsoPlugins()[prop];
          const resolved = typeof isoFn === 'function' ? isoFn(receiver) : isoFn;
          cache.set(prop, resolved);
          return resolved;
        }

        const factory = factories[prop];
        if (factory === undefined) return undefined;

        if (typeof factory !== 'function') {
           throw new Error('Coralite Plugin Error: The plugin "' + String(prop) + '" must be a function for the second phase (instance context). Received: ' + typeof factory);
        }

        let resolved = factory(receiver);

        if (clientMocks[prop]?.client?.context) {
          if (typeof resolved === 'object' && resolved !== null) {
            resolved = Object.assign({}, resolved, clientMocks[prop].client.context);
          } else {
            resolved = clientMocks[prop].client.context;
          }
        }

        cache.set(prop, resolved);
        return resolved;
      },
      has(target, prop) {
        return Reflect.has(target, prop) || prop in factories || isIsoKey(prop);
      },
      ownKeys(target) {
        const isoPlugins = getIsoPlugins();
        const isoKeys = isoPlugins ? Object.keys(isoPlugins) : [];
        return Array.from(new Set([
          ...Reflect.ownKeys(target),
          ...Object.keys(factories),
          ...isoKeys
        ]));
      },
      getOwnPropertyDescriptor(target, prop) {
        if (Reflect.has(target, prop)) {
          return Reflect.getOwnPropertyDescriptor(target, prop);
        }
        if (prop in factories || isIsoKey(prop)) {
          return {
            enumerable: true,
            configurable: true,
            writable: true
          };
        }
        return undefined;
      }
    });
  }\n`)

  const coraliteElementPath = fileURLToPath(import.meta.resolve('../client/element.js'))
  const devToolsPath = fileURLToPath(import.meta.resolve('../client/utils/devtools.js'))
  const stylesheetsPath = fileURLToPath(import.meta.resolve('../client/utils/stylesheets.js'))
  const injectUtilsPath = fileURLToPath(import.meta.resolve('../client/utils/inject.js'))

  entryCodeParts.push(`const globalClientHooks = {
    onBeforeComponentRender: [${this.scriptModules.map((_, i) => `onBeforeComponentRender_${i}`).join(', ')}].filter(Boolean),
    onAfterComponentRender: [${this.scriptModules.map((_, i) => `onAfterComponentRender_${i}`).join(', ')}].filter(Boolean),
    onDisconnected: [${this.scriptModules.map((_, i) => `onDisconnected_${i}`).join(', ')}].filter(Boolean)
  };\n`)

  entryCodeParts.push(`const initPlugins = async () => {
    const plugins = [
      ${this.scriptModules.map((m, i) => `{ name: ${JSON.stringify(m.client?.name || m.name || `plugin-${i}`)}, init: init_${i}, config: clientPluginConfigs[${JSON.stringify(m.client?.name || m.name || `plugin-${i}`)}] || {} }`).join(',\n')}
    ];
    const cleanupFns = [];
    const onCleanup = (fn) => {
      if (typeof fn === 'function') {
        cleanupFns.push(fn);
      }
    };

    for (const p of plugins) {
      if (typeof p.init === 'function') {
        try {
          const runtime = (typeof window !== 'undefined' && window.__coralite__) || {};
          const app = runtime;
          const route = typeof window !== 'undefined' ? window.__coralite__?.state?.route : undefined;
          await p.init({
            config: p.config || {},
            runtime,
            app,
            route,
            onCleanup,
            store
          });
        } catch (error) {
          console.error('Coralite Plugin Error: Plugin "' + p.name + '" init failed:', error);
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            let event;
            if (typeof CustomEvent === 'function') {
              event = new CustomEvent('coralite:plugin-init-error', { detail: { pluginName: p.name, error } });
            } else {
              event = new Event('coralite:plugin-init-error');
              event.detail = { pluginName: p.name, error };
            }
            window.dispatchEvent(event);
          }
        }
      }
    }

    if (cleanupFns.length > 0 && typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        for (const fn of cleanupFns) {
          try {
            fn();
          } catch (e) {
            console.error('Coralite Plugin Error during cleanup:', e);
          }
        }
      });
    }
  };\n`)

  entryCodeParts.push(`import { createCoraliteClass, setupPageRuntime } from ${JSON.stringify(coraliteElementPath)};\n`)
  entryCodeParts.push(`import { createImportCSS } from ${JSON.stringify(stylesheetsPath)};\n`)
  entryCodeParts.push(`import { formatCoraliteHTML } from ${JSON.stringify(injectUtilsPath)};\n`)
  if (mode !== 'production') {
    entryCodeParts.push(`import { setupDevTools, registerDevToolsComponent } from ${JSON.stringify(devToolsPath)};\n`)
    entryCodeParts.push('\nexport { getClientContext, createCoraliteClass, setupPageRuntime, globalClientHooks, setupDevTools, registerDevToolsComponent, clientPluginConfigs, initPlugins, createImportCSS, formatCoraliteHTML };\n')
  } else {
    entryCodeParts.push('\nexport { getClientContext, createCoraliteClass, setupPageRuntime, globalClientHooks, clientPluginConfigs, initPlugins, createImportCSS, formatCoraliteHTML };\n')
  }

  this.virtualModules.clear()
  this.virtualModules.set('coralite-runtime', entryCodeParts.join('').trimEnd())

  // Determine which components to bundle
  /** @type {Record<string, boolean>} */
  const processedComponent = {}

  // Include ALL registered components to ensure they can be loaded imperatively
  for (const id of Object.keys(this.sharedFunctions)) {
    processedComponent[id] = true
  }

  const processedComponentKeys = Object.keys(processedComponent).sort()

  if (mode === 'development') {
    // In development, we must re-create the context if the set of entry points changed
    // because esbuild's context does not support adding/removing entry points.
    const currentEntryPoints = new Set(processedComponentKeys)
    currentEntryPoints.add('coralite-runtime')

    if (this.context) {
      let entryPointsChanged = false
      if (this._lastEntryPoints) {
        if (this._lastEntryPoints.size !== currentEntryPoints.size) {
          entryPointsChanged = true
        } else {
          for (const ep of currentEntryPoints) {
            if (!this._lastEntryPoints.has(ep)) {
              entryPointsChanged = true
              break
            }
          }
        }
      } else {
        entryPointsChanged = true
      }

      if (entryPointsChanged) {
        await this.disposeContext()
      }
    }
    this._lastEntryPoints = currentEntryPoints
  }
  // Create virtual entry points for each component
  for (let i = 0; i < processedComponentKeys.length; i++) {
    const componentId = processedComponentKeys[i]
    const sharedFn = this.sharedFunctions[componentId]

    if (sharedFn) {
      const alias = `_c${i}`
      let componentEntryCode = ''

      const scriptContent = sharedFn.script?.content
      const hasScript = Boolean(
        (scriptContent && !isEmptyFunction(scriptContent)) ||
        sharedFn.script?.provideSource ||
        sharedFn.script?.consumeSource
      )

      if (hasScript) {
        componentEntryCode += `import * as componentModule_${alias} from "${virtualPrefix}${componentNamespace}${componentId}";\n`
      }

      if (sharedFn.styles && (mode === 'production' || mode === 'testing')) {
        componentEntryCode += `import "${virtualPrefix}${cssNamespace}${componentId}";\n`
      }

      // Reuse the hydration map generated before fragment ops were compiled so
      // binding markers are not stamped a second time. The fallback keeps
      // components registered outside `_safeRegister()` working.
      const hydrationMapObj = sharedFn.hydrationMap || generateHydrationMap(sharedFn.templateAST, sharedFn.templateValues)
      const hydrationMap = serialize(hydrationMapObj)

      // Use a WeakMap to map original nodes to a unique index
      const nodeMap = new WeakMap()
      const state = { counter: 0 }

      const cleanedAST = cleanAST(sharedFn.templateAST, nodeMap, state)


      const templateHTML = serialize(cleanedAST ? render(cleanedAST, { decodeEntities: false }) : '')
      const templateValues = mode === 'production'
        ? 'null'
        : serialize(cleanValues(sharedFn.templateValues, nodeMap) || {
          attributes: [],
          textNodes: [],
          refs: []
        })
      const styles = JSON.stringify(sharedFn.styles || '')

      let normalizedDefaults = sharedFn.defaultValues || {}
      if (sharedFn.defaultValues) {
        normalizedDefaults = normalizeObjectFunctions(sharedFn.defaultValues, astTransformer)
      }
      const defaults = serialize(normalizedDefaults)

      let normalizedAttributes = sharedFn.script?.attributes || {}
      if (normalizedAttributes) {
        normalizedAttributes = normalizeObjectFunctions(normalizedAttributes, astTransformer)
      }
      const attributes = serialize(normalizedAttributes)

      let normalizedGetters = sharedFn.getters || sharedFn.script?.getters || {}

      if (normalizedGetters) {
        normalizedGetters = normalizeObjectFunctions(normalizedGetters, astTransformer)
      }

      const getterKeysSet = new Set(Object.keys(normalizedGetters))
      const getters = serialize(normalizedGetters)
      const dependencies = JSON.stringify(sharedFn.components || [])

      let normalizedSlots = sharedFn.slots || {}
      if (sharedFn.slots) {
        normalizedSlots = normalizeObjectFunctions(sharedFn.slots, astTransformer)
      }
      const slots = serialize(normalizedSlots)

      let normalizedStyle = sharedFn.style || sharedFn.script?.style || {}
      if (normalizedStyle) {
        normalizedStyle = normalizeObjectFunctions(normalizedStyle, astTransformer)
      }
      const style = serialize(normalizedStyle)

      let normalizedProvide = sharedFn.provide || sharedFn.script?.provide || {}
      if (normalizedProvide) {
        normalizedProvide = normalizeObjectFunctions(normalizedProvide, astTransformer)
      }
      const provide = serialize(normalizedProvide)

      let normalizedConsume = sharedFn.consume || sharedFn.script?.consume || null
      if (normalizedConsume) {
        normalizedConsume = normalizeObjectFunctions(normalizedConsume, astTransformer)
      }
      const consume = serialize(normalizedConsume)

      const compilerOptimizations = this.options?.compilerOptimizations ?? 'all'
      const useCloning = shouldUseTemplateCloning(sharedFn, this.sharedFunctions, compilerOptimizations)

      const updaters = generateCompiledUpdaters(hydrationMapObj, getterKeysSet, compilerOptimizations)
      const bindingTreeObj = compilerOptimizations !== 'none' ? generateBindingTree(hydrationMapObj) : null
      const bindingTree = serialize(bindingTreeObj)

      const templateElementExpr = useCloning
        ? `(typeof document !== 'undefined' ? (() => { const t = document.createElement('template'); t.innerHTML = ${templateHTML}; return t; })() : null)`
        : 'null'

      componentEntryCode += `
export default {
  componentId: "${componentId}",
  compilerOptimizations: "${compilerOptimizations}",
  useTemplateCloning: ${useCloning},
  _updaters: ${updaters},
  _bindingTree: ${bindingTree},
  templateElement: ${templateElementExpr},
  templateHTML: ${templateHTML},
  templateValues: ${templateValues},
  styles: ${styles},
  attributes: ${attributes},
  hydrationMap: ${hydrationMap},
  getters: ${getters},
  defaultValues: (() => { const defaults = ${defaults}; return defaults; })(),
  slots: (() => { const slots = ${slots}; return slots; })(),
  style: (() => { const style = ${style}; return style; })(),
  provide: ${hasScript ? `componentModule_${alias}.provide || ` : ''}(() => { const provide = ${provide}; return provide; })(),
  consume: ${hasScript ? `componentModule_${alias}.consume || ` : ''}(() => { const consume = ${consume}; return consume; })(),
  formAssociated: ${Boolean(sharedFn.formControl ?? sharedFn.script?.formControl ?? sharedFn.formAssociated ?? sharedFn.script?.formAssociated)},
  formControl: ${Boolean(sharedFn.formControl ?? sharedFn.script?.formControl ?? sharedFn.formAssociated ?? sharedFn.script?.formAssociated)},
  listStrategy: ${hasScript ? `componentModule_${alias}.listStrategy || ` : ''}${JSON.stringify(sharedFn.listStrategy ?? sharedFn.reconcile ?? null)},
  reconcile: ${hasScript ? `componentModule_${alias}.listStrategy || ` : ''}${JSON.stringify(sharedFn.listStrategy ?? sharedFn.reconcile ?? null)},
  dependencies: ${dependencies},
  imports: {},
  client: ${hasScript ? `componentModule_${alias}.script` : 'null'},
  server: null
};
`
      this.virtualModules.set(componentId, componentEntryCode)
    }
  }

  const resolvedImportMap = {}

  // Use config's import map if available
  const userImportMap = this.options?.importMap || {}

  // Since we cannot pass raw code directly as values in the entryPoints object to esbuild,
  // we need to pass virtual paths.
  /** @type {Record<string, string>} */
  const virtualEntryPoints = {}
  for (const key of this.virtualModules.keys()) {
    virtualEntryPoints[key] = `${virtualPrefix}${key}`
  }

  // Build lookup maps for physical paths vs virtual module identifiers
  const filePathToComponentId = new Map()
  for (const [id, sharedFn] of Object.entries(this.sharedFunctions)) {
    if (sharedFn && sharedFn.filePath && !sharedFn.filePath.startsWith('/component-')) {
      filePathToComponentId.set(sharedFn.filePath, id)
    }
  }

  const filePathToModuleIndex = new Map()
  for (let i = 0; i < this.scriptModules.length; i++) {
    const mod = this.scriptModules[i]
    const pluginFilePath = mod?.filePath || mod?.client?.filePath
    if (pluginFilePath && !pluginFilePath.startsWith('/component-')) {
      filePathToModuleIndex.set(pluginFilePath, i)
    }
  }

  const injectPath = fileURLToPath(import.meta.resolve('../client/utils/inject.js'))

  const helperStylesheetDeclarations = []

  // Build and bundle
  /** @type {import('esbuild').BuildOptions} */
  const esbuildOptions = {
    entryPoints: virtualEntryPoints,
    inject: [injectPath],
    bundle: true,
    write: false,
    treeShaking: true,
    splitting: true,
    metafile: true,
    minify: mode === 'production',
    sourcemap: mode === 'production' ? false : 'inline',
    outdir: 'assets/js',
    entryNames: '[name]-[hash]',
    chunkNames: '[name]-[hash]',
    format: 'esm',
    sourceRoot: pathToFileURL(process.cwd()).href,
    define: {
      global: 'window',
      __dirname: '""',
      __filename: '""',
      'process.env.NODE_ENV': JSON.stringify(mode),
      'import.meta.env.MODE': JSON.stringify(mode),
      'import.meta.env': JSON.stringify({ MODE: mode })
    },
    plugins: [
      nodeModulesPolyfillPlugin(),
      {
        name: 'coralite-externaliser',
        setup: (pluginBuild) => {
          pluginBuild.onResolve({ filter: /\.(spec|test)\.js$|\.md$/ }, () => {
            return { external: true }
          })
        }
      },
      {
        name: 'coralite-css-dynamic-imports',
        setup: (pluginBuild) => {
          pluginBuild.onResolve({ filter: /\.css(?:[?#].*)?$/i }, (args) => {
            if (args.kind !== 'dynamic-import') {
              return null
            }
            let importerPath
            if (args.importer && !args.importer.startsWith(virtualPrefix)) {
              importerPath = args.importer
            } else if (args.resolveDir) {
              importerPath = join(args.resolveDir, '_importer.js')
            }
            const declaration = {
              handle: '',
              from: args.path,
              filePath: importerPath
            }
            declaration.handle = createStylesheetHandle(declaration)
            helperStylesheetDeclarations.push(declaration)
            return {
              path: declaration.handle,
              namespace: 'coralite-css-import'
            }
          })

          pluginBuild.onLoad({
            filter: /.*/,
            namespace: 'coralite-css-import'
          }, (args) => {
            const handleJson = JSON.stringify(args.path)
            return {
              contents: `const result = await window.__coralite__.dom.importCSS(${handleJson});\nexport const link = result.link;\nexport default result.default;\n`,
              loader: 'js'
            }
          })
        }
      },
      {
        name: 'coralite-import-map-resolver',
        setup: (pluginBuild) => {
          // Regex to catch bare specifiers (doesn't start with ., .., /, or http)
          const bareSpecifierRegex = /^[^.\/]|^\.[^.\/]|^\.\.[^\/]/

          pluginBuild.onResolve({ filter: bareSpecifierRegex }, (args) => {
            // Only intercept specifiers inside generated component scripts/files.
            // Do not externalize entry points themselves.
            if (args.kind === 'entry-point') {
              return null
            }

            // Check for Coralite internal modules first
            if (args.path.startsWith(virtualPrefix) ||
              args.path === 'coralite-runtime' ||
              this.virtualModules.has(args.path)) {
              return null
            }

            if (args.path === 'coralite') {
              return {
                path: injectPath
              }
            }

            if (args.path === 'coralite/utils') {
              return {
                path: fileURLToPath(import.meta.resolve('../shared/index.js'))
              }
            }

            // Do not externalize if the path resolves to a virtual module
            if (args.namespace === 'coralite-virtual') {
              return null
            }

            // Ignore absolute URLs that are already explicitly defined
            if (args.path.startsWith('http')) {
              return {
                path: args.path,
                external: true
              }
            }

            // Check if the user provided an explicit override in coralite.config.js
            if (userImportMap[args.path]) {
              resolvedImportMap[args.path] = userImportMap[args.path]
              return {
                path: userImportMap[args.path],
                external: true
              }
            }
          })
        }
      },
      {
        name: 'coralite-virtual-modules',
        setup: (pluginBuild) => {
          pluginBuild.onResolve({ filter: new RegExp(`^${virtualPrefix}`) }, args => {
            const rawPath = args.path.replace(new RegExp(`^${virtualPrefix}`), '')

            if (rawPath.startsWith(componentNamespace)) {
              const componentId = rawPath.replace(componentNamespace, '')
              const sharedFn = this.sharedFunctions[componentId]
              if (sharedFn && sharedFn.filePath && !sharedFn.filePath.startsWith('/component-')) {
                return {
                  path: sharedFn.filePath,
                  pluginData: {
                    isCoraliteComponent: true,
                    componentId
                  }
                }
              }
            }

            if (rawPath.startsWith(moduleNamespace)) {
              const index = parseInt(rawPath.replace(moduleNamespace, ''), 10)
              const module = this.scriptModules[index]
              const pluginFilePath = module?.filePath || module?.client?.filePath
              if (pluginFilePath && !pluginFilePath.startsWith('/component-')) {
                return {
                  path: `${pluginFilePath}?coralite-script-index=${index}`,
                  pluginData: {
                    isScriptModule: true,
                    moduleIndex: index
                  }
                }
              }
            }

            return {
              path: rawPath,
              namespace: 'coralite-virtual'
            }
          })

          // Scoped onLoad for physical file namespace
          pluginBuild.onLoad({
            filter: /.*/,
            namespace: 'file'
          }, async args => {
            // Returning undefined falls through to esbuild's default file loader (esbuild plugin contract).
            // This ensures standard source files and node_modules are loaded normally from disk.
            if (!args.pluginData?.isCoraliteComponent && !args.pluginData?.isScriptModule) {
              if (args.path.endsWith('.js') && !args.path.includes('node_modules')) {
                try {
                  const raw = await readFile(args.path, 'utf8')
                  if (raw.includes('.css') || raw.includes("'css'") || raw.includes('"css"')) {
                    const transformed = extractScriptStylesheets(raw, {
                      filePath: args.path,
                      allowAllFunctions: true
                    })
                    if (transformed.declarations.length > 0 || transformed.code !== raw) {
                      helperStylesheetDeclarations.push(...transformed.declarations)
                      return {
                        contents: transformed.code,
                        loader: 'js',
                        resolveDir: dirname(args.path)
                      }
                    }
                  }
                } catch (err) {
                  if (err && err.code && String(err.code).startsWith('CORALITE-')) {
                    throw err
                  }
                }
              }
              return undefined
            }

            if (args.pluginData?.isCoraliteComponent) {
              const componentId = args.pluginData.componentId
              const sharedFn = this.sharedFunctions[componentId]
              if (!sharedFn) {
                return undefined
              }

              let contents = ''
              if (sharedFn.script && (sharedFn.script.content || sharedFn.script.provideSource || sharedFn.script.consumeSource || sharedFn.script.listStrategySource)) {
                const imports = sharedFn.script.importStatements || []
                if (imports.length > 0) {
                  contents += imports.join('\n') + '\n\n'
                }

                if (sharedFn.script.content) {
                  const clientCode = sharedFn.script.stylesheetsExtracted
                    ? sharedFn.script.content
                    : extractScriptStylesheets(sharedFn.script.content, {
                      filePath: sharedFn.filePath,
                      allowAllFunctions: true
                    }).code
                  const padding = '\n'.repeat(Math.max(0, sharedFn.script.lineOffset || 0))
                  contents += `${padding}export const script = ${clientCode};\n`
                } else {
                  contents += 'export const script = null;\n'
                }

                if (sharedFn.script.provideSource) {
                  contents += `export const provide = ${sharedFn.script.provideSource};\n`
                } else {
                  contents += 'export const provide = undefined;\n'
                }
                if (sharedFn.script.consumeSource) {
                  contents += `export const consume = ${sharedFn.script.consumeSource};\n`
                } else {
                  contents += 'export const consume = undefined;\n'
                }
                if (sharedFn.script.listStrategySource) {
                  contents += `export const listStrategy = ${sharedFn.script.listStrategySource};\n`
                } else {
                  contents += 'export const listStrategy = undefined;\n'
                }

                contents += 'export default script;\n'
              } else {
                contents += 'export const script = null;\n'
                contents += 'export const provide = undefined;\n'
                contents += 'export const consume = undefined;\n'
                contents += 'export const listStrategy = undefined;\n'
                contents += 'export default null;\n'
              }

              contents += 'export const state = null;\n'

              return {
                contents,
                loader: 'js',
                resolveDir: sharedFn.filePath ? dirname(sharedFn.filePath) : process.cwd()
              }
            }

            if (args.pluginData?.isScriptModule) {
              const moduleIndex = args.pluginData.moduleIndex
              const module = this.scriptModules[moduleIndex]
              if (!module) {
                return undefined
              }

              let contents = ''
              const rawClientConfig = getPluginConfig(module)
              const configContent = `const pluginConfig = Object.freeze(${serialize(rawClientConfig)});`

              contents += configContent + '\n'

              const beforeFn = module.onBeforeComponentRender ? normalizeFunction(module.onBeforeComponentRender) : 'null'
              contents += `export const onBeforeComponentRender = ${beforeFn};\n`

              const afterFn = module.onAfterComponentRender ? normalizeFunction(module.onAfterComponentRender) : 'null'
              contents += `export const onAfterComponentRender = ${afterFn};\n`

              const disconnectedFn = module.onDisconnected ? normalizeFunction(module.onDisconnected) : 'null'
              contents += `export const onDisconnected = ${disconnectedFn};\n`

              const initFn = module.init ? normalizeFunction(module.init) : 'null'
              contents += `export const init = ${initFn};\n`

              contents += 'export const isomorphicContextProps = {\n'
              if (module.isIsomorphicContext && module.context) {
                const isoName = module.name
                if (['id', 'state', 'page', 'root', 'signal'].includes(isoName)) {
                  throw new CoraliteError(`Reserved context key '${isoName}' cannot be used in plugin context.`)
                }

                const fn = normalizeFunction(module.context)
                const safeIsoName = JSON.stringify(isoName)

                contents += `  ${safeIsoName}: (globalContext) => {\n`
                contents += `    const fn = ${fn};\n`
                contents += `    const pluginContext = new Proxy(globalContext, {
                            get (target, prop) {
                              if (prop === 'config') return pluginConfig;
                              if (prop === 'route') return typeof window !== 'undefined' ? window.__coralite__?.state?.route : undefined;
                              if (prop in target) return target[prop];
                              return undefined;
                            },
                            set (target, prop, value) {
                              return Reflect.set(target, prop, value);
                            }
                          });
                          let phase2;
                          try {
                             phase2 = fn(pluginContext);
                          } catch (e) {
                             console.error('Coralite Plugin Error: Failed to initialize isomorphic context for plugin ' + ${safeIsoName} + ' phase 1:', e);
                             throw e;
                          }

                          if (typeof phase2 !== 'function') {
                            throw new Error('Coralite Plugin Error: The "context" function of plugin ' + ${safeIsoName} + ' must return a function for the second phase (instance context). Received: ' + typeof phase2);
                          }
                          return phase2;
                        },\n`
              }
              contents += '};\n'

              contents += 'export const clientContextProps = {\n'
              if (module.context && !module.isIsomorphicContext) {
                const clientName = module.client?.name || module.name
                if (['id', 'state', 'page', 'root', 'signal'].includes(clientName)) {
                  throw new CoraliteError(`Reserved context key '${clientName}' cannot be used in plugin context.`)
                }

                const fn = normalizeFunction(module.context)
                const safeClientName = JSON.stringify(clientName)

                contents += `  ${safeClientName}: async (globalContext) => {\n`
                contents += `    const fn = ${fn};\n`
                contents += `    const pluginContext = new Proxy(globalContext, {
                            get (target, prop) {
                              if (prop === 'config') return pluginConfig;
                              if (prop === 'route') return typeof window !== 'undefined' ? window.__coralite__?.state?.route : undefined;
                              if (prop in target) return target[prop];
                              return undefined;
                            },
                            set (target, prop, value) {
                              return Reflect.set(target, prop, value);
                            }
                          });
                          let phase2;
                          try {
                             phase2 = await fn(pluginContext);
                          } catch (e) {
                             console.error('Coralite Plugin Error: Failed to initialize client context for plugin ' + ${safeClientName} + ' phase 1:', e);
                             throw e;
                          }

                          if (typeof phase2 !== 'function') {
                            throw new Error('Coralite Plugin Error: The "context" function of client plugin ' + ${safeClientName} + ' must return a function for the second phase (instance context). Received: ' + typeof phase2);
                          }
                          return phase2;
                        },\n`
              }
              contents += '};\n'

              return {
                contents,
                loader: 'js',
                resolveDir: module.filePath ? dirname(module.filePath) : (module.rootDir || process.cwd())
              }
            }

            return undefined
          })

          // Virtual namespace onLoad for synthetic/virtual modules
          pluginBuild.onLoad({
            filter: /.*/,
            namespace: 'coralite-virtual'
          }, args => {
            const path = args.path.replace(new RegExp(`^${virtualPrefix}`), '')

            const virtualContent = this.virtualModules.get(path)
            if (virtualContent) {
              return {
                contents: virtualContent,
                loader: 'js',
                resolveDir: process.cwd()
              }
            }

            if (path.startsWith(moduleNamespace)) {
              const index = parseInt(path.replace(moduleNamespace, ''), 10)
              const module = this.scriptModules[index]
              let contents = ''

              const rawClientConfig = getPluginConfig(module)
              const configContent = `const pluginConfig = Object.freeze(${serialize(rawClientConfig)});`

              contents += configContent + '\n'

              const beforeFn = module.onBeforeComponentRender ? normalizeFunction(module.onBeforeComponentRender) : 'null'
              contents += `export const onBeforeComponentRender = ${beforeFn};\n`

              const afterFn = module.onAfterComponentRender ? normalizeFunction(module.onAfterComponentRender) : 'null'
              contents += `export const onAfterComponentRender = ${afterFn};\n`

              const disconnectedFn = module.onDisconnected ? normalizeFunction(module.onDisconnected) : 'null'
              contents += `export const onDisconnected = ${disconnectedFn};\n`

              const initFn = module.init ? normalizeFunction(module.init) : 'null'
              contents += `export const init = ${initFn};\n`

              contents += 'export const isomorphicContextProps = {\n'
              if (module.isIsomorphicContext && module.context) {
                const isoName = module.name
                if (['id', 'state', 'page', 'root', 'signal'].includes(isoName)) {
                  throw new CoraliteError(`Reserved context key '${isoName}' cannot be used in plugin context.`)
                }

                const fn = normalizeFunction(module.context)
                const safeIsoName = JSON.stringify(isoName)

                contents += `  ${safeIsoName}: (globalContext) => {\n`
                contents += `    const fn = ${fn};\n`
                contents += `    const pluginContext = new Proxy(globalContext, {
                            get (target, prop) {
                              if (prop === 'config') return pluginConfig;
                              if (prop === 'route') return typeof window !== 'undefined' ? window.__coralite__?.state?.route : undefined;
                              if (prop in target) return target[prop];
                              return undefined;
                            },
                            set (target, prop, value) {
                              return Reflect.set(target, prop, value);
                            }
                          });
                          let phase2;
                          try {
                             phase2 = fn(pluginContext);
                          } catch (e) {
                             console.error('Coralite Plugin Error: Failed to initialize isomorphic context for plugin ' + ${safeIsoName} + ' phase 1:', e);
                             throw e;
                          }

                          if (typeof phase2 !== 'function') {
                            throw new Error('Coralite Plugin Error: The "context" function of plugin ' + ${safeIsoName} + ' must return a function for the second phase (instance context). Received: ' + typeof phase2);
                          }
                          return phase2;
                        },\n`
              }
              contents += '};\n'

              contents += 'export const clientContextProps = {\n'
              if (module.context && !module.isIsomorphicContext) {
                const clientName = module.client?.name || module.name
                if (['id', 'state', 'page', 'root', 'signal'].includes(clientName)) {
                  throw new CoraliteError(`Reserved context key '${clientName}' cannot be used in plugin context.`)
                }

                const fn = normalizeFunction(module.context)
                const safeClientName = JSON.stringify(clientName)

                contents += `  ${safeClientName}: async (globalContext) => {\n`
                contents += `    const fn = ${fn};\n`
                contents += `    const pluginContext = new Proxy(globalContext, {
                            get (target, prop) {
                              if (prop === 'config') return pluginConfig;
                              if (prop === 'route') return typeof window !== 'undefined' ? window.__coralite__?.state?.route : undefined;
                              if (prop in target) return target[prop];
                              return undefined;
                            },
                            set (target, prop, value) {
                              return Reflect.set(target, prop, value);
                            }
                          });
                          let phase2;
                          try {
                             phase2 = await fn(pluginContext);
                          } catch (e) {
                             console.error('Coralite Plugin Error: Failed to initialize client context for plugin ' + ${safeClientName} + ' phase 1:', e);
                             throw e;
                          }

                          if (typeof phase2 !== 'function') {
                            throw new Error('Coralite Plugin Error: The "context" function of client plugin ' + ${safeClientName} + ' must return a function for the second phase (instance context). Received: ' + typeof phase2);
                          }
                          return phase2;
                        },\n`
              }
              contents += '};\n'

              return {
                contents,
                loader: 'js',
                resolveDir: module.filePath ? dirname(module.filePath) : (module.rootDir || process.cwd())
              }
            }

            if (path.startsWith(cssNamespace)) {
              const componentId = path.replace(cssNamespace, '')
              const sharedFn = this.sharedFunctions[componentId]
              const contents = `@layer components {\n${sharedFn.styles}\n}`
              return {
                contents,
                loader: 'css',
                resolveDir: process.cwd()
              }
            }

            if (path.startsWith(componentNamespace)) {
              const componentId = path.replace(componentNamespace, '')
              const sharedFn = this.sharedFunctions[componentId]
              let contents = ''

              if (sharedFn.script && (sharedFn.script.content || sharedFn.script.provideSource || sharedFn.script.consumeSource || sharedFn.script.listStrategySource)) {
                const imports = sharedFn.script.importStatements || []
                if (imports.length > 0) {
                  contents += imports.join('\n') + '\n\n'
                }

                if (sharedFn.script.content) {
                  const clientCode = sharedFn.script.stylesheetsExtracted
                    ? sharedFn.script.content
                    : extractScriptStylesheets(sharedFn.script.content, {
                      filePath: sharedFn.filePath,
                      allowAllFunctions: true
                    }).code
                  const padding = '\n'.repeat(Math.max(0, sharedFn.script.lineOffset || 0))
                  contents += `${padding}export const script = ${clientCode};\n`
                } else {
                  contents += 'export const script = null;\n'
                }

                if (sharedFn.script.provideSource) {
                  contents += `export const provide = ${sharedFn.script.provideSource};\n`
                } else {
                  contents += 'export const provide = undefined;\n'
                }
                if (sharedFn.script.consumeSource) {
                  contents += `export const consume = ${sharedFn.script.consumeSource};\n`
                } else {
                  contents += 'export const consume = undefined;\n'
                }
                if (sharedFn.script.listStrategySource) {
                  contents += `export const listStrategy = ${sharedFn.script.listStrategySource};\n`
                } else {
                  contents += 'export const listStrategy = undefined;\n'
                }

                contents += 'export default script;\n'
              } else {
                contents += 'export const script = null;\n'
                contents += 'export const provide = undefined;\n'
                contents += 'export const consume = undefined;\n'
                contents += 'export const listStrategy = undefined;\n'
                contents += 'export default null;\n'
              }

              contents += 'export const state = null;\n'

              return {
                contents,
                loader: 'js',
                resolveDir: sharedFn.filePath ? dirname(sharedFn.filePath) : process.cwd()
              }
            }
          })
        }
      }
    ]
  }

  const sanitizeError = (err) => {
    if (!err) {
      return err
    }

    const virtualToPhysical = new Map()
    for (const [id, sharedFn] of Object.entries(this.sharedFunctions)) {
      if (sharedFn && sharedFn.filePath && !sharedFn.filePath.startsWith('/component-')) {
        virtualToPhysical.set(`${virtualPrefix}${componentNamespace}${id}`, sharedFn.filePath)
        virtualToPhysical.set(`${componentNamespace}${id}`, sharedFn.filePath)
      }
    }
    for (let i = 0; i < this.scriptModules.length; i++) {
      const mod = this.scriptModules[i]
      const p = mod?.filePath || mod?.client?.filePath
      if (p && !p.startsWith('/component-')) {
        virtualToPhysical.set(`${virtualPrefix}${moduleNamespace}${i}`, p)
        virtualToPhysical.set(`${moduleNamespace}${i}`, p)
      }
    }

    if (Array.isArray(err.errors)) {
      for (const errorItem of err.errors) {
        if (errorItem.location) {
          let locFile = errorItem.location.file || ''
          if (locFile.startsWith(virtualPrefix)) {
            locFile = locFile.slice(virtualPrefix.length)
          }
          if (virtualToPhysical.has(locFile)) {
            errorItem.location.file = virtualToPhysical.get(locFile)
            errorItem.location.namespace = 'file'
          } else if (locFile.startsWith(componentNamespace)) {
            const cid = locFile.replace(componentNamespace, '')
            if (this.sharedFunctions[cid]?.filePath && !this.sharedFunctions[cid].filePath.startsWith('/component-')) {
              errorItem.location.file = this.sharedFunctions[cid].filePath
              errorItem.location.namespace = 'file'
            }
          } else if (locFile.startsWith(moduleNamespace)) {
            const idx = parseInt(locFile.replace(moduleNamespace, ''), 10)
            const p = this.scriptModules[idx]?.filePath || this.scriptModules[idx]?.client?.filePath
            if (p && !p.startsWith('/component-')) {
              errorItem.location.file = p
              errorItem.location.namespace = 'file'
            }
          } else if (isAbsolute(locFile)) {
            errorItem.location.file = locFile
            errorItem.location.namespace = 'file'
          }
        }
      }
    }

    if (typeof err.message === 'string') {
      let cleanedMessage = err.message.replaceAll(`${virtualPrefix}${virtualPrefix}`, virtualPrefix)
      for (const [virt, phys] of virtualToPhysical.entries()) {
        cleanedMessage = cleanedMessage.replaceAll(virt, phys)
      }
      cleanedMessage = cleanedMessage.replace(/coralite-virtual:(?=\/|[a-zA-Z]:[\\\/])/g, '')
      err.message = cleanedMessage
    }

    return err
  }

  let result
  try {
    if (mode === 'development') {
      if (!this.context) {
        this.context = await context(esbuildOptions)
      }
      result = await this.context.rebuild()
    } else {
      result = await build(esbuildOptions)
    }
  } catch (err) {
    throw sanitizeError(err)
  }

  const manifest = {}
  if (result.metafile && result.metafile.outputs) {
    for (const [outputPath, meta] of Object.entries(result.metafile.outputs)) {
      if (meta.entryPoint) {
        const isCSS = outputPath.endsWith('.css')
        if (isCSS) {
          continue
        }

        const entryPoint = meta.entryPoint
        const cleanEntry = entryPoint.startsWith(virtualPrefix)
          ? entryPoint.slice(virtualPrefix.length)
          : entryPoint

        let tagName = cleanEntry
        if (filePathToComponentId.has(cleanEntry)) {
          tagName = filePathToComponentId.get(cleanEntry)
        } else if (!this.virtualModules.has(cleanEntry)) {
          tagName = parse(cleanEntry).name
        }

        const relativePath = basename(outputPath)

        if (tagName === 'coralite-runtime') {
          manifest[tagName] = relativePath
        } else {
          if (!manifest[tagName]) {
            manifest[tagName] = {}
          }
          manifest[tagName].js = relativePath

          if (meta.cssBundle) {
            manifest[tagName].css = basename(meta.cssBundle)
          }
        }
      }
    }
  }

  const outputFiles = {}

  if (result.outputFiles) {
    for (const file of result.outputFiles) {
      const isCSS = file.path.endsWith('.css')
      const filename = basename(file.path)
      const relativePath = isCSS ? `../css/${filename}` : filename

      let text = file.text
      if (text.includes('//# sourceMappingURL=data:application/json;base64,')) {
        const smMatch = text.match(/\/\/# sourceMappingURL=data:application\/json;base64,([A-Za-z0-9+/=]+)/)
        if (smMatch) {
          try {
            const smJson = Buffer.from(smMatch[1], 'base64').toString('utf-8')
            const parsedMap = JSON.parse(smJson)
            if (!parsedMap.sources || parsedMap.sources.length === 0 || !parsedMap.mappings || parsedMap.mappings.trim() === '') {
              text = text.replace(/\n?\/\/# sourceMappingURL=data:application\/json;base64,[A-Za-z0-9+/=]+/, '').trimEnd() + '\n'
            }
          } catch {
            // ignore JSON parse errors if any
          }
        }
      }

      outputFiles[relativePath] = {
        ...file,
        path: relativePath,
        hashedPath: relativePath,
        text
      }
    }
  }

  const stylesheetDeclarations = [
    ...this.collectStylesheetDeclarations(),
    ...helperStylesheetDeclarations
  ]
  const stylesConfig = this.options.styles
  const processors = stylesConfig ? stylesConfig.processors : null
  const postcssConfig = processors ? processors.postcss : null
  const postcssPlugins = (postcssConfig && postcssConfig.plugins) || []
  const stylesheetResult = await buildDependencyStylesheets(stylesheetDeclarations, {
    mode,
    postcssPlugins
  })

  Object.assign(outputFiles, stylesheetResult.outputFiles)

  return {
    manifest,
    stylesheetManifest: stylesheetResult.manifest,
    outputFiles,
    importMap: resolvedImportMap
  }
}
