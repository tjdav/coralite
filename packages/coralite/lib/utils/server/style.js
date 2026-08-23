import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'

/**
 * @import { CoraliteOnError } from '../../../types/index.js'
 */

/**
 * Transforms component CSS:
 * - Unwraps top-level pure :host rules so declarations apply directly to the custom element root container.
 * - Converts parameterized :host(...) and pseudo-states to CSS nesting (&.class, &:hover, etc.).
 * - Converts :host-context(...) to ancestor context selectors (<context> &).
 * - Leaves standard element and class selectors intact so they scope as descendants inside the custom element.
 *
 * @param {string} css - The raw CSS content from the component <style> block
 * @param {CoraliteOnError} [onError] - Error handler callback
 * @returns {Promise<string>} Transformed CSS
 */
export async function transformCss (css, onError) {
  const processor = postcss([
    {
      postcssPlugin: 'coralite-style-transform',
      Rule (rule) {
        // Ignore rules nested inside other rules (standard CSS nesting behavior)
        if (rule.parent.type === 'rule') {
          return
        }

        // Unwrap top-level pure :host rules so declarations sit directly on the component root rule
        if (rule.parent.type === 'root' && rule.selector.trim() === ':host') {
          rule.replaceWith(...rule.nodes)
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
            if (selector.type !== 'selector') {
              return
            }

            const firstNode = selector.first

            // Skip if empty or already nested
            if (!firstNode) {
              return
            }
            if (firstNode.type === 'nesting') {
              return
            }

            const hostContextNode = selector.nodes.find(n => n.type === 'pseudo' && n.value === ':host-context')
            const hostNode = selector.nodes.find(n => n.type === 'pseudo' && n.value === ':host')

            if (hostContextNode || hostNode) {
              const nesting = selectorParser.nesting()

              if (hostContextNode) {
                const space = selectorParser.combinator({ value: ' ' })
                const targetFirst = selector.first

                if (hostContextNode.nodes && hostContextNode.nodes.length > 0) {
                  let insertBeforeTarget = targetFirst
                  for (const innerSel of hostContextNode.nodes) {
                    for (const child of innerSel.nodes) {
                      selector.insertBefore(insertBeforeTarget, child.clone())
                    }
                  }
                  selector.insertBefore(targetFirst, space)
                }

                if (hostNode) {
                  hostNode.replaceWith(nesting)
                  if (hostNode.nodes && hostNode.nodes.length > 0) {
                    let lastInserted = nesting
                    for (const innerSel of hostNode.nodes) {
                      for (const child of innerSel.nodes) {
                        selector.insertAfter(lastInserted, child.clone())
                        lastInserted = child
                      }
                    }
                  }
                  hostContextNode.remove()
                } else {
                  hostContextNode.replaceWith(nesting)
                }
                return
              }

              if (hostNode) {
                hostNode.replaceWith(nesting)
                if (hostNode.nodes && hostNode.nodes.length > 0) {
                  let lastInserted = nesting
                  for (const innerSel of hostNode.nodes) {
                    for (const child of innerSel.nodes) {
                      selector.insertAfter(lastInserted, child.clone())
                      lastInserted = child
                    }
                  }
                }
              }
            }
          })
        })

        try {
          // @ts-ignore
          transformSelector.processSync(rule, { updateSelector: true })
        } catch (error) {
          const message = 'Error parsing selector: ' + rule.selector
          if (typeof onError === 'function') {
            onError({
              level: 'ERR',
              message,
              error
            })
          } else {
            console.error(message, error)
          }
        }
      }
    }
  ])

  const result = await processor.process(css, { from: undefined })
  return result.css
}
