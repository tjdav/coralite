import { bench } from 'mitata'
import { createReadOnlyProxy } from '../../../lib/utils/core.js'

/**
 *
 */
export function setupLazyProxyBench () {
  const sourceObject = {
    user: {
      profile: {
        name: 'Alice',
        settings: {
          theme: 'dark',
          notifications: true
        }
      }
    },
    count: 42
  }

  const readOnlyProxy = createReadOnlyProxy(sourceObject)

  function createEagerProxy (obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj
    }
    const res = Array.isArray(obj) ? [] : {}
    for (const key of Object.keys(obj)) {
      res[key] = createEagerProxy(obj[key])
    }
    return new Proxy(res, {
      get (target, prop) {
        return target[prop]
      }
    })
  }

  const eagerProxy = createEagerProxy(sourceObject)

  bench('Coralite Read-Only Proxy (Deep Read)', () => {
    const val1 = readOnlyProxy.user.profile.name
    const val2 = readOnlyProxy.user.profile.settings.theme
  })

  bench('Standard Flat Object Read (Deep Read)', () => {
    const val1 = sourceObject.user.profile.name
    const val2 = sourceObject.user.profile.settings.theme
  })

  bench('Eager Recursive Proxy (Deep Read)', () => {
    const val1 = eagerProxy.user.profile.name
    const val2 = eagerProxy.user.profile.settings.theme
  })
}
