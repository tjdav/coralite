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
 */
function traverseAndAddTestId (children, instanceId, { autoTestId = false, counters = {} } = {}) {
  if (!Array.isArray(children)) {
    return
  }

  for (let i = 0; i < children.length; i++) {
    const node = children[i]

    if (node.type === 'tag') {
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
      } else if (autoTestId && instanceId) {
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
        counters
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
    onBeforeComponentRender: ({ instanceId, template, app }) => {
      const isTesting = app.options.mode === 'testing'
      const counters = {}
      /** @type {any} */
      const templateNode = template
      if (templateNode && templateNode.children) {
        traverseAndAddTestId(templateNode.children, instanceId, {
          autoTestId: isTesting,
          counters
        })
      }
    },
    onPageSet: ({ elements, app }) => {
      const isTesting = app.options.mode === 'testing'
      const counters = {}
      traverseAndAddTestId(elements?.root?.children, 'page', {
        autoTestId: isTesting,
        counters
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
