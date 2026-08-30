import { definePlugin } from '../lib/plugin.js'

/**
 * @import { CoralitePluginComponentContext, CoralitePluginBeforeComponentRenderContext, CoralitePluginAfterComponentRenderContext, CoralitePluginPageSetContext, CoraliteModule, CoraliteAnyNode } from '../types/index.js'
 */

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

/**
 * Strips test and data-testid attributes from a component AST and its attribute token values in production mode.
 * @param {CoraliteModule} [component] - The component module.
 */
function stripTestAttributesFromComponent (component) {
  if (!component) {
    return
  }

  if (component.template && component.template.children) {
    traverseAndAddTestId(component.template.children, null, { mode: 'production' })
  }

  if (component.values && component.values.attributes) {
    component.values.attributes = component.values.attributes.filter(attr => attr.name !== 'data-testid' && attr.name !== 'test')
  }
}

export const testingPlugin = definePlugin({
  name: 'testing',
  server: {
    /**
     * @param {CoralitePluginComponentContext} context
     */
    onComponentSet ({ component, module, app }) {
      if (app.options.mode === 'production') {
        stripTestAttributesFromComponent(component || module)
      }
    },
    /**
     * @param {CoralitePluginComponentContext} context
     */
    onComponentUpdate ({ component, module, app }) {
      if (app.options.mode === 'production') {
        stripTestAttributesFromComponent(component || module)
      }
    },
    onBeforeBuild ({ app }) {
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
    /**
     * @param {CoralitePluginBeforeComponentRenderContext} context
     */
    onBeforeComponentRender ({ instanceId, template, app }) {
      if (app.options.mode === 'production') {
        return
      }
      const mode = app.options.mode
      const isDevOrTest = mode === 'development' || mode === 'testing'
      const counters = {}

      if (template && 'children' in template && template.children) {
        traverseAndAddTestId(template.children, instanceId, {
          autoTestId: isDevOrTest,
          counters,
          mode
        })
      }
    },
    /**
     * @param {CoralitePluginAfterComponentRenderContext} context
     */
    onAfterComponentRender ({ result, app }) {
      if (app.options.mode !== 'production') {
        return
      }

      // Final safety pass for production to ensure all data-testid are stripped
      let nodes = []
      if (Array.isArray(result)) {
        nodes = result
      } else if (result && 'children' in result && result.children) {
        nodes = result.children
      }

      traverseAndAddTestId(nodes, null, { mode: 'production' })
    },
    /**
     * @param {CoralitePluginPageSetContext} context
     */
    onPageSet ({ elements, app }) {
      const mode = app.options.mode
      const isDevOrTest = mode === 'development' || mode === 'testing'
      const counters = {}
      if (elements?.root?.children) {
        traverseAndAddTestId(elements.root.children, 'page', {
          autoTestId: isDevOrTest,
          counters,
          mode
        })
      }
    }
  }
})
