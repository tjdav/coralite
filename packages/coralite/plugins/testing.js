import { definePlugin } from '../lib/plugin.js'

/**
 * @import { CoralitePluginComponentContext, CoralitePluginBeforeComponentRenderContext, CoralitePluginAfterComponentRenderContext, CoralitePluginPageSetContext, CoraliteModule, CoraliteAnyNode } from '../types/index.js'
 */

/**
 * Traverses an AST recursively to manage test attributes.
 * Preserves authored 'data-testid' verbatim, strips deprecated 'test' attributes,
 * and conditionally strips 'data-testid' in production mode unless preserved.
 *
 * @param {Array} children - The AST nodes to traverse.
 * @param {Object} [options] - Options.
 * @param {string} [options.mode] - Build mode.
 * @param {boolean} [options.preserveTestId] - Whether to preserve data-testid in production.
 */
function traverseAndAddTestId (children, { mode = 'production', preserveTestId = false } = {}) {
  if (!Array.isArray(children)) {
    return
  }

  const shouldStrip = mode === 'production' && !preserveTestId && process.env.CORALITE_PRESERVE_TESTID !== 'true'

  for (let i = 0; i < children.length; i++) {
    const node = children[i]

    if (node.type === 'tag' && node.attribs) {
      // Remove deprecated 'test' attribute
      if (node.attribs.test !== undefined) {
        delete node.attribs.test
      }

      // Handle data-testid
      if (node.attribs['data-testid'] !== undefined && shouldStrip) {
        delete node.attribs['data-testid']
      }
    }

    if (node.children?.length > 0) {
      traverseAndAddTestId(node.children, { mode, preserveTestId })
    }
  }
}

/**
 * Strips test and data-testid attributes from a component AST and its attribute token values in production mode.
 * @param {CoraliteModule} [component] - The component module.
 * @param {Object} [options] - Options.
 * @param {string} [options.mode] - Build mode.
 * @param {boolean} [options.preserveTestId] - Whether to preserve data-testid in production.
 */
function stripTestAttributesFromComponent (component, { mode = 'production', preserveTestId = false } = {}) {
  if (!component) {
    return
  }

  const shouldStrip = mode === 'production' && !preserveTestId && process.env.CORALITE_PRESERVE_TESTID !== 'true'

  if (component.template && component.template.children) {
    traverseAndAddTestId(component.template.children, { mode, preserveTestId })
  }

  if (component.values && component.values.attributes) {
    if (shouldStrip) {
      component.values.attributes = component.values.attributes.filter(attr => attr.name !== 'data-testid' && attr.name !== 'test')
    } else {
      component.values.attributes = component.values.attributes.filter(attr => attr.name !== 'test')
    }
  }
}

/**
 * Creates a configured testing plugin instance.
 * @param {Object} [pluginOptions]
 * @param {boolean} [pluginOptions.preserveTestId] - Whether to preserve data-testid in production.
 */
export function createTestingPlugin (pluginOptions = {}) {
  const plugin = definePlugin({
    name: 'testing',
    server: {
      /**
       * @param {CoralitePluginComponentContext} context
       */
      onComponentSet ({ component, module, app }) {
        const mode = app?.options?.mode || 'production'
        const preserveTestId = pluginOptions.preserveTestId || app?.options?.preserveTestId
        stripTestAttributesFromComponent(component || module, { mode, preserveTestId })
      },
      /**
       * @param {CoralitePluginComponentContext} context
       */
      onComponentUpdate ({ component, module, app }) {
        const mode = app?.options?.mode || 'production'
        const preserveTestId = pluginOptions.preserveTestId || app?.options?.preserveTestId
        stripTestAttributesFromComponent(component || module, { mode, preserveTestId })
      },
      onBeforeBuild ({ app }) {
        if (app?.options?.mode !== 'testing') {
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
      onBeforeComponentRender ({ template, app }) {
        const mode = app?.options?.mode || 'development'
        const preserveTestId = pluginOptions.preserveTestId || app?.options?.preserveTestId

        if (template && 'children' in template && template.children) {
          traverseAndAddTestId(template.children, { mode, preserveTestId })
        }
      },
      /**
       * @param {CoralitePluginAfterComponentRenderContext} context
       */
      onAfterComponentRender ({ result, app }) {
        const mode = app?.options?.mode || 'production'
        const preserveTestId = pluginOptions.preserveTestId || app?.options?.preserveTestId

        let nodes = []
        if (Array.isArray(result)) {
          nodes = result
        } else if (result && 'children' in result && result.children) {
          nodes = result.children
        }

        traverseAndAddTestId(nodes, { mode, preserveTestId })
      },
      /**
       * @param {CoralitePluginPageSetContext} context
       */
      onPageSet ({ elements, app }) {
        const mode = app?.options?.mode || 'development'
        const preserveTestId = pluginOptions.preserveTestId || app?.options?.preserveTestId

        if (elements?.root?.children) {
          traverseAndAddTestId(elements.root.children, { mode, preserveTestId })
        }
      }
    }
  })

  return plugin
}

const defaultTestingPluginInstance = createTestingPlugin()

function testingPluginFactory (options) {
  if (options && typeof options === 'object') {
    return createTestingPlugin(options)
  }
  return defaultTestingPluginInstance
}

Object.defineProperties(testingPluginFactory, {
  name: { value: 'testing', configurable: true, enumerable: true, writable: true },
  server: { value: defaultTestingPluginInstance.server, configurable: true, enumerable: true, writable: true },
  client: { value: defaultTestingPluginInstance.client, configurable: true, enumerable: true, writable: true },
  rootDir: { value: defaultTestingPluginInstance.rootDir, configurable: true, enumerable: true, writable: true },
  filePath: { value: defaultTestingPluginInstance.filePath, configurable: true, enumerable: true, writable: true }
})

export const testingPlugin = testingPluginFactory
