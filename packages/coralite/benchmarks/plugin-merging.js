import { bench, run } from 'mitata'
import { mergePluginState } from '../lib/utils.js'
import { massiveState } from './utils/dummy-data.js'

const patch = {
  key_1: {
    key_2: {
      key_3: {
        key_4: {
          key_0: {
            arr: ['patched_item']
          }
        }
      }
    }
  }
}

console.log(`\nBenchmark: Plugin State Merging`)
console.log('--------------------------------------------------')

bench('mergePluginState (Framework)', () => {
  // Pass identical clone of massiveState for fairness if needed,
  // but mergePluginState shouldn't strictly mutate the root unnecessarily.
  mergePluginState(massiveState, patch)
})

bench('Object.assign (Baseline - Unsafe)', () => {
  Object.assign({}, massiveState, patch)
})

// A slightly better baseline using spread
bench('Deep Spread (Baseline - Unsafe for general depth)', () => {
  ({
    ...massiveState,
    key_1: {
      ...massiveState.key_1,
      key_2: {
        ...massiveState.key_1.key_2,
        key_3: {
          ...massiveState.key_1.key_2.key_3,
          key_4: {
            ...massiveState.key_1.key_2.key_3.key_4,
            key_0: {
              ...massiveState.key_1.key_2.key_3.key_4.key_0,
              arr: ['patched_item']
            }
          }
        }
      }
    }
  })
})

await run()
