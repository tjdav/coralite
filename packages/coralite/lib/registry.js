/**
 * @typedef {Object} RegistryInstance
 * @property {(name: string, service: any) => void} register - Registers a service with a given name.
 * @property {(name: string) => Promise<any>} resolve - Resolves a service by name, returning a Promise that settles when the service is registered.
 */

/**
 * Creates a Service Registry for Coralite plugins to handle asynchronous dependency resolution.
 * @returns {RegistryInstance}
 */
export function createRegistry () {
  /** @type {Map<string, any>} */
  const services = new Map()
  /** @type {Map<string, Array<(value: any) => void>>} */
  const resolvers = new Map()

  return {
    /**
     * Registers a service with a given name.
     * @param {string} name - The unique name of the service.
     * @param {any} service - The service instance to register.
     */
    register (name, service) {
      if (services.has(name)) {
        return
      }
      services.set(name, service)

      const pendingResolvers = resolvers.get(name)
      if (pendingResolvers) {
        for (const resolve of pendingResolvers) {
          resolve(service)
        }
        resolvers.delete(name)
      }
    },

    /**
     * Resolves a service by name, returning a Promise that settles when the service is registered.
     * @param {string} name - The name of the service to resolve.
     * @returns {Promise<any>}
     */
    async resolve (name) {
      if (services.has(name)) {
        return services.get(name)
      }

      return new Promise((resolveCallback) => {
        let pendingResolvers = resolvers.get(name)
        if (!pendingResolvers) {
          pendingResolvers = []
          resolvers.set(name, pendingResolvers)
        }
        pendingResolvers.push(resolveCallback)
      })
    }
  }
}
