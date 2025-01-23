import { Parser } from 'htmlparser2'
import { aggregate } from './coralite.js'
import vm from 'node:vm'
import { invalidCustomTags, validTags } from './tags.js'

/**
 * @import {Module} from 'node:vm'
 * @import {
 *  HTMLData,
 *  CoraliteDocument,
 *  CoralitePath,
 *  CoraliteToken,
 *  CoraliteModule,
 *  CoraliteTextNode,
 *  CoraliteElement,
 *  CoraliteSlotElement,
 *  CoraliteModuleSlotElement,
 *  CoraliteDocumentTokens} from '#types'
 */

const customElementTagRegExp = /^[^-].*[-._a-z0-9\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u{10000}-\u{EFFFF}]*$/ui

const customElementTagTokenRegExp = /^[^-].*[-._a-z0-9\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u{10000}-\u{EFFFF}\{\}]*$/ui

/**
 * Parses HTML content into a Coralite document structure.
 *
 * @param {HTMLData} html - The HTML data containing the content to parse
 * @param {CoralitePath} path - The path object containing the file path information
 * @returns {CoraliteDocument} An object representing the parsed document structure
 *
 * @example
 * // Example usage:
 * const html = {
 *   name: 'index.html',
 *   parentPath: 'path/to/parent',
 *   content: '<div>Content</div>'
 * };
 *
 * const path = {
 *   pages: 'path/to/pages',
 *   components: 'path/to/components'
 * };
 *
 * const document = parseHTMLDocument(html, path);
 * // document.nodes will contain parsed elements and text nodes
 */
export function parseHTMLDocument (html, path) {
  // root element reference
  const root = []
  // stack to keep track of current element hierarchy
  const stack = []
  const customElements = []
  /** @type {Object.<string, CoraliteSlotElement[]>} */
  const customElementSlots = {}

  const parser = new Parser({
    onopentag (originalName, attributes) {
      const element = createElement(originalName, attributes, customElements, stack, root)

      if (attributes.slot) {
        const customElement = customElements[customElements.length - 1]
        const slot = {
          name: attributes.slot,
          customElement,
          element
        }

        if (!customElementSlots[customElement.name]) {
          customElementSlots[customElement.name] = [slot]
        } else {
          customElementSlots[customElement.name].unshift(slot)
        }

        // remove slot attribute
        delete attributes.slot
      }
    },
    ontext (text) {
      if (text.trim()) {
        createTextNode(text, stack)
      }
    },
    onclosetag () {
      // remove current element from stack as we're done with its children
      stack.pop()
    },
    oncomment (comment) {
      stack[stack.length - 1].children.push({
        type: 'comment',
        data: comment,
        parent: stack[stack.length - 1]
      })
    }
  })

  parser.write(html.content)
  parser.end()

  return {
    name: html.name,
    parentPath: html.parentPath,
    nodes: root,
    customElements,
    customElementSlots,
    path
  }
}

/**
 * Parses HTML string containing meta tags and extracts associated metadata.
 *
 * @param {string} string - HTML content containing meta tags
 * @returns {Object.<string, CoraliteToken[]>}
 *
 * @example
 * // Example usage:
 * const html = `<meta name="title" content="Finding Nemo">`;
 * const meta = parseHTMLMeta(html);
 *
 * // Output will be an object like:
 * //{
 * //  "title": [ { name: 'title', content: 'Finding Nemo' } ],
 * //}
 */
export function parseHTMLMeta (string) {
  // stack to keep track of current element hierarchy
  const stack = []
  /** @type {Object.<string, CoraliteToken[]>} */
  const meta = {}

  const parser = new Parser({
    onopentag (name, attributes) {
      if (name === 'meta') {
        if (attributes.content) {
          if (attributes.property) {
            addMetadata(meta, attributes.property, attributes.content)
          }

          if (attributes.name) {
            addMetadata(meta, attributes.name, attributes.content)
          }
        }
      }
    },
    onclosetag (name) {
      if (name === 'head') {
        // end on closing head tag
        return parser.end()
      }
      // remove current element from stack as we're done with its children
      stack.pop()
    },
    oncomment (comment) {
      stack[stack.length - 1].children.push({
        type: 'comment',
        data: comment,
        parent: stack[stack.length - 1]
      })
    }
  })

  parser.write(string)
  parser.end()

  return meta
}


/**
 * @param {string} string
 * @returns {CoraliteModule}
 */
export function parseModule (string) {
  // root element reference
  const root = []
  // stack to keep track of current element hierarchy
  const stack = []
  const customElements = []
  /** @type {Object.<string, Object.<string,CoraliteModuleSlotElement>>} */
  const slotElements = {}

  /** @type {CoraliteDocumentTokens} */
  const documentTokens = {
    attributes: [],
    textNodes: []
  }
  let templateId = ''

  const parser = new Parser({
    onopentag (originalName, attributes) {
      const element = createElement(originalName, attributes, customElements, stack, root)
      const attributeNames = Object.keys(attributes)

      // collect tokens
      if (attributeNames.length) {
        for (let i = 0; i < attributeNames.length; i++) {
          const name = attributeNames[i]
          const tokens = getTokensFromString(attributes[name])

          // store attribute tokens
          if (tokens.length) {
            documentTokens.attributes.push({
              name,
              tokens,
              element
            })
          }
        }
      }

      if (element.name === 'template') {
        if (!attributes.id) {
          throw new Error('Template requires an "id"')
        }

        let idHasToken = false
        // check if template id contains a token
        for (let i = 0; i < documentTokens.attributes.length; i++) {
          const token = documentTokens.attributes[i]

          if (token.name === 'id') {
            idHasToken = true
            break
          }
        }

        if (!customElementTagRegExp.test(attributes.id)
          || (idHasToken && !customElementTagTokenRegExp.test(attributes.id))) {
          throw new Error('Invalid template id: "' + originalName + '" it must match following the pattern https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name')
        }

        templateId = attributes.id
      } else if (element.name === 'slot') {
        const name = attributes.name || 'default'

        if (slotElements[templateId] && slotElements[templateId][name]) {
          throw new Error('Slot names must be unique: "' + name + '"')
        }

        const slot = {
          name,
          element
        }

        if (!slotElements[templateId]) {
          slotElements[templateId] = {
            [name]: slot
          }
        } else {
          slotElements[templateId][name] = slot
        }
      }
    },
    ontext (text) {
      if (text.trim()) {
        const textNode = createTextNode(text, stack)
        const tokens = getTokensFromString(text)

        // store tokens
        if (tokens.length) {
          documentTokens.textNodes.push({
            tokens,
            textNode
          })
        }
      }
    },
    onclosetag () {
      // remove current element from stack as we're done with its children
      stack.pop()
    },
    oncdatastart (csb) {
      console.log(csb)
    },

    oncomment (comment) {
      stack[stack.length - 1].children.push({
        type: 'comment',
        data: comment,
        parent: stack[stack.length - 1]
      })
    }
  })

  parser.write(string)
  parser.end()

  /** @type {CoraliteElement} */
  let template
  let script

  for (let i = 0; i < root.length; i++) {
    const node = root[i]

    if (node.type === 'text') {
      continue
    }

    if (node.name === 'template') {
      if (template) {
        throw new Error('One template element is permitted')
      }

      template = node

    } else if (node.name == 'script') {
      if (node.attribs.type !== 'module') {
        throw new Error('Script tag must contain the `type="module"` attribute')
      }

      script = node.children[0].data
    }
  }

  if (!template) {
    throw new Error('Template element is missing')
  }

  return {
    id: template.attribs.id,
    template,
    script,
    tokens: documentTokens,
    customElements,
    slotElements
  }
}

/**
 * @param {Object} options
 * @param {string} options.id
 * @param {Object.<string, (string | (CoraliteTextNode | CoraliteElement)[])>} options.values
 * @param {Object.<string, CoraliteModuleSlotElement[]>} [options.customElementSlots = {}]
 * @param {Object.<string, CoraliteModule>} options.components
 * @param {CoraliteDocument} options.document
 * @returns {Promise<CoraliteElement>}
 */
export async function createComponent ({
  id,
  values,
  customElementSlots = {},
  components,
  document
}) {
  let component = components[id]

  if (!component) {
    throw new Error('Could not find component: "' + id +'"')
  }

  component = structuredClone(component)
  const template = component.template
  const computedTokens = []

  for (let i = 0; i < component.tokens.attributes.length; i++) {
    const item = component.tokens.attributes[i]

    for (let i = 0; i < item.tokens.length; i++) {
      const token = item.tokens[i]
      let value = values[token.name]

      if (value == null) {
        if (component.script) {
          computedTokens.push({
            type: 'element',
            node: item.element,
            name: token.name,
            content: token.content
          })

          continue
        } else {
          console.error('Token "' + token.name +'" was empty used on "' + component.id + '"')
          value = ''
        }
      }

      // replace token with value
      item.element.attribs[item.name] = item.element.attribs[item.name].replace(token.content, value)
    }
  }

  for (let i = 0; i < component.tokens.textNodes.length; i++) {
    const item = component.tokens.textNodes[i]

    for (let i = 0; i < item.tokens.length; i++) {
      const token = item.tokens[i]
      let value = values[token.name]

      if (value == null) {
        if (component.script) {
          computedTokens.push({
            type: 'textNode',
            node: item.textNode,
            name: token.name,
            content: token.content
          })

          continue
        } else {
          console.error('Token "' + token.name +'" was empty used on "' + component.id + '"')
          value = ''
        }
      }

      // replace token with value
      item.textNode.data = item.textNode.data.replace(token.content, value)
    }
  }

  // merge values from component script
  if (component.script) {
    const computedValues = await parseScript(component, values, components, document)

    values = Object.assign(values, computedValues)

    for (let i = 0; i < computedTokens.length; i++) {
      const computedToken = computedTokens[i]
      const node = computedToken.node
      const value = values[computedToken.name]

      if (computedToken.type === 'attribute') {
        // replace token string
        node.attribs[computedToken.name] = node.attribs[computedToken.name].replace(computedToken.content, value)
      } else {
        if (Array.isArray(value)) {
          // inject nodes
          const textSplit = node.data.split(computedToken.content)
          const childIndex = node.parent.children.indexOf(node)

          node.parent.children.splice(childIndex, 1,
            {
              type: 'text',
              data: textSplit[0],
              parent: node.parent
            },
            ...value,
            {
              type: 'text',
              data: textSplit[1],
              parent: node.parent
            }
          )
        } else {
          // replace token string
          node.data = node.data.replace(computedToken.content, value)
        }
      }
    }
  }

  // replace nested customElements
  const customElements = component.customElements
  let childIndex

  for (let i = 0; i < customElements.length; i++) {
    const customElement = customElements[i]
    const component = await createComponent({
      id: customElement.name,
      values: Object.assign(values, customElement.attribs),
      customElementSlots,
      components,
      document
    })
    const children = customElement.parent.children

    if (!childIndex) {
      childIndex = customElement.parentChildIndex
    } else {
      childIndex = children.indexOf(customElement, customElement.parentChildIndex)
    }

    // replace custom element with component
    children.splice(childIndex, 1, ...component.children)
  }

  const slots = customElementSlots[id]

  if (slots) {
    const componentSlots = component.slotElements[id]
    const usedSlots = {}
    const slotIndexes = {}

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]
      const name = slot.name

      if (componentSlots[name]) {
        const componentSlot = componentSlots[name]
        const parentChildren = componentSlot.element.parent.children
        let slotIndex = slotIndexes[name]
        let deleteCount = 0

        if (slotIndex == null) {
          slotIndex = parentChildren.indexOf(componentSlot.element, componentSlot.element.parentChildIndex)
          deleteCount = 1
          slotIndexes[name] = slotIndex
        }

        parentChildren.splice(slotIndex, deleteCount, slot.element)
        usedSlots[slot.name] = true
      }
    }

    for (const name in componentSlots) {
      if (Object.prototype.hasOwnProperty.call(componentSlots, name)) {
        if (!usedSlots[name]) {
          const componentSlot = componentSlots[name]
          const element = componentSlot.element
          const parent = element.parent
          const children = element.children || [{
            type: 'text',
            data: ''
          }]
          const slotIndex = parent.children.indexOf(componentSlot.element, componentSlot.element.parentChildIndex)


          for (let i = 0; i < children.length; i++) {
            const childNode = children[i]
            childNode.parent = parent
          }

          // replace unused slots with default values
          parent.children.splice(slotIndex, 1, ...children)
        }
      }
    }
  }

  return template
}

/**
 * @param {CoraliteModule} component - Coralite module
 * @param {Object.<string, string>} values - Coralite tokens
 * @param {Object.<string, CoraliteModule>} components
 * @param {Object} document
 */
export async function parseScript (component, values, components, document) {
  const contextifiedObject = vm.createContext({
    coralite: {
      tokens: values,
      /**
       * @param {Object} options
       * @param {Object.<string, (string | function)>} options.tokens
       * @returns {Promise<Object.<string, string>>}
       */
      async defineComponent (options) {
        /** @type {Object.<string, string>} */
        const values = {}

        if (options.tokens) {
          for (const key in options.tokens) {
            if (Object.prototype.hasOwnProperty.call(options.tokens, key)) {
              const token = options.tokens[key]

              if (typeof token === 'function') {
                values[key] = await token()
              }
            }
          }
        }

        return values
      },
      /**
       * @param {Object} options
       * @param {string} options.componentId
       * @param {string} options.path
       */
      async aggregate (options) {
        const component = components[options.componentId]

        if (!component) {
          throw new Error('Aggregate: no component found by the id: ' + options.componentId)
        }

        return await aggregate(options, values, components, document)
      }
    }
  })

  const script = new vm.SourceTextModule(component.script, {
    context: contextifiedObject
  })

  await script.link(moduleLinker)
  await script.evaluate()

  // @ts-ignore
  if (script.namespace.default) {
    // @ts-ignore
    return await script.namespace.default
  }

  throw new Error('Script found module export: "' + component.id + '"')
}

/**
 * @param {string} specifier - The specifier of the requested module
 * @param {Module} referencingModule - The Module object link() is called on.
 */
async function moduleLinker (specifier, referencingModule) {
  if (specifier === 'coralite') {
    return new vm.SourceTextModule(`
      export const tokens = coralite.tokens
      export const defineComponent = coralite.defineComponent
      export const aggregate = coralite.aggregate
      export default { tokens, defineComponent, aggregate };
    `, { context: referencingModule.context })
  }

  throw new Error(`Unable to resolve dependency: ${specifier}`)
}

/**
 * Extract attributes from string
 * @param {string} string
 * @returns {CoraliteToken[]}
 */
function getTokensFromString (string) {
  const matches = string.matchAll(/\{{[^}]*\}}/g)
  const result = []

  for (const match of matches) {
    const token = match[0]

    result.push({
      name: token.slice(2, token.length -2).trim(),
      content: token
    })
  }

  return result
}

/**
 * In place add metadata to meta
 * @param {Object.<string, CoraliteToken[]>} meta
 * @param {string} name
 * @param {string} content
 */
function addMetadata (meta, name, content) {
  let entry = meta[name]

  if (!entry) {
    meta[name] = []
    entry = meta[name]
  }

  // add og graph
  entry.push({
    name,
    content
  })
}

/**
 * @param {string} name
 * @param {Object.<string, string>} attributes
 * @param {CoraliteElement[]} customElements
 * @param {CoraliteElement[]} stack
 * @param {CoraliteElement[]} root
 */
function createElement (name, attributes, customElements, stack, root) {
  const sanitisedName = name.toLowerCase()
  const parentIndex = stack.length - 1
  /** @type {CoraliteElement} */
  const element = {
    type: 'tag',
    name: sanitisedName,
    attribs: attributes,
    children: []
  }

  if (!validTags[sanitisedName]) {
    if (invalidCustomTags[sanitisedName]) {
      throw new Error('Element name is reserved: "'+ sanitisedName +'"')
    }

    if (customElementTagRegExp.test(sanitisedName)) {
      // store custom elements
      customElements.push(element)
    } else {
      throw new Error('Invalid custom element tag name: "' + sanitisedName + '" https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name')
    }
  }

  if (parentIndex === -1) {
    root.push(element)
  } else {
    const parent = stack[parentIndex]

    element.parent = parent
    element.parentChildIndex = parent.children.length

    // add element to its parent's children
    parent.children.push(element)
  }

  // push element to stack as it may have children
  stack.push(element)

  return element
}

/**
 * @param {string} text
 * @param {CoraliteElement[]} stack
 * @returns {CoraliteTextNode}
 */
function createTextNode (text, stack) {
  // store if contains data
  const parentIndex = stack.length - 1
  const textNode = {
    type: 'tag',
    data: text,
    parent: stack[parentIndex]
  }

  stack[parentIndex].children.push(textNode)

  return textNode
}

