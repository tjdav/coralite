import { definePlugin } from 'coralite'

/**
 * My Plugin
 */
export default definePlugin({
  name: 'my-plugin',

  // SERVER: Strictly Node.js / Build-Time Execution
  server: {
    /**
     * The exports property defines methods available to components during the server-side build process.
     * These virtual modules MUST only be invoked within the data() block.
     * Uses Two-Phase Currying: (pluginContext) => (instanceContext) => { ... }
     */
    exports: {
      myPluginMethod: (pluginContext) => (instanceContext) => {
        return {
          message: instanceContext.message || 'Hello from server export!'
        }
      }
    },

    /**
     * Called when a page is being processed.
     * Returns data available to all components on the page.
     */
    onPageSet: ({ state, page, session }) => {
      return {
        pluginGlobalData: 'Hello from Plugin onPageSet!'
      }
    }
  },

  // CLIENT: Strictly Browser / Run-Time Execution
  client: {
    /**
     * Injects utilities into the component's script context.
     * Uses Two-Phase Currying: (pluginContext) => (instanceContext) => { ... }
     */
    context: {
      myClientUtility: (pluginContext) => (instanceContext) => {
        const { state, instanceId } = instanceContext
        return (msg) => {
          console.log(`[${instanceId}] Plugin says: ${msg}`)
        }
      }
    },

    /**
     * Called before the component is rendered on the client.
     */
    onBeforeComponentRender: ({ state, instanceId, element, options }) => {
      // console.log('Before component render:', instanceId)
    },

    /**
     * Called after the component is rendered and the DOM is stable.
     */
    onAfterComponentRender: ({ state, instanceId, element, options }) => {
      // console.log('After component render:', instanceId)
    },

    /**
     * Called when the component is disconnected from the DOM.
     * Use this to clean up global event listeners, observers, etc.
     */
    onDisconnected: ({ state, instanceId, element, options }) => {
      // console.log('Component disconnected:', instanceId)
    }
  }
})
