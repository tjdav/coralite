import { createPlugin } from './dist/lib/index.js'

const testPlugin = createPlugin({
  name: 'test-script-plugin',
  script: {
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
      updateTestElement: ({ config, imports }) => (elementId) => {
        const el = document.getElementById(elementId)
        if (el) {
          el.textContent = `${config.message} - ${imports.foo}`
          el.setAttribute('data-updated', 'true')
        }
      }
    }
  }
})

const pluginImportsTest = createPlugin({
  name: 'plugin-imports-test',
  script: {
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
      testPluginImports: ({ imports }) => (elementId) => {
        const el = document.getElementById(elementId)
        if (el) {
          el.textContent = `Plugin JS: ${imports.bar}, Plugin JSON: ${imports.pluginDummyData.name}`
          if (imports.pluginConfetti) {
            el.setAttribute('data-confetti-loaded', 'true')
          }
        }
      },
      triggerPluginConfetti: ({ imports }) => () => {
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

export default {
  plugins: [testPlugin, pluginImportsTest]
}
