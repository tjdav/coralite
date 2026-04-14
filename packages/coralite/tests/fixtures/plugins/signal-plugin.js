import { definePlugin } from '../../../lib/index.js'

export default definePlugin({
  name: 'testSignalPlugin',
  client: {
    helpers: {
      trackSignalAbort: () => {
        return (localContext) => () => {
          if (localContext.signal) {
            localContext.signal.addEventListener('abort', () => {
              // @ts-ignore
              window.pluginAbortCount++
            })
          }
        }
      }
    }
  }
})
