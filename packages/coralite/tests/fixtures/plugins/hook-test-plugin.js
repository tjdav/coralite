import { definePlugin } from '#lib'

export const hookTestPlugin = definePlugin({
  name: 'hook-test-plugin',
  client: {
    onBeforeComponentRender ({ state, componentId }) {
      if (componentId === 'plugin-component') {
        state.hookMessage = 'Before Render Hook Worked!'
      }
    },
    onAfterComponentRender ({ componentId, element }) {
      if (componentId === 'plugin-component') {
        const el = element.querySelector('[ref$="__hook-result"]')
        if (el) {
          el.textContent = 'After Render Hook Worked!'
        }
      }
    }
  }
})
