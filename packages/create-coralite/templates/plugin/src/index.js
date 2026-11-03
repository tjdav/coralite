import { definePlugin } from 'coralite'

/**
 * Coralite Plugin Starter
 *
 * Demonstrates:
 * 1. Configuration schema with typed defaults
 * 2. Ubiquitous isomorphic context (accessible in server, client, getters, and style)
 * 3. Server build-time lifecycle hook (onPageSet)
 */
export default definePlugin({
  name: 'myPlugin',

  config: {
    message: {
      type: String,
      default: 'Hello from Coralite Plugin!'
    }
  },

  /**
   * Top-level context is isomorphic and ubiquitous across
   * component and page server, getters, client, slots, and style.
   *
   * Uses two-phase currying: (pluginContext) => (instanceContext) => contextObject
   *
   * @param {object} initCtx - Plugin initialization context containing resolved config
   * @param {object} initCtx.config - Resolved plugin configuration
   * @returns {(instanceCtx: object) => object} Instance factory returning ubiquitous helpers
   */
  context: ({ config }) => () => ({
    message: config?.message || 'Hello from Coralite Plugin!'
  }),

  server: {
    /**
     * Called when a page file is loaded and processed during build time.
     *
     * @param {object} hookCtx - Server hook context
     * @param {object} hookCtx.page - Coralite page object being processed
     */
    onPageSet ({ page }) {
      if (page) {
        page.meta = page.meta || {}
        page.meta['x-plugin-powered'] = 'coralite-plugin'
      }
    }
  }
})
