import { createPlugin } from '../../../dist/lib/index.js'

export default createPlugin({
  name: 'testSignalPlugin',
  client: {
    helpers: {
      trackSignalAbort: () => {
        return (localContext) => () => {
          if (localContext.signal) {
            localContext.signal.addEventListener('abort', () => {
              window.pluginAbortCount++
            })
          }
        }
      }
    }
  }
})
