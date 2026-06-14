import { definePlugin } from '../lib/plugin.js'

/**
 * Traverses an AST recursively and duplicates 'ref' attributes to 'data-testid'.
 * Note: Modifying AST nodes in-place is required to preserve reference identity
 * for internal framework arrays (e.g. customElements, skipRenderElements).
 * @param {Array} children - The AST nodes to traverse.
 */
function traverseAndAddTestId (children) {
  if (!Array.isArray(children)) {
    return
  }

  for (let i = 0; i < children.length; i++) {
    const node = children[i]

    if (node.type === 'tag' && node.attribs?.ref) {
      if (!node.attribs['data-testid']) {
        node.attribs['data-testid'] = node.attribs.ref
      }
    }

    if (node.children?.length > 0) {
      traverseAndAddTestId(node.children)
    }
  }
}

export const testingPlugin = definePlugin({
  name: 'testing',
  server: {
    onBeforeComponentRender: ({ instanceId, refs }) => {
      for (let i = 0; i < refs.length; i++) {
        const ref = refs[i]
        const uniqueRefValue = `${instanceId}__${ref.name}`

        if (ref.element.attribs) {
          const currentTestId = ref.element.attribs['data-testid']

          if (!currentTestId || currentTestId === ref.name) {
            ref.element.attribs['data-testid'] = uniqueRefValue
          }
        }
      }
    },
    onComponentSet: ({ component }) => {
      const children = component?.template?.children
      if (children) {
        traverseAndAddTestId(children)
      }
    },
    onPageSet: ({ elements }) => {
      const children = elements?.root?.children
      if (children) {
        traverseAndAddTestId(children)
      }
    }
  },
  client: {
    onBeforeComponentRender: ({ instanceId, refs }) => {
      for (let i = 0; i < refs.length; i++) {
        const ref = refs[i]
        const uniqueRefValue = `${instanceId}__${ref.name}`

        if (ref.element && ref.element.setAttribute) {
          const currentTestId = ref.element.getAttribute('data-testid')

          if (!currentTestId || currentTestId === ref.name) {
            ref.element.setAttribute('data-testid', uniqueRefValue)
          }
        }
      }
    }
  }
})
