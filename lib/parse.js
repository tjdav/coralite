import { Parser } from 'htmlparser2'
import { aggregate } from './html-module.js'
import { createContext, SourceTextModule } from 'node:vm'
import { invalidCustomTags, validTags } from './tags.js'
import { isCoraliteComment, isCoraliteElement, isCoraliteTextNode } from './type-helper.js'
import { resolve, join } from 'node:path'
import { cleanKeys } from './utils.js'

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
 *  CoraliteModuleSlotElement,
 *  CoraliteDocumentTokens,
 *  CoraliteDocumentRoot,
 *  CoraliteContentNode,
 *  CoraliteModuleValues,
 *  IgnoreByAttribute,
 *  CoraliteAggregate,
 *  CoraliteAnyNode,
 *  CoraliteDirective,
 *  CoraliteComponent
 * } from '#types'
 */

const customElementTagRegExp = /^[^-].*[-._a-z0-9\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u{10000}-\u{EFFFF}]*$/ui

const customElementTagTokenRegExp = /^[^-].*[-._a-z0-9\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u{10000}-\u{EFFFF}\{\}]*$/ui


/**
 * Parse HTML content and return a CoraliteDocument object representing the parsed document structure
 *
 * @param {string} string - HTML content to parse as string input type textual data
 * @param {IgnoreByAttribute} [ignoreByAttribute] - Ignore element with attribute name value pair
 * @returns {{ root: CoraliteDocumentRoot, customElements: CoraliteElement[] }}
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

  const parser = new Parser({
    onprocessinginstruction (name, data) {
      root.children.push({
        type: 'directive',
        name,
        data
      })
    },
    onopentag (originalName, attributes) {
      const parent = stack[stack.length - 1]
      const element = createElement({
        name: originalName,
        attributes,
        customElements,
        parent,
        ignoreByAttribute
      })

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
        // remove element from tree
        element.parent.children.pop()
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

  for (let i = 0; i < customElements.length; i++) {
    const customElement = customElements[i]

    for (let i = 0; i < customElement.children.length; i++) {
      const childNode = customElement.children[i]
      let slotName = 'default'

      if (childNode.attribs && childNode.attribs.slot) {
        slotName = childNode.attribs.slot

        // clean up slot attribute
        delete childNode.attribs.slot
      }

      customElement.slots.push({
        name: slotName,
        node: childNode
      })
    }
  }

  return {
    root,
    customElements
  }
}

/**
 * Parses HTML content into a Coralite document structure, optionally ignoring elements based on attribute name-value pairs.
 *
 * @param {HTMLData} html - The HTML data containing the content to parse
 * @param {CoralitePath} path - The path object containing the file path information
 * @param {IgnoreByAttribute} [ignoreByAttribute] - Array of attribute name-value pairs to ignore elements with
 * @returns {CoraliteDocument} An object representing the parsed document structure, with ignored elements excluded from the output
 *
 * @example
 * ```
 * // Example usage:
 * const html = {
 *   path: {
 *     pathname: 'index.html',
 *     dirname: 'path/to/parent',
 *     filename: 'index.html',
 *     page: 'path/to/pages',
 *     pageName: 'path/to/pages/index.html'
 *   },
 *   content: '<div>Content</div>'
 * };
 *
 * const path = {
 *   pages: 'path/to/pages',
 *   templates: 'path/to/templates'
 * };
 *
 * const document = parseHTMLDocument(html, path, [ ['data-ignore', 'true'] ]);
 * // document.root will contain parsed elements and text nodes, excluding any ignored elements
 * ```
 */
export function parseHTMLDocument (html, path, ignoreByAttribute) {
  const result = parseHTML(html.content, ignoreByAttribute)

  return {
    root: result.root,
    customElements: result.customElements,
    path: Object.assign(path, html.path),
    ignoreByAttribute
  }
}

/**
 * Parses HTML string containing meta tags and extracts associated metadata.
 *
 * @param {string} string - HTML content containing meta tags
 * @returns {Object.<string, (string | CoraliteToken[])>}
 *
 * @example
 * ```
 * // Example usage:
 * const html = `<meta name="title" content="Finding Nemo">`;
 * const meta = parseHTMLMeta(html);
 *
 * // Output will be an object like:
 * //{
 * //  "title": [ { name: 'title', content: 'Finding Nemo' } ],
 * //}
 * ```
 */
export function parseHTMLMeta (string) {
  // stack to keep track of current element hierarchy
  const stack = []
  /** @type {Object.<string, (string | CoraliteToken[])>} */
  const meta = {}
  let hasHead = false

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
        hasHead = true
        // end on closing head tag
        return parser.end()
      }
      // remove current element from stack as we're done with its children
      stack.pop()
    }
  })

  parser.write(string)
  parser.end()

  if (!hasHead) {
    throw new Error('Document requires a head element')
  }

  return meta
}

/**
 * Parses HTML string containing meta tags or generates Coralite module structure from markup.
 *
 * @param {string} string - HTML content containing meta tags or module markup
 * @param {Object} options
 * @param {IgnoreByAttribute} options.ignoreByAttribute - An array of attribute names and values to ignore during parsing
 * @returns {CoraliteModule} - Parsed module information, including template, script, tokens, and slot configurations
 *
 * @example
 * ```
 * // Example usage:
 * const html = `<template id="home">
 *   <slot name="default">Hello</slot>
 * </template>`;
 * const module = parseModule(html, { ignoreByAttribute: [] });
 *
 * // Module object structure will be:
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
    attributes: [],
    textNodes: []
  }
  let templateId = ''

  const parser = new Parser({
    onopentag (originalName, attributes) {
      const parent = stack[stack.length -1]
      const element = createElement({
        name: originalName,
        attributes,
        customElements,
        parent,
        ignoreByAttribute
      })
      const attributeNames = Object.keys(attributes)

      // push element to stack as it may have children
      stack.push(element)

      // collect tokens
      if (attributeNames.length) {
        for (let i = 0; i < attributeNames.length; i++) {
          const name = attributeNames[i]
          const tokens = getTokensFromString(attributes[name])

          // store attribute tokens
          if (tokens.length) {
            documentValues.attributes.push({
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
        for (let i = 0; i < documentValues.attributes.length; i++) {
          const token = documentValues.attributes[i]

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
      const parent = stack[stack.length - 1]
      const textNode = createTextNode(text, parent)

      if (text.trim()) {
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
    onclosetag () {
      const element = stack[stack.length - 1]

      if (element.type === 'tag' && element.remove) {
        // remove element from tree
        element.parent.children.pop()
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
    // If the metadata key does not exist, initialize it with the provided content.
    meta[name] = content
  } else {
    // If the existing value is not an array, convert it into an array containing a single object
    // with the name and content. This allows for handling multiple values under the same metadata key.
    if (!Array.isArray(entry)) {
      meta[name] = [{
        name,
        content: entry
      }]
      entry = meta[name]
    }
    // Add the new content to the array as a new object, preserving existing entries.
    // This is useful for adding multiple values (e.g., Open Graph metadata) under the same key.
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
 * @param {CoraliteElement[]} [data.customElements] - Optional array to collect custom elements if the tag is not a standard HTML tag.
 * @param {IgnoreByAttribute} [data.ignoreByAttribute] - Optional parameter used for ignoring elements based on attributes.
 * @returns {CoraliteElement} The newly created element with its parent reference and position in the parent's children list.
 */
export function createElement ({
  name,
  attributes,
  customElements,
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

  if (customElements && !validTags[sanitisedName]) {
    if (invalidCustomTags[sanitisedName]) {
      throw new Error('Element name is reserved: "'+ sanitisedName +'"')
    }

    if (customElementTagRegExp.test(sanitisedName)) {
      // store custom elements
      customElements.push(element)
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
 * @param {Array<Array<string, string>>} ignore - An array of attribute pairs to be ignored by the parser
 * @param {Object<string, string>} attributes - The HTML attribute object to be parsed by the parser
 * @returns {boolean}
 */
function findAttributesToIgnore (ignore, attributes) {
  for (let i = 0; i < ignore.length; i++) {
    const [key, value] = ignore[i]

    if (attributes[key] && attributes[key].includes(value)) {
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
