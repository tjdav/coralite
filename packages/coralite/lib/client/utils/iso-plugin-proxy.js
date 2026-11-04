/**
 * Returns the registered top-level isomorphic plugin instances, if any.
 *
 * @returns {Object|null} Map of isomorphic plugin name to plugin initializer
 */
function getIsoPlugins () {
  return (typeof window !== 'undefined' && window['__coralite__']?.isomorphicPlugins) || null
}

/**
 * Wraps a context object with a lazy proxy resolving top-level isomorphic plugin context.
 * Plugins are resolved on first access and cached per proxy instance.
 *
 * @param {Object} rawContext - Raw context object to wrap
 * @returns {Object} Proxy exposing own context keys plus isomorphic plugin keys
 */
export function createIsoPluginProxy (rawContext) {
  const isoCache = new Map()
  return new Proxy(rawContext, {
    get (target, prop, receiver) {
      if (Reflect.has(target, prop)) {
        return Reflect.get(target, prop, receiver)
      }
      const isoPlugins = getIsoPlugins()
      if (isoPlugins && typeof prop === 'string' && prop in isoPlugins) {
        if (isoCache.has(prop)) {
          return isoCache.get(prop)
        }
        const fn = isoPlugins[prop]
        const resolved = typeof fn === 'function' ? fn(receiver) : fn
        isoCache.set(prop, resolved)
        return resolved
      }
      return Reflect.get(target, prop, receiver)
    },
    has (target, prop) {
      const isoPlugins = getIsoPlugins()
      return Reflect.has(target, prop) || Boolean(isoPlugins && typeof prop === 'string' && prop in isoPlugins)
    },
    ownKeys (target) {
      const keys = new Set(Reflect.ownKeys(target))
      const isoPlugins = getIsoPlugins()
      if (isoPlugins) {
        for (const k of Object.keys(isoPlugins)) {
          keys.add(k)
        }
      }
      return Array.from(keys)
    }
  })
}
