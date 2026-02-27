
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

export default {
  plugins: [testPlugin]
}
