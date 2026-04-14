import { definePlugin } from './dist/lib/index.js'

const testPlugin = definePlugin({
  name: 'test-script-plugin',
  client: {
    imports: [
      {
        specifier: './tests/fixtures/dummy-client-lib.js',
        namedExports: ['foo']
      }
    ],
    config: {
      message: 'Hello from config'
    },
    helpers: {
      updateTestElement: ({ config, imports }) => () => (elementId) => {
        const el = document.getElementById(elementId)
        if (el) {
          el.textContent = `${config.message} - ${imports.foo}`
          el.setAttribute('data-updated', 'true')
        }
      }
    }
  }
})

const pluginImportsTest = definePlugin({
  name: 'plugin-imports-test',
  client: {
    imports: [
      {
        specifier: './tests/fixtures/dummy-client-lib.js',
        namedExports: ['bar']
      },
      {
        specifier: './tests/fixtures/dummy-data.json',
        defaultExport: 'pluginDummyData',
        attributes: { type: 'json' }
      },
      {
        specifier: 'https://esm.sh/canvas-confetti@1.6.0',
        defaultExport: 'pluginConfetti'
      }
    ],
    helpers: {
      testPluginImports: ({ imports }) => () => (elementId) => {
        const el = document.getElementById(elementId)
        if (el) {
          el.textContent = `Plugin JS: ${imports.bar}, Plugin JSON: ${imports.pluginDummyData.name}`
          if (imports.pluginConfetti) {
            el.setAttribute('data-confetti-loaded', 'true')
          }
        }
      },
      triggerPluginConfetti: ({ imports }) => () => () => {
        if (imports.pluginConfetti) {
          imports.pluginConfetti({
            particleCount: 15,
            spread: 40,
            origin: { y: 0.5 }
          })
        }
      }
    }
  }
})

import { staticAssetPlugin } from './plugins/static-assets.js'
import oceanStatePlugin from './tests/fixtures/plugins/ocean-state.js'

const asyncHelperPlugin = definePlugin({
  name: 'async-helper-plugin',
  client: {
    helpers: {
      asyncHelper: async (globalContext) => {
        // simulate async phase1 setup
        await new Promise(resolve => setTimeout(resolve, 50))
        const value = 'async-phase1-result'

        return (localContext) => () => {
          return value
        }
      }
    }
  }
})

export default {
  plugins: [
    testPlugin,
    pluginImportsTest,
    oceanStatePlugin(),
    asyncHelperPlugin,
    staticAssetPlugin([{
      src: 'package.json',
      dest: 'coralite.json'
    }])
  ]
}
