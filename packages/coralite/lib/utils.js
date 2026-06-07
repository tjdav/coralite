/**
 * @import {
 * CoraliteModule,
 * CoraliteComponent,
 * CoraliteComponentResult,
 * } from '../types/index.js'
 */

const KEBAB_REGEX = /[-|:]([a-z])/g

/**
 * Converts a kebab-case string to camelCase
 * @param {string} str - The kebab-case string to convert
 * @returns {string} - The camelCase version of the string
 */
export function kebabToCamel (str) {
  // replace each dash followed by a letter with the uppercase version of the letter
  return str.replace(KEBAB_REGEX, function (match, letter) {
    return letter.toUpperCase()
  })
}

/**
 * Converts all keys in an object from kebab-case to camelCase
 * @template T
 * @param {Record<string, T>} object - The object with kebab-case keys
 * @returns {Record<string, T>} - A new object with camelCase keys
 */
export function cleanKeys (object) {
  /** @type {Record<string, T>} */
  const result = {}

  for (const [key, value] of Object.entries(object)) {
    result[key] = value

    const camelKey = kebabToCamel(key)
    if (camelKey !== key) {
      result[camelKey] = value
    }
  }

  return result
}

/**
 * Recursively clones an object or array and normalizes any function state
 * it finds into a string representation that preserves standard function syntax,
 * bypassing ES6 shorthand method serialization issues.
 * @param {any} target - The object or array to normalize.
 * @param {Function} [transform] - Optional transform function for each node.
 * @param {WeakMap} [seen=new WeakMap()] - Map of seen objects to handle circular references.
 * @returns {any} A deeply cloned object with normalized functions.
 */
export function normalizeObjectFunctions (target, transform = null, seen = new WeakMap()) {
  if (typeof transform === 'function') {
    const transformed = transform(target)
    if (transformed !== target) {
      return transformed
    }
  }

  if (typeof target !== 'object' || target === null) {
    return target
  }

  if (seen.has(target)) {
    return seen.get(target)
  }

  if (Array.isArray(target)) {
    const arr = []
    seen.set(target, arr)
    for (let i = 0; i < target.length; i++) {
      arr.push(normalizeObjectFunctions(target[i], transform, seen))
    }
    return arr
  }

  const obj = {}
  seen.set(target, obj)
  for (const key in target) {
    if (Object.hasOwn(target, key)) {
      if (typeof target[key] === 'function') {
        const normalizedString = normalizeFunction(target[key])
        const originalFunction = target[key]

        const wrapper = function () {
          return originalFunction.apply(this, arguments)
        }
        wrapper.toString = () => normalizedString
        obj[key] = wrapper
      } else {
        obj[key] = normalizeObjectFunctions(target[key], transform, seen)
      }
    }
  }

  return obj
}

/**
 * Checks whether the given object is an object and has at least one own key.
 * @param {any} obj - The object to check.
 * @returns {boolean} True if the object is truthy and has keys, otherwise false.
 */
export function hasObjectKeys (obj) {
  return obj && typeof obj === 'object' && Object.keys(obj).length > 0
}

/**
 * Merges two arrays, returning a new array with unique items.
 * Uses JSON.stringify for deep comparison of object elements, preserving object uniqueness correctly.
 * @param {Array<any>} [arr1] - The first array.
 * @param {Array<any>} [arr2] - The second array.
 * @returns {Array<any>} A new array with unique values from both input arrays.
 */
export function mergeUniqueObjects (arr1, arr2) {
  const all = [...(arr1 || []), ...(arr2 || [])]
  const seen = new Set()
  return all.filter(item => {
    const key = typeof item === 'object' ? JSON.stringify(item) : item
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

/**
 * Normalizes function declarations to ensure consistent formatting.
 * Converts shorthand method syntax to full function declarations where needed,
 * while preserving arrow functions and existing full declarations.
 *
 * @param {Function} func - The function to normalize
 * @returns {string} The normalized function string representation
 */
export function normalizeFunction (func) {
  const original = func.toString().trim()

  const firstBrace = original.indexOf('{')
  const firstArrow = original.indexOf('=>')

  const isArrow = firstArrow !== -1 && (firstBrace === -1 || firstArrow < firstBrace)

  if (isArrow) {
    return original
  }

  // For non-arrows, extract header to check for shorthand
  const header = firstBrace !== -1 ? original.slice(0, firstBrace).trim() : original

  const isStandard = header.startsWith('function') || header.startsWith('async function')

  if (isStandard) {
    return original
  }

  // Handle Method Shorthand
  if (header.startsWith('async ')) {
    if (header.startsWith('async get ') || header.startsWith('async set ')) {
      return original
    }

    return original.replace(/^async\s+([$\w]+)\s*\(/, 'async function(')
  } else {
    if (header.startsWith('get ') || header.startsWith('set ')) {
      return original
    }

    return original.replace(/^([$\w]+)\s*\(/, 'function(')
  }
}


/**
 * Recursively clones an AST node and its children, ensuring that
 * inner references (like parents and slots) point to the newly cloned nodes.
 *
 * @param {Map<Object, Object>} nodeMap - A map tracking original nodes to their newly cloned counterparts.
 * @param {Object} node - The current AST node being cloned.
 * @param {Object} [parent] - The parent node reference to assign to the clone.
 * @returns {Object} The newly cloned node.
 */
export function cloneNode (nodeMap, node, parent) {
  const newNode = Object.create(Object.getPrototypeOf(node))

  // Copy all own enumerable properties
  Object.assign(newNode, node)

  if (parent) {
    newNode.parent = parent
  }

  if (newNode.attribs) {
    newNode.attribs = { ...newNode.attribs }
  }

  // Register in map
  nodeMap.set(node, newNode)

  // Recursively clone children
  if (node.children) {
    const children = node.children
    const length = children.length
    const clonedChildren = new Array(length)
    newNode.children = clonedChildren

    for (let i = 0; i < length; i++) {
      const clonedChild = cloneNode(nodeMap, children[i], newNode)
      clonedChildren[i] = clonedChild
      if (i > 0) {
        clonedChild.prev = clonedChildren[i - 1]
        clonedChildren[i - 1].next = clonedChild
      }
    }
  }

  // Update slot references to point to new cloned nodes
  if (node.slots) {
    const slots = node.slots
    const length = slots.length
    const clonedSlots = new Array(length)
    for (let i = 0; i < length; i++) {
      const slot = slots[i]
      const clonedSlot = { ...slot }
      if (slot.node) {
        const clonedNode = nodeMap.get(slot.node)
        if (clonedNode) {
          clonedSlot.node = clonedNode
        }
      }
      clonedSlots[i] = clonedSlot
    }
    newNode.slots = clonedSlots
  }

  // Preserve the enhanced flag without re-running enhanceNode
  Object.defineProperty(newNode, '__coralite_enhanced__', {
    value: true,
    enumerable: false,
    configurable: true
  })

  return newNode
}

/**
 * Creates a shallow copy of a CoraliteModule with a deep clone of its DOM tree (template) and re-linked internal references to enable safe independent mutation.
 *
 * Top-level non-DOM state (id, path, script, isTemplate, lineOffset) are shallow copied. Nested objects within these state (e.g., path) remain shared references. Only DOM-related structures undergo deep cloning and reference re-linking to isolate mutations from the original module.
 *
 * @param {CoraliteModule} originalModule - Module to clone.
 * @returns {CoraliteModule}
 */
export function cloneModuleInstance (originalModule) {
  const nodeMap = new Map()

  // Clone the main template tree
  const newTemplate = cloneNode(nodeMap, originalModule.template, null)

  // Reconstruct the 'values' object
  const newValues = {
    attributes: originalModule.values.attributes.map(item => ({
      ...item,
      element: nodeMap.get(item.element)
    })),
    textNodes: originalModule.values.textNodes.map(item => ({
      ...item,
      textNode: nodeMap.get(item.textNode)
    })),
    refs: originalModule.values.refs.map(item => ({
      ...item,
      element: nodeMap.get(item.element)
    }))
  }

  // Reconstruct customElements list
  const newCustomElements = originalModule.customElements.map(el => nodeMap.get(el))

  // Reconstruct slotElements
  const newSlotElements = {}
  if (originalModule.slotElements) {
    for (const modId in originalModule.slotElements) {
      newSlotElements[modId] = {}
      const slotGroup = originalModule.slotElements[modId]

      for (const slotName in slotGroup) {
        const slotItem = slotGroup[slotName]
        newSlotElements[modId][slotName] = {
          ...slotItem,
          element: nodeMap.get(slotItem.element)
        }
      }
    }
  }

  // Return the new module structure
  return {
    ...originalModule,
    template: newTemplate,
    values: newValues,
    customElements: newCustomElements,
    // @ts-ignore
    slotElements: newSlotElements
  }
}

/**
 * Creates a deep copy of a CoraliteComponent with re-linked internal references to enable safe independent mutation.
 *
 * @param {CoraliteComponent & CoraliteComponentResult} originalDocument - Document to clone.
 * @returns {CoraliteComponent & CoraliteComponentResult}
 */
export function cloneComponentInstance (originalDocument) {
  const nodeMap = new Map()
  const newRoot = cloneNode(nodeMap, originalDocument.root, null)

  const newCustomElements = originalDocument.customElements.map(el => nodeMap.get(el))
  const newTempElements = originalDocument.tempElements ? originalDocument.tempElements.map(el => nodeMap.get(el)) : []
  const newSkipRenderElements = originalDocument.skipRenderElements ? originalDocument.skipRenderElements.map(el => nodeMap.get(el)) : []

  return {
    ...originalDocument,
    state: { ...originalDocument.state },
    root: newRoot,
    customElements: newCustomElements,
    tempElements: newTempElements,
    skipRenderElements: newSkipRenderElements
  }
}

/**
 * Calculates the DOM path from a node to the root.
 * @param {Object} node - The node to calculate the path for.
 * @param {Object} root - The root node.
 * @returns {Array<number>} An array of indices representing the path.
 */
export function getNodePath (node, root) {
  const path = []
  let current = node
  while (current && current !== root) {
    const parent = current.parent
    if (!parent) {
      break
    }
    const index = parent.children.indexOf(current)
    if (index === -1) {
      break
    }
    path.unshift(index)
    current = parent
  }
  return path
}

/**
 * Generates a hydration map for the client.
 * @param {Array<Object>} templateNodes - The component's template nodes.
 * @param {Object} templateValues - The component's template values.
 * @returns {Object} The hydration map.
 */
export function generateHydrationMap (templateNodes, templateValues) {
  const map = {
    texts: [],
    attributes: [],
    refs: []
  }

  if (!templateNodes || !templateValues) {
    return map
  }

  const root = templateNodes.length > 0 ? templateNodes[0].parent : { children: templateNodes }

  if (templateValues.textNodes) {
    for (const item of templateValues.textNodes) {
      if (item.textNode) {
        const isHtml = item.type === 'html'
        const targetNode = isHtml ? item.textNode.parent : item.textNode

        map.texts.push({
          path: getNodePath(targetNode, root),
          template: item.textNode.data,
          type: isHtml ? 'html' : 'text'
        })
      }
    }
  }

  if (templateValues.attributes) {
    for (const item of templateValues.attributes) {
      if (item.element && item.element.attribs) {
        const originalValue = item.element.attribs[item.name]
        map.attributes.push({
          path: getNodePath(item.element, root),
          name: item.name,
          template: originalValue
        })
      }
    }
  }

  if (templateValues.refs) {
    for (const item of templateValues.refs) {
      if (item.element) {
        map.refs.push({
          path: getNodePath(item.element, root),
          name: item.name
        })
      }
    }
  }

  return map
}

/**
 * Recursively adds a component and its dependencies to a tracking object.
 *
 * @param {string} componentId - The ID of the component to add.
 * @param {Object.<string, boolean>} processed - The object tracking processed components.
 * @param {Object.<string, any>} sharedFunctions - The map of shared component functions.
 */
export function addComponentAndDependencies (componentId, processed, sharedFunctions) {
  if (!processed[componentId] && sharedFunctions[componentId]) {
    processed[componentId] = true

    // Add all dependencies of this component
    const dependencies = sharedFunctions[componentId].components || []
    for (const depId of dependencies) {
      addComponentAndDependencies(depId, processed, sharedFunctions)
    }
  }
}

/**
 * Recursively clones an AST node and its children, stripping circular references
 * and assigning unique IDs for client-side hydration.
 *
 * @param {Array<Object>} nodes - The nodes to clean.
 * @param {WeakMap} nodeMap - Map to track original nodes to their unique IDs.
 * @param {Object} state - Object containing the current node counter.
 * @returns {Array<Object>|null} The cleaned AST nodes.
 */
export function cleanAST (nodes, nodeMap, state) {
  if (!nodes) {
    return null
  }

  return nodes.map((node) => {
    const cloned = { ...node }
    // Assign unique ID for token mapping
    const id = state.counter++
    nodeMap.set(node, id)
    cloned._id = id

    // Remove circular references
    delete cloned.parent
    delete cloned.prev
    delete cloned.next
    delete cloned.slots

    if (cloned.children) {
      cloned.children = cleanAST(cloned.children, nodeMap, state)
    }
    return cloned
  })
}

/**
 * Cleans the template values object, mapping original node references to unique IDs.
 *
 * @param {Object} values - The values object to clean.
 * @param {WeakMap} nodeMap - Map of original nodes to their unique IDs.
 * @returns {Object|null} The cleaned values object.
 */
export function cleanValues (values, nodeMap) {
  if (!values) {
    return null
  }

  const result = { ...values }

  if (result.attributes) {
    result.attributes = result.attributes.map(item => {
      const cloned = { ...item }
      cloned.elementId = nodeMap.get(item.element)
      delete cloned.element
      return cloned
    })
  }

  if (result.textNodes) {
    result.textNodes = result.textNodes.map(item => {
      const cloned = { ...item }
      cloned.textNodeId = nodeMap.get(item.textNode)
      delete cloned.textNode
      return cloned
    })
  }

  if (result.refs) {
    result.refs = result.refs.map(item => {
      const cloned = { ...item }
      cloned.elementId = nodeMap.get(item.element)
      delete cloned.element
      return cloned
    })
  }
  return result
}

/**
 * Safely merges partial plugin updates into the main context object.
 * Deeply merges plain objects and overwrites other types (arrays, primitives, etc.).
 *
 * @param {any} current - The current state object.
 * @param {any} patch - The patch object containing updates.
 * @returns {any} The newly merged state object.
 */
export function mergePluginState (current, patch) {
  if (!patch || typeof patch !== 'object') {
    return current
  }

  const result = { ...current }

  for (const key of Object.keys(patch)) {
    const patchValue = patch[key]
    const currentValue = result[key]

    // If both are plain objects, merge them deeply
    if (
      patchValue && typeof patchValue === 'object' && !Array.isArray(patchValue) &&
      currentValue && typeof currentValue === 'object' && !Array.isArray(currentValue)
    ) {
      result[key] = mergePluginState(currentValue, patchValue)
    } else {
      // Otherwise, overwrite (Arrays, strings, numbers, etc.)
      result[key] = patchValue
    }
  }

  return result
}

/**
 * Creates a reactive proxy that triggers a callback on changes.
 * Supports deep reactivity via lazy proxying of nested objects.
 *
 * @param {Object} target - The object to proxy.
 * @param {Function} onChange - Callback triggered when a property is set or deleted.
 * @param {WeakMap} [proxies=new WeakMap()] - Cache for existing proxies to handle circular references and identity.
 * @returns {Proxy} The reactive proxy.
 */
export function createReactiveProxy (target, onChange, proxies = new WeakMap()) {
  if (proxies.has(target)) {
    return proxies.get(target)
  }

  const handler = {
    get (target, property, receiver) {
      const value = Reflect.get(target, property, receiver)
      if (value !== null && typeof value === 'object' && !(typeof Node !== 'undefined' && value instanceof Node)) {
        return createReactiveProxy(value, onChange, proxies)
      }
      return value
    },
    set (target, property, value, receiver) {
      const oldValue = target[property]
      if (oldValue === value && property in target) {
        return true
      }

      const result = Reflect.set(target, property, value, receiver)
      if (result) {
        onChange({
          property,
          value,
          oldValue,
          target
        })
      }
      return result
    },
    deleteProperty (target, property) {
      const hadProperty = Object.prototype.hasOwnProperty.call(target, property)
      const oldValue = target[property]
      const result = Reflect.deleteProperty(target, property)
      if (result && hadProperty) {
        onChange({
          property,
          value: undefined,
          oldValue,
          target,
          deleted: true
        })
      }
      return result
    }
  }

  const proxy = new Proxy(target, handler)
  proxies.set(target, proxy)
  return proxy
}

/**
 * Creates a read-only proxy that throws on mutation attempts.
 * @param {Object} target - The object to proxy.
 * @param {WeakMap} [proxies=new WeakMap()] - Cache for existing proxies.
 * @returns {Proxy} The read-only proxy.
 */
export function createReadOnlyProxy (target, proxies = new WeakMap()) {
  if (proxies.has(target)) {
    return proxies.get(target)
  }

  const handler = {
    get (target, property, receiver) {
      const value = Reflect.get(target, property, receiver)
      if (value !== null && typeof value === 'object' && !(typeof Node !== 'undefined' && value instanceof Node)) {
        return createReadOnlyProxy(value, proxies)
      }
      return value
    },
    set () {
      throw new Error('Coralite Error: Cannot mutate state inside a getter. State is read-only here.')
    },
    deleteProperty () {
      throw new Error('Coralite Error: Cannot delete state inside a getter. State is read-only here.')
    }
  }

  const proxy = new Proxy(target, handler)

  proxies.set(target, proxy)

  return proxy
}

/**
 * Defines a Coralite component.
 * On the client, this acts as an identity function for type safety and HRM.
 * @param {Object} options - Component options
 * @returns {Object} The component options
 */
export function defineComponent (options) {
  return options
}
