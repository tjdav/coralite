import { definePlugin } from '../../../lib/index.js'

export const imperativePlugin = definePlugin({
  name: 'imperative-plugin',
  client: {
    context: () => (localContext) => ({
      create (container) {
        const child = document.createElement('plugin-imperative-child')
        child.setAttribute('label', `Created for ${localContext.instanceId}`)
        container.appendChild(child)

        const htmlContainer = document.createElement('div')
        htmlContainer.className = 'plugin-html-container'
        htmlContainer.innerHTML = '<plugin-imperative-child label="Created from plugin HTML"></plugin-imperative-child>'
        container.appendChild(htmlContainer)
      }
    })
  }
})
