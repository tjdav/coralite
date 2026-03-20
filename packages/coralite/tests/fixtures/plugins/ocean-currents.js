export default function oceanCurrentsPlugin () {
  return {
    name: 'ocean-currents',
    client: {
      helpers: {
        // Phase 1: Global Setup (Runs ONCE)
        getWaterTemperature: (globalContext) => {
          const globalTemp = (Math.random() * (10 + 20)).toFixed(2) // e.g., "24.50"

          // Phase 2: Local DOM Binding (Runs per component)
          return (localContext) => {
            return () => globalTemp
          }
        }
      }
    }
  }
}
