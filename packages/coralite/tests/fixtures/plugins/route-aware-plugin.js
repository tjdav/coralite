import { definePlugin } from '../../../lib/server/plugin/define.js'

export const routeAwarePlugin = definePlugin({
  name: 'routeAware',
  client: {
    init: ({ route }) => {
      if (typeof window !== 'undefined') {
        window.__route_aware_plugin_init_route = route
      }
    },
    context: (pluginContext) => (instanceContext) => ({
      getPluginRoute: () => pluginContext.route,
      getInstanceRoute: () => instanceContext.route
    })
  }
})
