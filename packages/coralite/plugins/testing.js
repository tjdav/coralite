import { definePlugin } from '../lib/plugin.js'

/**
 * Traverses an AST recursively and duplicates 'ref' attributes to 'data-testid'.
 * Also adds deterministic data-testid to interactive elements in testing mode.
 * Note: Modifying AST nodes in-place is required to preserve reference identity
 * for internal framework arrays (e.g. customElements, skipRenderElements).
 * @param {Array} children - The AST nodes to traverse.
 * @param {string} [instanceId] - The component instance ID.
 * @param {Object} [options] - Options.
 * @param {boolean} [options.autoTestId] - Whether to automatically add test IDs to interactive elements.
 * @param {Object} [options.counters] - Counter object for deterministic indices.
 * @param {string} [options.mode] - Build mode.
 */
function traverseAndAddTestId (children, instanceId, { autoTestId = false, counters = {}, mode = 'production' } = {}) {
  if (!Array.isArray(children)) {
    return
  }

  for (let i = 0; i < children.length; i++) {
    const node = children[i]

    if (node.type === 'tag') {
      if (node.attribs?.test !== undefined) {
        const testValue = node.attribs.test

        // Skip processing if it contains tokens (handled in onBeforeComponentRender)
        if (!testValue.includes('{{')) {
          if (mode === 'testing') {
            let prefix = ''
            if (instanceId === 'page') {
              prefix = 'page__'
            } else if (instanceId) {
              prefix = `${instanceId}__`
            }
            node.attribs['data-testid'] = `${prefix}${testValue}`
          }
          delete node.attribs.test
        }
      }

      if (node.attribs?.ref) {
        if (!node.attribs['data-testid']) {
          const refValue = node.attribs.ref
          const prefix = instanceId ? `${instanceId}__` : ''

          // In server-side:
          // onBeforeComponentRender: instanceId is present, ref is NOT yet prefixed.
          // onPageSet: instanceId is 'page', ref IS prefixed (with component-0__ref).

          if (instanceId === 'page' && refValue.includes('__')) {
            node.attribs['data-testid'] = refValue
          } else {
            node.attribs['data-testid'] = `${prefix}${refValue}`
          }
        }
      } else if (autoTestId && instanceId && mode === 'testing') {
        const tagName = node.name.toLowerCase()
        const isInteractive = [
          'button', 'a', 'input', 'form', 'select', 'textarea'
        ].includes(tagName) ||
        (node.attribs && (
          node.attribs.tabindex !== undefined ||
          (node.attribs.role && ['button', 'link', 'checkbox'].includes(node.attribs.role))
        )) ||
        (node.slots)

        if (isInteractive) {
          if (!counters[tagName]) {
            counters[tagName] = 0
          }
          const index = counters[tagName]++
          if (!node.attribs) {
            node.attribs = {}
          }
          if (!node.attribs['data-testid']) {
            node.attribs['data-testid'] = `${instanceId}__${tagName}-${index}`
          }
        }
      }
    }

    if (node.children?.length > 0) {
      traverseAndAddTestId(node.children, instanceId, {
        autoTestId,
        counters,
        mode
      })
    }
  }
}

export const testingPlugin = definePlugin({
  name: 'testing',
  server: {
    onBeforeBuild: ({ app }) => {
      if (app.options.mode !== 'testing') {
        return
      }
      // Velocity Engine: Inject global style to disable animations
      app.options.externalStyles = app.options.externalStyles || []
      const velocityStyle = `
*, *::before, *::after {
  transition: none !important;
  animation: none !important;
  scroll-behavior: auto !important;
}
`.trim()
      app.options.externalStyles.push(`data:text/css;base64,${Buffer.from(velocityStyle).toString('base64')}`)
    },
    onBeforeComponentRender: ({ instanceId, template, app, attributes }) => {
      const mode = app.options.mode
      const isTesting = mode === 'testing'
      const counters = {}

      // Handle attributes with tokens
      if (attributes) {
        const prefix = instanceId ? `${instanceId}__` : ''
        for (let i = 0; i < attributes.length; i++) {
          const attr = attributes[i]
          if (attr.name === 'test') {
            if (isTesting) {
              attr.name = 'data-testid'
              // Prefix all tokens for this attribute
              for (let j = 0; j < attr.tokens.length; j++) {
                const token = attr.tokens[j]
                const tokenValue = token.content.slice(2, -2).trim()
                token.name = `${prefix}${tokenValue}`
              }
              // Update element's test attribute so replaceToken finds the right content to replace
              if (attr.element && attr.element.attribs) {
                const testValue = attr.element.attribs.test
                const regex = /\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g
                attr.element.attribs['data-testid'] = `${prefix}${testValue.replace(regex, (match, p1) => `{{ ${prefix}${p1} }}`)}`
              }
            }
          }
        }
      }

      /** @type {any} */
      const templateNode = template
      if (templateNode && templateNode.children) {
        traverseAndAddTestId(templateNode.children, instanceId, {
          autoTestId: isTesting,
          counters,
          mode
        })
      }
    },
    onAfterComponentRender: ({ attributes, result, instanceId, app }) => {
      const mode = app.options.mode
      const isTesting = mode === 'testing'

      // Stripping phase: remove any remaining 'test' attributes
      if (attributes) {
        for (let i = 0; i < attributes.length; i++) {
          const attr = attributes[i]
          if (attr.name === 'test' || attr.name === 'data-testid') {
            if (attr.element && attr.element.attribs) {
              delete attr.element.attribs.test
            }
          }
        }
      }

      // Handle cases where 'test' attribute was injected via HTML tokens
      const traverse = (children) => {
        if (!Array.isArray(children)) {
          return
        }
        for (const node of children) {
          // @ts-ignore
          if (node.type === 'tag') {
            if (node.attribs?.test !== undefined) {
              if (isTesting) {
                const prefix = instanceId ? `${instanceId}__` : ''
                node.attribs['data-testid'] = `${prefix}${node.attribs.test}`
              }
              delete node.attribs.test
            }
          }
          // @ts-ignore
          if (node.children) {
            traverse(node.children)
          }
        }
      }

      // @ts-ignore
      if (result && result.children) {
        // @ts-ignore
        traverse(result.children)
      }
    },
    onPageSet: ({ elements, app }) => {
      const mode = app.options.mode
      const isTesting = mode === 'testing'
      const counters = {}
      traverseAndAddTestId(elements?.root?.children, 'page', {
        autoTestId: isTesting,
        counters,
        mode
      })
    }
  },
  client: {
    onBeforeComponentRender: ({ instanceId, refs }) => {
      // In client side, refs are already uniquely named in state and attribute,
      // but we ensure data-testid matches for consistency if it was missed or changed
      for (let i = 0; i < refs.length; i++) {
        const ref = refs[i]
        const prefix = `${instanceId}__`
        const uniqueRefValue = ref.element && ref.element.getAttribute('ref')

        if (ref.element && ref.element.setAttribute) {
          const currentTestId = ref.element.getAttribute('data-testid')

          if (!currentTestId || currentTestId === ref.name) {
            if (uniqueRefValue && uniqueRefValue.startsWith(prefix)) {
              ref.element.setAttribute('data-testid', uniqueRefValue)
            } else {
              ref.element.setAttribute('data-testid', `${prefix}${ref.name}`)
            }
          }
        }
      }
    }
  }
})
