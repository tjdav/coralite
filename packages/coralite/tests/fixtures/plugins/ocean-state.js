/**
 * Test plugin that manages shared state across components.
 * @returns {Object} The coralite plugin definition
 */
export default function oceanStatePlugin () {
  return {
    name: 'ocean-state-plugin',
    client: {
      helpers: {
        // Phase 1: Global Context (ScriptPluginHelperGlobalInstance)
        // This runs once per bundle. The state lives securely in this closure.
        sharedOceanStore: (globalContext) => {

          // Secure, module-scoped state
          const store = {
            temperature: 30,
            subscribers: []
          }

          // Phase 2: Local Context (ScriptPluginHelperLocalInstance)
          // This is what actually gets returned to `context.helpers.sharedOceanStore`
          // inside the component's client script.
          return (localContext) => {
            return {
              getTemp: () => store.temperature,
              setTemp: (newTemp) => {
                store.temperature = newTemp
                store.subscribers.forEach(callback => callback(newTemp))
              },
              subscribe: (callback) => {
                store.subscribers.push(callback)
              }
            }
          }

        }
      }
    }
  }
}
