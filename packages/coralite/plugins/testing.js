import { definePlugin } from '#lib'

/**
 * Traverses an AST recursively and duplicates 'ref' attributes to 'data-testid'.
 * Note: Modifying AST nodes in-place is required to preserve reference identity
 * for internal framework arrays (e.g. customElements, skipRenderElements).
 * @param {Array} children - The AST nodes to traverse.
 */
function traverseAndAddTestId (children) {
  if (!children || !Array.isArray(children)) {
    return
  }
  for (let i = 0; i < children.length; i++) {
    const node = children[i]
    if (node.type === 'tag' && node.attribs && node.attribs.ref) {
      node.attribs['data-testid'] = node.attribs.ref
    }
    if (node.children && node.children.length > 0) {
      traverseAndAddTestId(node.children)
    }
  }
}

export const testingPlugin = definePlugin({
  name: 'testing',
  onComponentSet: (component) => {
    if (component && component.template && component.template.children) {
      traverseAndAddTestId(component.template.children)
    }
  },
  onPageSet: ({ elements }) => {
    if (elements && elements.root && elements.root.children) {
      traverseAndAddTestId(elements.root.children)
    }
  }
})
