import { fileURLToPath } from 'node:url'
import { definePlugin } from '../lib/server/plugin/define.js'

export const listsPlugin = definePlugin({
  name: 'lists',
  filePath: fileURLToPath(import.meta.url),

  client: {
    // Phase 1: Runs once at boot. Creates the singleton.
    context: async () => {
      // Top-level imports are stripped from the client bundle,
      // so we must dynamically import them here.
      const { createStore } = await import('./lists/store.js')
      const { bind } = await import('./lists/bind.js')

      const listsApi = {
        createStore,
        bind
      }

      // Phase 2: Runs lazily per component.
      // Return the API directly — the framework namespaces it as `lists`.
      return () => listsApi
    }
  }
})

export const lists = listsPlugin
export default listsPlugin
