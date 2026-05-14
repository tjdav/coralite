import { definePlugin } from 'coralite'

/**
 * My Plugin
 */
export default definePlugin({
  name: 'my-plugin',
  /**
   * Called when the plugin is invoked in a component
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
  onPageSet: ({ properties }) => {
    // Add data available to all pages
    return {
      helloWorld: 'Hello from My Plugin!'
    }
  }
})
