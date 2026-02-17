import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'

/**
 * Transforms CSS to automatically apply `&.` prefix to classes present on the root element.
 * @param {string} css - The CSS content
 * @param {Set<string>} rootClasses - Set of classes found on the root element
 * @param {Set<string>} descendantClasses - Set of classes found on descendant elements
 * @returns {Promise<string>} Transformed CSS
 */
export async function transformCss (css, rootClasses, descendantClasses) {
  const processor = postcss([
    {
      postcssPlugin: 'coralite-style-transform',
      Rule (rule) {
        // Only process top-level rules or rules directly inside @media/@supports etc.
        // Ignore rules nested inside other rules (standard CSS nesting behavior)
        if (rule.parent.type === 'rule') {
          return
        }

        const transformSelector = selectorParser((root) => {
          // Iterate over a static list to avoid infinite loops with insertions
          const selectors = []
          root.each(selector => {
            selectors.push(selector)
          })

          selectors.forEach((selector) => {
            // We only care about Selector nodes
            if (selector.type !== 'selector') return

            const firstNode = selector.first

            // Skip if empty or already nested
            if (!firstNode) return
            if (firstNode.type === 'nesting') return

            // Check if first node is a class
            if (firstNode.type === 'class') {
              const className = firstNode.value
              const isRoot = rootClasses.has(className)
              const isDescendant = descendantClasses.has(className)

              if (isRoot) {
                if (isDescendant) {
                  // Transform to: &.classname, .classname
                  // Clone first (creates the descendant version)
                  const descendantSelector = selector.clone()

                  // Modify the original to be root version (&.classname)
                  const nesting = selectorParser.nesting()
                  selector.insertBefore(firstNode, nesting)

                  // Append the descendant selector to the parent Container
                  root.insertAfter(selector, descendantSelector)
                } else {
                  // Transform to: &.classname
                  const nesting = selectorParser.nesting()
                  selector.insertBefore(firstNode, nesting)
                }
              }
            }
          })
        })

        try {
          // @ts-ignore
          transformSelector.processSync(rule, { updateSelector: true })
        } catch (e) {
          console.error('Error parsing selector:', rule.selector, e)
        }
      }
    }
  ])

  const result = await processor.process(css, { from: undefined })
  return result.css
}
