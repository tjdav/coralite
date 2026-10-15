import { Parser } from 'htmlparser2'
import { isValidCustomElementName } from '../../shared/tags.js'
import { getLocForSubstring } from '../../shared/diagnostics.js'
import { kebabToCamel } from '../../shared/core.js'
import {
  RESERVED_IDENTIFIERS,
  extractIdentifiersFromExpr,
  deriveGetterName,
  generateGetterCode,
  createDiagnostic
} from '../helpers.js'
import { isDiagnosticIgnored } from './ignore-directives.js'
import {
  GLOBAL_ARIA_ATTRIBUTES,
  ROLE_SUPPORTED_ARIA,
  getElementRole,
  isInteractiveElement
} from './a11y-rules.js'

/**
 * Calculates 1-based line and column from string index offset.
 *
 * @param {string} source - Source code
 * @param {number} index - Search index
 * @returns {{ line: number, column: number }}
 */
function getLocFromIndex (source, index) {
  if (typeof index !== 'number' || index < 0) {
    return {
      line: 1,
      column: 1
    }
  }
  let line = 1
  let lastNewLine = -1
  for (let i = 0; i < index && i < source.length; i++) {
    if (source[i] === '\n') {
      line++
      lastNewLine = i
    }
  }
  return {
    line,
    column: index - lastNewLine
  }
}

/**
 * Pass 2: Template AST analysis using htmlparser2.
 * Traverses <template> section, extracts mustache tokens, detects complex expressions (CORALITE-E201),
 * checks inline event listeners (CORALITE-E203), collects template refs, candidate elements, style content,
 * and validates accessibility diagnostics (CORALITE-A101, A102, A103, A105).
 *
 * @param {object} context - ValidationContext instance
 */
export function validateTemplate (context) {
  const {
    sourceCode,
    filePath,
    templateTokens,
    templateRefs,
    templateElements,
    diagnostics,
    definedGetters,
    definedAttributes,
    definedServerProps
  } = context

  if (sourceCode.includes('<template') || sourceCode.includes('<script') || sourceCode.includes('<style')) {
    let currentSection = null
    let templateDepth = 0
    let templateSearchOffset = 0
    const definedStateProps = context.definedStateProps || new Set()
    const existingKeys = new Set([...definedGetters, ...definedAttributes, ...definedServerProps, ...definedStateProps])

    const isConclusive = Boolean(
      context.configObj &&
      (context.hasStateBlock || context.hasServerBlock) &&
      (!context.hasStateBlock || !context.hasUnresolvableState) &&
      (!context.hasServerBlock || !context.hasUnresolvableServer)
    )

    const resolvableSymbols = new Set([
      ...definedGetters,
      ...definedAttributes,
      ...definedServerProps,
      ...definedStateProps
    ])

    const extractMustacheFromText = (text, searchFromIndex) => {
      const mustacheRegex = /\{\{\s*([\s\S]+?)\s*\}\}/g

      let match
      while ((match = mustacheRegex.exec(text)) !== null) {
        const fullMatch = match[0]
        const expr = match[1].trim()
        const loc = getLocForSubstring(sourceCode, fullMatch, searchFromIndex)

        if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expr)) {
          templateTokens.add(expr)

          if (isConclusive) {
            if (!RESERVED_IDENTIFIERS.has(expr) && !/[.[\]\s]/.test(expr)) {
              if (!resolvableSymbols.has(expr) && !resolvableSymbols.has(kebabToCamel(expr))) {
                diagnostics.push(createDiagnostic({
                  code: 'CORALITE-E205',
                  severity: 'error',
                  message: `Template token "{{ ${expr} }}" does not resolve to any declared symbol.`,
                  filePath,
                  line: loc.line,
                  column: loc.column,
                  sourceCode,
                  cause: 'Searched: attributes, state, getters, server return shape.'
                }))
              }
            }
          }
        } else {
          // Non-pure identifier expression -> CORALITE-E201
          extractIdentifiersFromExpr(expr, templateTokens)

          const getterName = deriveGetterName(expr, existingKeys)
          const getterCode = generateGetterCode(getterName, expr)

          diagnostics.push(createDiagnostic({
            code: 'CORALITE-E201',
            severity: 'error',
            message: `Inline expression '{{ ${expr} }}' in template must be lifted to a derived getter.`,
            filePath,
            line: loc.line,
            column: loc.column,
            sourceCode,
            cause: 'Inline complex template expressions bypass static reactivity analysis. Lift expressions into derived getters.',
            fix: {
              action: 'lift_to_getter',
              expr,
              description: `Lift expression to getter '${getterName}'`,
              replacement: `{{ ${getterName} }}`,
              getter: {
                name: getterName,
                code: getterCode
              }
            }
          }))
        }
      }
    }

    const checkAttribs = (attribs, tagSearchOffset) => {
      if (!attribs) {
        return
      }
      for (const [attrName, attrVal] of Object.entries(attribs)) {
        // CORALITE-E203: Inline event listener check
        if (/^on[a-z]+/i.test(attrName)) {
          const loc = getLocForSubstring(sourceCode, attrName, tagSearchOffset)
          diagnostics.push(createDiagnostic({
            code: 'CORALITE-E203',
            severity: 'error',
            message: `Inline event listener attribute '${attrName}' detected on element in <template>.`,
            filePath,
            line: loc.line,
            column: loc.column,
            sourceCode,
            cause: 'Inline event listeners violate Content Security Policy (CSP) and serialization boundaries.',
            fix: {
              action: 'remove_attribute',
              description: `Remove inline ${attrName} attribute and wire with refs() in client()`
            }
          }))
        }

        if (attrName.toLowerCase() === 'ref' && attrVal) {
          const loc = getLocForSubstring(sourceCode, attrVal, tagSearchOffset)
          templateRefs.set(attrVal, loc)
        }
        if (attrVal) {
          extractMustacheFromText(attrVal, tagSearchOffset)
        }
      }
    }

    let parsedScriptContent = ''
    context.styleContent = ''

    let hasTemplateTag = false

    // Stack tracking elements in template for A102 (<a> content) and A105 (nested interactive)
    const elementStack = []

    const parser = new Parser(
      {
        onopentag (name, attribs) {
          const lowerName = name.toLowerCase()
          if (currentSection === null) {
            if (lowerName === 'template') {
              hasTemplateTag = true
              currentSection = 'template'
              templateDepth = 1
              templateSearchOffset = sourceCode.indexOf('<template')

              const rawId = attribs?.id ? String(attribs.id).trim() : null
              if (!rawId) {
                const loc = getLocForSubstring(sourceCode, '<template', templateSearchOffset)
                diagnostics.push(createDiagnostic({
                  code: 'CORALITE-E204',
                  severity: 'error',
                  message: 'Missing required "id" attribute on <template>. Component custom element tag name must be defined by the template id.',
                  filePath,
                  line: loc.line,
                  column: loc.column,
                  sourceCode,
                  cause: 'Coralite components require an id attribute on the <template> tag to define their custom element tag name.'
                }))
              } else if (!isValidCustomElementName(rawId)) {
                const loc = getLocForSubstring(sourceCode, rawId, templateSearchOffset)
                diagnostics.push(createDiagnostic({
                  code: 'CORALITE-E204',
                  severity: 'error',
                  message: `Invalid template id "${rawId}". Component tag name must be a valid custom element name (contain a hyphen and match WHATWG custom element specification).`,
                  filePath,
                  line: loc.line,
                  column: loc.column,
                  sourceCode,
                  cause: `The template id "${rawId}" is not a valid custom element tag name according to the WHATWG custom element specification.`
                }))
              } else {
                context.templateId = rawId
              }

              checkAttribs(attribs, templateSearchOffset)
            } else if (lowerName === 'script') {
              currentSection = 'script'
            } else if (lowerName === 'style') {
              currentSection = 'style'
            }
          } else if (currentSection === 'template') {
            if (lowerName === 'template') {
              templateDepth++
            } else {
              const tagLoc = getLocFromIndex(sourceCode, parser.startIndex)

              templateElements.push({
                tagName: lowerName,
                id: attribs?.id ? String(attribs.id).trim() : null,
                className: attribs?.class ? String(attribs.class).trim() : null,
                hasRef: Boolean(attribs && (attribs.ref !== undefined || Object.keys(attribs).some(a => a.toLowerCase() === 'ref')))
              })

              /** @type {Record<string, string>} */
              const normAttribs = {}
              if (attribs) {
                for (const [k, v] of Object.entries(attribs)) {
                  normAttribs[k.toLowerCase()] = String(v)
                }
              }

              // CORALITE-A101: <img> missing alt attribute
              if (lowerName === 'img' && !isDiagnosticIgnored('CORALITE-A101', context)) {
                if (!('alt' in normAttribs)) {
                  diagnostics.push(createDiagnostic({
                    code: 'CORALITE-A101',
                    severity: 'warning',
                    message: '<img> is missing an alt attribute. Add alt="" for decorative images.',
                    filePath,
                    line: tagLoc.line,
                    column: tagLoc.column,
                    sourceCode,
                    cause: 'Every <img> element must have an alt attribute (use alt="" for decorative images).'
                  }))
                }
              }

              // CORALITE-A103: aria-* attribute on unsupported role
              if (!isDiagnosticIgnored('CORALITE-A103', context)) {
                const role = getElementRole(lowerName, normAttribs)
                if (role && ROLE_SUPPORTED_ARIA[role]) {
                  const allowedSet = ROLE_SUPPORTED_ARIA[role]
                  for (const attr of Object.keys(normAttribs)) {
                    if (attr.startsWith('aria-')) {
                      if (!GLOBAL_ARIA_ATTRIBUTES.has(attr) && !allowedSet.has(attr)) {
                        const attrLoc = getLocForSubstring(sourceCode, attr, parser.startIndex)
                        diagnostics.push(createDiagnostic({
                          code: 'CORALITE-A103',
                          severity: 'warning',
                          message: `Attribute '${attr}' is not supported on role '${role}'.`,
                          filePath,
                          line: attrLoc.line,
                          column: attrLoc.column,
                          sourceCode,
                          cause: `WAI-ARIA specification does not list '${attr}' as a supported attribute for role '${role}'.`
                        }))
                      }
                    }
                  }
                }
              }

              // CORALITE-A105: Nested interactive elements
              const interactive = isInteractiveElement(lowerName, normAttribs)
              if (interactive) {
                // Check if any ancestor in elementStack is interactive
                const interactiveAncestor = elementStack.slice().reverse().find(el => el.interactive)
                if (interactiveAncestor && !isDiagnosticIgnored('CORALITE-A105', context)) {
                  diagnostics.push(createDiagnostic({
                    code: 'CORALITE-A105',
                    severity: 'warning',
                    message: `Nested interactive element <${lowerName}> inside <${interactiveAncestor.tagName}>.`,
                    filePath,
                    line: tagLoc.line,
                    column: tagLoc.column,
                    sourceCode,
                    cause: 'Interactive elements like <button>, <a>, or <input> cannot be nested inside another interactive element.'
                  }))
                }
              }

              // Push onto stack
              elementStack.push({
                tagName: lowerName,
                attribs: normAttribs,
                tagLoc,
                interactive,
                hasAccessibleContent: false
              })
            }
            checkAttribs(attribs, parser.startIndex)
          }
        },
        ontext (text) {
          if (currentSection === 'template') {
            extractMustacheFromText(text, parser.startIndex)

            // For A102: check if text contains non-whitespace or mustache tokens
            if (text.trim().length > 0) {
              for (const el of elementStack) {
                el.hasAccessibleContent = true
              }
            }
          } else if (currentSection === 'script') {
            parsedScriptContent += text
          } else if (currentSection === 'style') {
            context.styleContent += text
          }
        },
        onclosetag (name) {
          const lowerName = name.toLowerCase()
          if (currentSection === 'template') {
            if (lowerName === 'template') {
              templateDepth--
              if (templateDepth === 0) {
                currentSection = null
              }
            } else {
              const closedEl = elementStack.pop()
              if (closedEl) {
                // If closed element had accessible content, mark parent as having accessible content
                if (closedEl.hasAccessibleContent && elementStack.length > 0) {
                  elementStack[elementStack.length - 1].hasAccessibleContent = true
                }

                // Also if closed element was an img with alt text, mark parent as having accessible content
                if (closedEl.tagName === 'img' && closedEl.attribs.alt && closedEl.attribs.alt.trim().length > 0) {
                  if (elementStack.length > 0) {
                    elementStack[elementStack.length - 1].hasAccessibleContent = true
                  }
                }

                // Also if closed element was a slot, mark parent as having accessible content
                if (closedEl.tagName === 'slot') {
                  if (elementStack.length > 0) {
                    elementStack[elementStack.length - 1].hasAccessibleContent = true
                  }
                }

                // CORALITE-A102: <a> without accessible text
                if (closedEl.tagName === 'a' && !isDiagnosticIgnored('CORALITE-A102', context)) {
                  const hasAriaLabel = Boolean(
                    closedEl.attribs['aria-label'] ||
                    closedEl.attribs['aria-labelledby'] ||
                    closedEl.attribs.title
                  )
                  if (!closedEl.hasAccessibleContent && !hasAriaLabel) {
                    diagnostics.push(createDiagnostic({
                      code: 'CORALITE-A102',
                      severity: 'warning',
                      message: '<a> element has no accessible text content or aria-label.',
                      filePath,
                      line: closedEl.tagLoc.line,
                      column: closedEl.tagLoc.column,
                      sourceCode,
                      cause: 'Anchor links must have visible text, an img with alt text, a slot, or an aria-label attribute for accessibility.'
                    }))
                  }
                }
              }
            }
          } else if (currentSection === 'script' && lowerName === 'script') {
            currentSection = null
          } else if (currentSection === 'style' && lowerName === 'style') {
            currentSection = null
          }
        }
      },
      {
        lowerCaseTags: true,
        lowerCaseAttributeNames: true
      }
    )

    parser.write(sourceCode)
    parser.end()

    if (!hasTemplateTag) {
      diagnostics.push(createDiagnostic({
        code: 'CORALITE-E204',
        severity: 'error',
        message: 'Missing <template> tag in component. Coralite components must define a <template id="..."> element.',
        filePath,
        line: 1,
        column: 1,
        sourceCode,
        cause: 'Coralite component files must contain a <template id="..."> tag to define the component markup and custom element tag name.'
      }))
    }

    if (parsedScriptContent) {
      context.scriptContent = parsedScriptContent
    }
  } else {
    context.scriptContent = sourceCode
  }
}
