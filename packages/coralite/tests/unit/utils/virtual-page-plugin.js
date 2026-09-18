/**
 * Creates an onBeforeBuild plugin that queues a virtual page for rendering
 * via `app.addRenderQueue({ pathname, content, cacheKey?, volatile? }, buildId)`.
 *
 * The `cacheKey` and `volatile` options are read lazily (at hook time), so
 * tests may mutate the options object between builds to simulate changes.
 *
 * @param {string} pathname - Pathname of the virtual page (e.g. 'virtual.html')
 * @param {{ content?: string, cacheKey?: string, volatile?: boolean }} [options]
 * @returns {{ name: string, server: { onBeforeBuild: Function } }} Coralite plugin
 */
export function virtualPagePlugin (pathname, options = {}) {
  return {
    name: 'virtual-page-plugin',
    server: {
      onBeforeBuild: async ({ app, buildId }) => {
        const item = { pathname, content: options.content }
        if (options.cacheKey !== undefined) {
          item.cacheKey = options.cacheKey
        }
        if (options.volatile !== undefined) {
          item.volatile = options.volatile
        }
        await app.addRenderQueue(item, buildId)
      }
    }
  }
}
