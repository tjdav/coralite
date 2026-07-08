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

  const isProduction = mode === 'production'
  const isDevOrTest = mode === 'development' || mode === 'testing'

  let prefix = ''
  if (instanceId === 'page') {
    prefix = 'page__'
  } else if (instanceId) {
    prefix = `${instanceId}__`
  }

  for (let i = 0; i < children.length; i++) {
    const node = children[i]

    if (node.type === 'tag') {
      if (node.attribs) {
        // Remove deprecated 'test' attribute
        if (node.attribs.test !== undefined) {
          delete node.attribs.test
        }

        if (node.attribs['data-testid'] !== undefined) {
          if (isProduction) {
            delete node.attribs['data-testid']
          } else if (isDevOrTest) {
            const val = node.attribs['data-testid']
            // Prefix authored IDs
            if (prefix && !val.startsWith(prefix)) {
              node.attribs['data-testid'] = `${prefix}${val}`
            }
          }
        }
      }

      if (autoTestId && isDevOrTest) {
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
            node.attribs['data-testid'] = `${prefix}${tagName}-${index}`
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
      // Velocity Engine remains strictly for 'testing' mode to ensure stability
      if (app.options.mode !== 'testing') {
        return
      }
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
      const mode = app.options.mode
      const isDevOrTest = mode === 'development' || mode === 'testing'
      const counters = {}


      /** @type {any} */
      const templateNode = template
      if (templateNode && templateNode.children) {
        traverseAndAddTestId(templateNode.children, instanceId, {
          autoTestId: isDevOrTest,
          counters,
          mode
        })
      }
    },
    onAfterComponentRender: ({ result, app }) => {
      const mode = app.options.mode
      if (mode !== 'production') {
        return
      }

      // Final safety pass for production to ensure all data-testid are stripped
      const traverse = (children) => {
        if (!Array.isArray(children)) {
          return
        }
        for (const node of children) {
          if (node.type === 'tag' && node.attribs) {
            delete node.attribs['data-testid']
            delete node.attribs.test
          }
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
      const isDevOrTest = mode === 'development' || mode === 'testing'
      const counters = {}
      traverseAndAddTestId(elements?.root?.children, 'page', {
        autoTestId: isDevOrTest,
        counters,
        mode
      })
    }
  }
})
