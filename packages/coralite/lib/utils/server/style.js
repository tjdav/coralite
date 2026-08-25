import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'
import { CoraliteError, defaultOnError } from '../errors.js'

/**
 * @import { CoraliteOnError } from '../../../types/index.js'
 */

/**
 * Options for CSS transformation
 * @typedef {Object} TransformCssOptions
 * @property {'nesting' | 'scope'} [mode='nesting'] - Transformation mode
 */

/**
 * Transforms component CSS:
 * - In 'nesting' mode: Unwraps top-level pure :host rules into declarations; converts parameterized :host(...) to &.class; converts ::slotted(selector) to (& > slot > selector, & > selector[slot]).
 * - In 'scope' mode: Converts top-level pure :host rules to :scope; converts parameterized :host(...) to :scope.class; converts ::slotted(selector) to (:scope > slot > selector, :scope > selector[slot]).
 * - Converts :host-context(...) to ancestor context selectors (<context> & or <context> :scope).
 * - Converts :global(selector) by unwrapping inner selectors and hoisting nested rules out of scoped selectors.
 * - Preserves @container queries, scoping their child selectors appropriately.
 * - Preserves @keyframes definitions intact without selector prefixing or mangling.
 * - Leaves standard element and class selectors intact.
 *
 * @param {string} css - The raw CSS content from the component <style> block
 * @param {CoraliteOnError} [onError] - Error handler callback
 * @param {TransformCssOptions} [options={}] - Options object
 * @returns {Promise<string>} Transformed CSS
 */
export async function transformCss (css, onError, options = {}) {
  const mode = options.mode || 'nesting'
  const processor = postcss([
    {
      postcssPlugin: 'coralite-style-transform',
      Rule (rule) {
        // Bypass selector transformation for @keyframes steps (0%, 50%, 100%, from, to)
        if (rule.parent.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) {
          return
        }

        // Ignore standard rules nested inside other rules unless they contain :global
        if (rule.parent.type === 'rule' && !rule.selector.includes(':global')) {
          return
        }

        // Unwrap or convert top-level pure :host rules
        if (rule.parent.type === 'root' && rule.selector.trim() === ':host') {
          if (mode === 'scope') {
            rule.selector = ':scope'
          } else {
            rule.root().prepend(...rule.nodes)
            rule.remove()
            return
          }
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

            // Skip if empty
            if (!firstNode) {
              return
            }

            // 1. Transform :host and :host-context in selector first
            const hostContextNode = selector.nodes.find(n => n.type === 'pseudo' && n.value === ':host-context')
            const hostNode = selector.nodes.find(n => n.type === 'pseudo' && n.value === ':host')

            if (hostContextNode || hostNode) {
              const hostReplacement = mode === 'scope'
                ? selectorParser.pseudo({ value: ':scope' })
                : selectorParser.nesting()

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
                  hostNode.replaceWith(hostReplacement)
                  if (hostNode.nodes && hostNode.nodes.length > 0) {
                    let lastInserted = hostReplacement
                    for (const innerSel of hostNode.nodes) {
                      for (const child of innerSel.nodes) {
                        selector.insertAfter(lastInserted, child.clone())
                        lastInserted = child
                      }
                    }
                  }
                  hostContextNode.remove()
                } else {
                  hostContextNode.replaceWith(hostReplacement)
                }
              } else if (hostNode) {
                hostNode.replaceWith(hostReplacement)
                if (hostNode.nodes && hostNode.nodes.length > 0) {
                  let lastInserted = hostReplacement
                  for (const innerSel of hostNode.nodes) {
                    for (const child of innerSel.nodes) {
                      selector.insertAfter(lastInserted, child.clone())
                      lastInserted = child
                    }
                  }
                }
              }
            }

            // 2. Transform ::slotted(selector) to Light DOM slot projections
            const slottedPseudo = selector.nodes.find(n => n.type === 'pseudo' && n.value === '::slotted')
            if (slottedPseudo) {
              const slottedIndex = selector.nodes.indexOf(slottedPseudo)
              let prefixNodes = selector.nodes.slice(0, slottedIndex).map(n => n.clone())

              while (prefixNodes.length > 0 && prefixNodes[prefixNodes.length - 1].type === 'combinator') {
                prefixNodes.pop()
              }

              if (prefixNodes.length === 0) {
                const defaultReplacement = mode === 'scope'
                  ? selectorParser.pseudo({ value: ':scope' })
                  : selectorParser.nesting()
                prefixNodes = [defaultReplacement]
              }

              const innerSel = slottedPseudo.nodes ? slottedPseudo.nodes[0] : null

              // Branch 1: <prefix> > slot > <innerSel>
              const branch1 = selectorParser.selector({
                value: '',
                nodes: []
              })
              prefixNodes.forEach(n => branch1.append(n.clone()))
              branch1.append(selectorParser.combinator({ value: ' > ' }))
              branch1.append(selectorParser.tag({ value: 'slot' }))
              branch1.append(selectorParser.combinator({ value: ' > ' }))
              if (innerSel) {
                innerSel.nodes.forEach(n => branch1.append(n.clone()))
              }

              // Branch 2: <prefix> > <innerSelWithSlotAttribute>
              const branch2 = selectorParser.selector({
                value: '',
                nodes: []
              })
              prefixNodes.forEach(n => branch2.append(n.clone()))
              branch2.append(selectorParser.combinator({ value: ' > ' }))

              if (innerSel) {
                const innerClones = innerSel.nodes.map(n => n.clone())
                const firstCombIdx = innerClones.findIndex(n => n.type === 'combinator')
                const attrSlot = selectorParser.attribute({
                  attribute: 'slot',
                  value: undefined,
                  raws: {}
                })

                if (firstCombIdx !== -1) {
                  innerClones.splice(firstCombIdx, 0, attrSlot)
                } else {
                  innerClones.push(attrSlot)
                }
                innerClones.forEach(n => branch2.append(n))
              }

              selector.replaceWith(branch1, branch2)
              return
            }

            // 3. Transform :global(selector) by unwrapping inner selector
            const globalPseudo = selector.nodes.find(n => n.type === 'pseudo' && n.value === ':global')
            if (globalPseudo) {
              const innerSels = globalPseudo.nodes
              if (innerSels && innerSels.length > 0) {
                if (innerSels.length === 1) {
                  const innerNodes = innerSels[0].nodes.map(n => n.clone())
                  globalPseudo.replaceWith(...innerNodes)
                } else {
                  const replacements = innerSels.map(innerSel => {
                    const newSel = selector.clone()
                    const p = newSel.nodes.find(n => n.type === 'pseudo' && n.value === ':global')
                    p.replaceWith(...innerSel.nodes.map(n => n.clone()))
                    return newSel
                  })
                  selector.replaceWith(...replacements)
                }
              }
            }
          })
        })

        try {
          transformSelector.processSync(rule, { updateSelector: true })

          // If rule was nested inside another rule and contains :global, hoist it out to root/atrule
          if (rule.parent.type === 'rule') {
            let target = rule.parent
            while (target.parent && target.parent.type === 'rule') {
              target = target.parent
            }
            if (target.parent) {
              target.after(rule)
            }
          }
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

  try {
    const result = await processor.process(css, { from: undefined })
    return result.css
  } catch (error) {
    const message = 'Error processing CSS: ' + (error.message || error)
    if (typeof onError === 'function') {
      onError({
        level: 'ERR',
        message,
        error
      })
    } else {
      console.error(message, error)
    }
    return css
  }
}

/**
 * Formats raw component CSS into @supports (@scope) and @supports not (@scope) blocks.
 *
 * @param {string} componentId - The custom element tag name / component ID
 * @param {string} rawCss - Raw component CSS content
 * @param {CoraliteOnError} [onError] - Error handler callback
 * @returns {Promise<string>} Formatted CSS blocks
 */
export async function formatComponentCss (componentId, rawCss, onError = defaultOnError) {
  if (onError !== undefined && typeof onError !== 'function') {
    throw new CoraliteError('formatComponentCSS requires "onError" to be a function')
  }

  if (!rawCss || !rawCss.trim()) {
    return ''
  }

  const scopeCss = await transformCss(rawCss, onError, { mode: 'scope' })
  const fallbackCss = await transformCss(rawCss, onError, { mode: 'nesting' })

  const indent = (str) => str.split('\n').map(line => (line ? `      ${line}` : '')).join('\n')

  return `  @supports (@scope) {
    @scope (:where(${componentId})) to (slot, [data-cid], :is([is], c-token)) {
${indent(scopeCss)}
    }
  }

  @supports not (@scope) {
    :where(${componentId}) {
${indent(fallbackCss)}
    }
  }`
}

/**
 * Builds component layer stylesheet containing c-token and component CSS rules.
 *
 * @param {Map<string, string>} styles - Map of component style selectors and CSS rules
 * @returns {string} Compiled stylesheet content
 */
export function buildComponentStylesheet (styles) {
  if (!styles || styles.size === 0) {
    return ''
  }

  let cssContent = 'c-token { display: contents; }\n'
  for (const [, css] of styles) {
    cssContent += `@layer components {\n${css}\n}\n`
  }
  return cssContent
}
