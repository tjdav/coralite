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

  /** @type {CoraliteDocumentTokens} */
  const documentTokens = {
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
      const parent = stack[stack.length - 1]
      const textNode = createTextNode(text, parent)

      if (text.trim()) {
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
    tokens: documentTokens,
    lineOffset,
    customElements,
    slotElements
  }
}

/**
 * @param {Object} options
 * @param {string} options.id - id - Unique identifier for the component
 * @param {CoraliteModuleValues} options.values - Token values available for replacement
 * @param {Object.<string, CoraliteModule>} options.components - Mapping of component IDs to their module definitions
 * @param {CoraliteElement} [options.element] - Mapping of component IDs to their module definitions
 * @param {CoraliteDocument} options.document - Current document being processed
 * @param {boolean} [head=true] - Indicates if the current function call is for the head of the recursion
 * @returns {Promise<CoraliteComponent | void>}
 *
 * @example
 * ```
 * // Example usage:
 * const component = await createComponent({
 *   id: 'my-component',
 *   values: {
 *     'some-token': 'value-for-token'
 *   },
 *   components: {
 *     'my-component': {
 *       id: 'my-component',
 *       template: someTemplate,
 *       script: someScript,
 *       tokens: someTokens
 *     }
 *   },
 *   document: documentInstance
 * })
 * ```
 */
export async function createComponent ({
  id,
  values,
  element,
  components,
  document
}, head = true) {
  let component = components[id]

  if (!component) {
    return console.warn('Could not find component "' + id +'" used in document "' + document.path.pageName + '"')
  }

  if (head) {
    // Convert object keys to camel case format for consistent naming conventions
    values = cleanKeys(values)
  }

  // clone the component to avoid mutations during replacement process.
  component = structuredClone(component)

  const result = {
    element: component.template
  }

  // merge values from component script
  if (component.script) {
    const scriptResult = await parseScript({
      component,
      values,
      element,
      components,
      document
    })

    if (scriptResult.documents.length) {
      result.documents = scriptResult.documents
    }

    values = Object.assign(values, scriptResult.values)
  }

  // replace tokens in the template with their values from `values` object and store them into computedTokens array for later use if needed (e.g., to be injected back).
  for (let i = 0; i < component.tokens.attributes.length; i++) {
    const item = component.tokens.attributes[i]

    for (let i = 0; i < item.tokens.length; i++) {
      const token = item.tokens[i]
      let value = values[token.name]

      if (value == null) {
        console.error('Token "' + token.name +'" was empty used on "' + component.id + '"')
        value = ''
      }

      replaceToken({
        type: 'attribute',
        node: item.element,
        attribute: item.name,
        content: token.content,
        value
      })
    }
  }

  for (let i = 0; i < component.tokens.textNodes.length; i++) {
    const item = component.tokens.textNodes[i]

    for (let i = 0; i < item.tokens.length; i++) {
      const token = item.tokens[i]
      let value = values[token.name]

      if (value == null) {
        console.error('Token "' + token.name +'" was empty used on "' + component.id + '"')
        value = ''
      }

      replaceToken({
        type: 'textNode',
        node: item.textNode,
        content: token.content,
        value
      })
    }
  }

  // replace nested customElements
  const customElements = component.customElements
  let childIndex

  for (let i = 0; i < customElements.length; i++) {
    const customElement = customElements[i]

    // update slot elements
    if (customElement.children
      && customElement.children.length
      && !customElement.slots.length
    ) {
      for (let i = 0; i < customElement.children.length; i++) {
        const node = customElement.children[i]
        const slotElement = {
          name: 'default',
          node
        }

        // @ts-ignore
        if (isCoraliteElement(node) && node.attribs.slot) {
          // add named slot
          // @ts-ignore
          slotElement.name = node.attribs.slot
        }

        customElement.slots.push(slotElement)
      }
    }

    // append custom attributes to values
    if (customElement.attribs) {
      const attribValues = cleanKeys(customElement.attribs)

      values = Object.assign(values, attribValues)
    }

    const component = await createComponent({
      id: customElement.name,
      values,
      element: customElement,
      components,
      document
    }, false)
    const children = customElement.parent.children

    if (!childIndex) {
      childIndex = customElement.parentChildIndex
    } else {
      childIndex = children.indexOf(customElement, customElement.parentChildIndex)
    }

    // replace custom element with component
    if (component && typeof component.element === 'object') {
      children.splice(childIndex, 1, ...component.element.children)
    }
  }

  const slots = component.slotElements[id]

  // replace slot content
  if (slots) {
    const slotChildren = {}
    const slotNames = Object.keys(slots)

    // sort slot content by name
    for (let i = 0; i < slotNames.length; i++) {
      const slotName = slotNames[i]
      slotChildren[slotName] = []
    }

    // insert slot content by name
    if (element) {
      for (let i = 0; i < element.slots.length; i++) {
        const elementSlotContent = element.slots[i]
        const slotName = elementSlotContent.name
        const slot = slots[slotName]

        if (slot) {
          if (elementSlotContent.node.attribs) {
            // remove slot attribute
            delete elementSlotContent.node.attribs.slot
          }

          slotChildren[slotName].push(elementSlotContent.node)
        }
      }
    }

    for (let i = 0; i < slotNames.length; i++) {
      const slotName = slotNames[i]
      let slotNodes = slotChildren[slotName]
      const slot = slots[slotName]
      const slotIndex = slot.element.parent.children.indexOf(slot.element)

      if (!slotNodes.length) {
        // set default content
        slotNodes = slot.element.children || []
      } else {
        const startIndex = slotNodes.length - 1

        for (let i = startIndex; i > -1; i--) {
          const node = slotNodes[i]
          const component = components[node.name]

          if (component) {
            const component = await createComponent({
              id: node.name,
              values,
              element: node,
              components,
              document
            }, false)

            if (component && component.element) {
              slotNodes.splice(i, 1, ...component.element.children)
            }
          }
        }
      }

      // replace slot element with content
      slot.element.parent.children.splice(slotIndex, 1, ...slotNodes)
    }
  }

  return result
}

/**
 * Parses a Coralite module script and compiles it into JavaScript.
 *
 * @param {Object} data
 * @param {CoraliteModule} data.component - The Coralite module to parse
 * @param {CoraliteModuleValues} data.values - Replacement tokens for the component
 * @param {CoraliteElement} data.element - Element
 * @param {Object.<string, CoraliteModule>} data.components - Mapping of other components that might be referenced
 * @param {CoraliteDocument} data.document - The current document being processed
 * @returns {Promise<Object.<string,string|(CoraliteDirective|CoraliteAnyNode)[]>>}
 */
export async function parseScript ({
  component,
  values,
  element,
  components,
  document
}) {
  let documents = []
  const contextifiedObject = createContext({
    console: globalThis.console,
    crypto: globalThis.crypto,
    coralite: {
      document,
      tokens: values,
      /**
       * @param {Object} options
       * @param {Object.<string, (string | function)>} options.tokens
       * @param {Object.<string, Function>} options.slots
       * @returns {Promise<CoraliteModuleValues>}
       */
      async defineComponent (options) {
        /** @type {CoraliteModuleValues} */
        const tokens = { ...values }
        const computedTokens = []
        const computedTokenKey = []

        if (options.tokens) {
          for (const key in options.tokens) {
            if (Object.prototype.hasOwnProperty.call(options.tokens, key)) {
              const token = options.tokens[key]

              if (typeof token === 'function') {
                const result = token(values) || ''

                if (typeof result.then === 'function') {
                  computedTokens.push(result)
                  computedTokenKey.push(key)
                } else {
                  tokens[key] = result
                }
              }

              if (typeof tokens[key] === 'string') {
                const result = parseHTML(tokens[key], document.ignoreByAttribute)
                const children = result.root.children

                if (children.length) {
                  if (children.length === 1 && children[0].type === 'text') {
                    tokens[key] = children[0].data
                  } else {
                    tokens[key] = children
                  }
                }
              }

            }
          }
        }

        if (computedTokens.length) {
          try {
            const results = await Promise.all(computedTokens)

            for (let i = 0; i < results.length; i++) {
              const result = results[i]
              const key = computedTokenKey[i]

              if (typeof result === 'string') {
                const html = parseHTML(results[i], document.ignoreByAttribute)

                if (html.root.children.length) {
                  tokens[key] = html.root.children
                }
              } else {
                tokens[key] = result
              }
            }
          } catch (error) {
            console.log(error)
          }
        }

        // process computed slots
        if (options.slots) {
          for (const name in options.slots) {
            if (Object.prototype.hasOwnProperty.call(options.slots, name)) {
              const computedSlot = options.slots[name]
              // slot content to compute
              const slotContent = []
              // new slot elements
              const elementSlots = []

              for (let i = 0; i < element.slots.length; i++) {
                const slot = element.slots[i]

                // exclude empty strings
                if (slot.node.type === 'text' && !slot.node.data.trim()) {
                  continue
                }

                if (slot.name === name) {
                  // slot content to compute
                  slotContent.push(slot.node)
                } else {
                  elementSlots.push(slot)
                }
              }

              // compute slot nodes
              const result = computedSlot(slotContent, tokens) || slotContent

              // append new slot nodes
              if (typeof result === 'string') {
                elementSlots.push({
                  name,
                  node: {
                    type: 'text',
                    data: result
                  }
                })
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
                      node: result[index]
                    })
                  } else {
                    throw new Error('Unexpected slot value, expected a node but found: '
                      + '\n result: ' + JSON.stringify(node)
                      + '\n component: "' + component.id + '"'
                      + '\n path: "' + document.path.pageName +'"')
                  }
                }
              }

              // update element slots
              element.slots = elementSlots
            }
          }
        }

        return tokens
      },
      /**
       * @overload
       * @param {Object} options
       * @param {string} options.template - Templates used to display the result
       * @param {string} options.path
       */

      /**
       * @param {CoraliteAggregate} options
       */
      async aggregate (options) {
        const result = await aggregate(options, values, component, components, document)

        if (result.documents) {
          documents = documents.concat(result.documents)
        }

        return result.nodes
      }
    }
  })

  const parentPath = resolve(component.path.page)
  const __dirname = parentPath.substring(0, parentPath.length - component.path.pageName.length - 1)
  const script = new SourceTextModule(component.script, {
    initializeImportMeta (meta) {
      meta.url = __dirname
    },
    lineOffset: component.lineOffset,
    identifier: component.path.pathname,
    context: contextifiedObject
  })

  await script.link(moduleLinker(parentPath))
  await script.evaluate()

  // @ts-ignore
  if (script.namespace.default) {
    try {
      const values = await script.namespace.default

      return {
        values,
        documents
      }
    } catch (err) {
      throw err
    }
  }

  throw new Error('Script found module export: "' + component.id + '"')
}

function moduleLinker (path) {
  /**
   * @param {string} specifier - The specifier of the requested module
   * @param {Module} referencingModule - The Module object link() is called on.
   */
  return async (specifier, referencingModule) => {
    if (specifier === 'coralite') {
      return new SourceTextModule(`
        export const document = coralite.document
        export const tokens = coralite.tokens
        export const defineComponent = coralite.defineComponent
        export const aggregate = coralite.aggregate
        export default { tokens, defineComponent, aggregate, document };
      `, { context: referencingModule.context })
    }

    if (specifier.startsWith('.')) {
      // handle relative path
      specifier = join(path, specifier)
    } else {
      // handle modules
      specifier = import.meta.resolve(specifier, new URL('file://' + path))
    }

    const module = await import(specifier)
    let exportModule = ''

    for (const key in module) {
      if (Object.prototype.hasOwnProperty.call(module, key)) {
        const name = 'globalThis["'+ specifier + '"].'

        if (key === 'default') {
          exportModule += 'export default ' + name + key + ';\n'
        } else {
          exportModule += 'export const '+ key + ' = ' + name + key + ';\n'
        }
      }

      referencingModule.context[specifier] = module
    }

    return new SourceTextModule(exportModule, {
      context: referencingModule.context
    })
  }
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
 * Replaces a token in a Coralite node based on its type, attribute, and content.
 *
 * @param {Object} token - The token to replace.
 * @param {string} token.type - The type of the token ('attribute' or 'text').
 * @param {CoraliteElement|CoraliteTextNode} token.node - The node containing the token.
 * @param {string} token.attribute - The attribute name to replace within the node.
 * @param {string} token.content - The content of the token.
 * @param {string|CoraliteDirective|CoraliteAnyNode} token.value - The value associated with the token.
 */
function replaceToken ({
  type,
  node,
  attribute,
  content,
  value
}) {
  if (
    type === 'attribute'
    && node.type === 'tag'
    && typeof value === 'string'
  ) {
    node.attribs[attribute] = node.attribs[attribute].replace(content, value)
  } else if (node.type === 'text') {
    if (Array.isArray(value)) {
      // inject nodes
      const textSplit = node.data.split(content)
      const childIndex = node.parent.children.indexOf(node)
      const children = []

      // append computed tokens in between token split
      for (let i = 0; i < value.length; i++) {
        const child = value[i]

        if (typeof child !== 'string') {
          // update child parent
          child.parent = node.parent
          children.push(child)
        }
      }

      // replace computed token
      node.parent.children.splice(childIndex, 1,
        {
          type: 'text',
          data: textSplit[0],
          parent: node.parent
        },
        ...children,
        {
          type: 'text',
          data: textSplit[1],
          parent: node.parent
        })
    } else {
      // replace token string
      node.data = node.data.replace(content, value)
    }
  }
}
