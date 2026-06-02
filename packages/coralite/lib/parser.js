import render from 'dom-serializer'
import { parseHTML } from './parse.js'
import { relinkChildren } from './dom.js'

/**
 * @import { CoraliteElement, CoraliteAnyNode, CoraliteComponentRoot, Attribute, CoraliteModule, CoraliteSession } from '../types/index.js'
 * @import { DomSerializerOptions } from 'dom-serializer'
 * @import { AnyNode } from 'domhandler'
 */

/**
 * Renders the provided node or array of nodes using the render function.
 *
 * @param {CoraliteComponentRoot | CoraliteAnyNode | CoraliteAnyNode[]} root - The node(s) to be rendered.
 * @param {DomSerializerOptions} [options] - Changes serialization behavior
 * @returns {string}
 */
export function transformNode (root, options) {
  // @ts-ignore
  return render(root, {
    decodeEntities: false,
    ...options
  })
}

/**
 * Replaces a custom element with its template content.
 * @param {CoraliteElement} coraliteElement - The custom element to be replaced.
 * @param {CoraliteElement} element - The target element to replace the tokens with.
 */
export function replaceCustomElementWithTemplate (coraliteElement, element) {
  coraliteElement.children = element.children
  relinkChildren(coraliteElement)
}

/**
 * Process a token value - parse HTML strings and handle custom elements
 * @param {any} value - The value to process
 * @param {Object} context - Processing context
 * @param {Attribute[]} [context.excludeByAttribute] - List of attribute name-value pairs to ignore
 * @param {Object} [context.state] - Replacement tokens for the component
 * @param {CoraliteModule} [context.module] - The component module
 * @param {Function} [context.createComponentElement] - The createComponentElement function
 * @param {CoraliteSession} [context.session] - The current build session
 * @param {boolean} [context.noHydration] - No hydration flag
 * @returns {Promise<any>} - Processed value
 */
export async function processTokenValue (value, context) {
  const { excludeByAttribute, state, module, createComponentElement, session, noHydration } = context
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
    const cid = `${module.path.pathname}${customElement.name}-${i}`
    const childNoHydration = noHydration || (customElement.attribs && 'no-hydration' in customElement.attribs)

    const componentElement = await createComponentElement({
      contextId: cid,
      id: customElement.name,
      state,
      element: customElement,
      module,
      index: i,
      session,
      noHydration: childNoHydration
    })

    if (componentElement) {
      if (childNoHydration) {
        const parent = customElement.parent
        if (parent && parent.children) {
          const elementIndex = parent.children.indexOf(customElement)
          if (elementIndex !== -1) {
            parent.children.splice(elementIndex, 1, ...componentElement.children)
            relinkChildren(parent)
          }
        }
      } else {
        customElement.children = componentElement.children
        relinkChildren(customElement)

        if (!customElement.attribs) {
          customElement.attribs = {}
        }
        customElement.attribs['data-cid'] = cid

        session.componentTags.add(customElement.name)
      }
    }
  }

  // For static strings, optimize single text nodes
  if (result.root.children.length === 1 && result.root.children[0].type === 'text') {
    return result.root.children[0].data
  }

  return result.root.children
}
