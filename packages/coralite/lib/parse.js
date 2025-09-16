import { Parser } from 'htmlparser2'
import { isValidCustomElementName, VALID_TAGS } from './tags.js'

/**
 * @import {
 *  CoraliteToken,
 *  CoraliteModule,
 *  CoraliteTextNode,
 *  CoraliteElement,
 *  CoraliteModuleSlotElement,
 *  CoraliteDocumentValues,
 *  CoraliteDocumentRoot,
 *  CoraliteContentNode,
 *  IgnoreByAttribute,
 *  ParseHTMLResult} from '../types/index.js'
 */

/**
 * Parse HTML content and return a CoraliteDocument object representing the parsed document structure
 *
 * @param {string} string - HTML content to parse as string input type textual data
 * @param {IgnoreByAttribute[]} [ignoreByAttribute] - Ignore element with attribute name value pair
 * @returns {ParseHTMLResult}
 * @example parseHTML('<h1>Hello world!</h1>')
 */
export function parseHTML (string, ignoreByAttribute) {
  // root element reference
  /** @type {CoraliteDocumentRoot} */
  const root = {
    type: 'root',
    children: []
  }

  // stack to keep track of current element hierarchy
  /** @type {CoraliteContentNode[]} */
  const stack = [root]
  const customElements = []
  /** @type {CoraliteElement[]} */
  const tempElements = []

  const parser = new Parser({
    onprocessinginstruction (name, data) {
      root.children.push({
        type: 'directive',
        name,
        data
      })
    },
    onopentag (originalName, attributes) {
      const name = originalName.toLowerCase()
      const parent = stack[stack.length - 1]
      const element = createElement({
        name,
        attributes,
        parent,
        ignoreByAttribute
      })

      if (element.slots) {
        // store custom element
        customElements.push(element)
      }

      // push element to stack as it may have children
      stack.push(element)
    },
    ontext (text) {
      const parent = stack[stack.length - 1]

      createTextNode(text, parent)
    },
    onclosetag () {
      const element = stack[stack.length - 1]

      if (element.type === 'tag' && element.remove) {
        // store element for removal
        // @ts-ignore
        tempElements.push(element.parent.children[element.parent.children.length - 1])
      }

      // remove current element from stack as we're done with its children
      stack.pop()
    },
    oncomment (data) {
      const parent = stack[stack.length - 1]

      parent.children.push({
        type: 'comment',
        data,
        parent
      })
    }
  })

  parser.write(string)
  parser.end()

  sortSlottedChildren(customElements)

  return {
    root,
    customElements,
    tempElements
  }
}

/**
 * Processes custom elements to organize their children by slot name.
 * @param {CoraliteElement[]} elements - Array of custom element objects with `children` and `attribs`.
 */
function sortSlottedChildren (elements) {
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i]

    for (let i = 0; i < element.children.length; i++) {
      const childNode = element.children[i]
      let slotName = 'default'

      if (childNode.type === 'tag'
        && childNode.attribs
        && childNode.attribs.slot) {
        slotName = childNode.attribs.slot

        // clean up slot attribute
        delete childNode.attribs.slot
      }

      element.slots.push({
        name: slotName,
        node: childNode
      })
    }
  }
}

/**
 * Parses HTML string containing meta tags or generates Coralite module structure from markup.
 *
 * @param {string} string - HTML content containing meta tags or module markup
 * @param {Object} options
 * @param {IgnoreByAttribute[]} options.ignoreByAttribute - An array of attribute names and values to ignore during parsing
 * @returns {CoraliteModule} - Parsed module information, including template, script, tokens, and slot configurations
 *
 * @example
 * ```
 * // example usage:
 * const html = `<template id="home">
 *   <slot name="default">Hello</slot>
 * </template>`;
 * const module = parseModule(html, { ignoreByAttribute: [] });
 *
 * // module object structure will be:
 * //{
 * //  id: 'home',
 * //  template: { ... },
 * //  tokens: [],
 * //  customElements: [],
 * //  slotElements: {
 * //    default: {
 * //      name: 'slot',
 * //      element: {}
 * //    }
 * //  }
 * //}
 * ```
 */
export function parseModule (string, { ignoreByAttribute }) {
  // root element reference
  /** @type {CoraliteDocumentRoot} */
  const root = {
    type: 'root',
    children: []
  }
  // stack to keep track of current element hierarchy
  /** @type {CoraliteContentNode[]} */
  const stack = [root]
  const customElements = []
  /** @type {Object.<string, Object.<string,CoraliteModuleSlotElement>>} */
  const slotElements = {}
  /** @type {CoraliteDocumentValues} */
  const documentValues = {
    refs: [],
    attributes: [],
    textNodes: []
  }
  let isScript = false
  let isTemplate = false
  let templateId = ''

  const parser = new Parser({
    onopentag (originalName, attributes) {
      const parent = stack[stack.length -1]
      const element = createElement({
        name: originalName,
        attributes,
        parent,
        ignoreByAttribute
      })

      if (element.slots) {
        customElements.push(element)
      }

      // push element to stack as it may have children
      stack.push(element)

      if (element.name === 'script') {
        isScript = true
      } else if (element.name === 'template') {
        // enter template tag
        isTemplate = true

        if (!attributes.id) {
          throw new Error('Template requires an "id"')
        }

        if (!isValidCustomElementName(attributes.id)) {
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
      } else if (isTemplate) {
        const attributeNames = Object.keys(attributes)

        // collect tokens inside template tag
        if (attributeNames.length) {
          for (let i = 0; i < attributeNames.length; i++) {
            const name = attributeNames[i]
            const value = attributes[name]
            const tokens = getTokensFromString(value)

            // store attribute tokens
            if (tokens.length) {
              documentValues.attributes.push({
                name,
                tokens,
                element
              })
            }

            if (name === 'ref') {
              documentValues.refs.push({
                name: value,
                element
              })
            }
          }
        }
      }
    },
    ontext (text) {
      const parent = stack[stack.length - 1]
      const textNode = createTextNode(text, parent)

      if (isTemplate && !isScript && text.trim()) {
        const tokens = getTokensFromString(text)

        // store tokens
        if (tokens.length) {
          documentValues.textNodes.push({
            tokens,
            textNode
          })
        }
      }
    },
    onclosetag (name) {
      const element = stack[stack.length - 1]

      if (element.type === 'tag' && element.remove) {
        // remove element from tree
        element.parent.children.pop()
      }

      if (name === 'template') {
        // exit template tag
        isTemplate = false
      } else if (name === 'script') {
        isScript = false
      }

      // remove current element from stack as we're done with its children
      stack.pop()
    },
    oncdatastart (csb) {
      console.log(csb)
    },

    oncomment (data) {
      stack[stack.length - 1].children.push({
        type: 'comment',
        data,
        parent: stack[stack.length - 1]
      })
    }
  })

  parser.write(string)
  parser.end()

  /** @type {CoraliteElement} */
  let template
  let script

  for (let i = 0; i < root.children.length; i++) {
    const node = root.children[i]

    if (node.type === 'tag') {
      if (node.name === 'template') {
        if (template) {
          throw new Error('One template element is permitted')
        }

        template = node

      } else if (node.name == 'script') {
        if (node.attribs.type !== 'module') {
          throw new Error('Template "'+ templateId + '" script tag must contain the `type="module"` attribute')
        }
        const scriptString = node.children[0]

        if (scriptString.type !== 'text') {
          throw new Error('Script tag must contain text')
        }

        script = scriptString.data
      }
    }
  }

  if (!template) {
    throw new Error('Template element is missing')
  }

  const scriptIndex = string.indexOf('<script')
  const stringHead = string.substring(0, scriptIndex)
  const lineOffset = stringHead.split(/\r\n|\r|\n/).length - 1

  return {
    id: template.attribs.id,
    template,
    script,
    values: documentValues,
    lineOffset,
    customElements,
    slotElements
  }
}


/**
 * In place add metadata to meta
 * @param {Object.<string, (string | CoraliteToken[])>} meta - The metadata object to which the new entry will be added.
 * @param {string} name - The key under which the content will be stored in the meta object.
 * @param {string} content - The value associated with the specified key.
 */
function addMetadata (meta, name, content) {
  let entry = meta[name]

  if (!entry) {
    // if the metadata key does not exist, initialize it with the provided content.
    meta[name] = content
  } else {
    // if the existing value is not an array, convert it into an array containing a single object
    // with the name and content. This allows for handling multiple values under the same metadata key.
    if (!Array.isArray(entry)) {
      meta[name] = [{
        name,
        content: entry
      }]
      entry = meta[name]
    }
    // add the new content to the array as a new object, preserving existing entries.
    // this is useful for adding multiple values (e.g., Open Graph metadata) under the same key.
    entry.push({
      name,
      content
    })
  }
}

/**
 * Creates an element within the document structure based on provided parameters.
 * @param {Object} data - An object containing details needed to create the element.
 * @param {string} data.name - The tag name of the new element.
 * @param {Object.<string, string>} data.attributes - Attributes for the new element.
 * @param {CoraliteElement | CoraliteDocumentRoot} data.parent - Parent element or document root where this element will be attached.
 * @param {IgnoreByAttribute[]} [data.ignoreByAttribute] - Optional parameter used for ignoring elements based on attributes.
 * @returns {CoraliteElement} The newly created element with its parent reference and position in the parent's children list.
 */
export function createElement ({
  name,
  attributes,
  parent,
  ignoreByAttribute
}) {
  const sanitisedName = name.toLowerCase()

  /** @type {CoraliteElement} */
  const element = {
    type: 'tag',
    name: sanitisedName,
    attribs: attributes,
    children: [],
    parent,
    parentChildIndex: parent.children.length
  }

  if (ignoreByAttribute) {
    const ignore = findAttributesToIgnore(ignoreByAttribute, attributes)

    if (ignore) {
      element.remove = true
    }
  }

  if (!VALID_TAGS[sanitisedName]) {
    // check if the tag name matches the regex for valid custom elements
    if (isValidCustomElementName(sanitisedName)) {
      // store custom elements
      element.slots = []
    } else {
      throw new Error('Invalid custom element tag name: "' + sanitisedName + '" https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name')
    }
  }

  // add element to its parent's children
  parent.children.push(element)

  return element
}

/**
 * @param {string} data - The text content to create a text node
 * @param {CoraliteElement | CoraliteDocumentRoot} parent - parent node
 * @returns {CoraliteTextNode}
 *
 * @example
 * const textNode = createTextNode('Hello World', parentNode);
 */
export function createTextNode (data, parent) {
  /** @type {CoraliteTextNode} */
  const textNode = {
    type: 'text',
    data,
    parent
  }

  // @ts-ignore
  parent.children.push(textNode)

  return textNode
}

/**
 * Find attributes to be ignored by the parser.
 *
 * @param {IgnoreByAttribute[]} ignoreByAttribute - An array of attribute pairs to be ignored by the parser
 * @param {Object<string, string>} attributes - The HTML attribute object to be parsed by the parser
 * @returns {boolean}
 */
function findAttributesToIgnore (ignoreByAttribute, attributes) {
  for (let i = 0; i < ignoreByAttribute.length; i++) {
    const { name, value } = ignoreByAttribute[i]

    if (attributes[name] && attributes[name].includes(value)) {
      return true
    }
  }

  return false
}

/**
 * Extract attributes from string
 * @param {string} string
 * @returns {CoraliteToken[]}
 */
function getTokensFromString (string) {
  if (string.length > 100) {
    console.warn(`Token "${string}" is too long`)
  }

  const matches = string.matchAll(/\{\{[^}]{0,100}?\}\}/g)
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
