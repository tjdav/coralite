import { createPlugin } from 'coralite'

/**
 * My Plugin
 */
export default createPlugin({
  name: 'my-plugin',
  /**
   * Called when the plugin is invoked in a template
   * e.g. {{ myPlugin(options) }}
   */
  method: (options, context) => {
    return {
      message: options.message || 'Hello from method!'
    }
  },
  /**
   * Called when a page is being processed
   */
  onPageSet: ({ values }) => {
    // Add data available to all pages
    // Note: Coralite uses flat keys for tokens, so {{ site.hello }} maps to values['site.hello']
    values.helloWorld = 'Hello from My Plugin!'
  }
})
