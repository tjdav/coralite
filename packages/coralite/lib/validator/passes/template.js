import { Parser } from 'htmlparser2'
import { isValidCustomElementName } from '../../utils/tags.js'
import { getLocForSubstring } from '../../utils/diagnostics.js'
import {
  extractIdentifiersFromExpr,
  deriveGetterName,
  generateGetterCode,
  createDiagnostic
} from '../helpers.js'

/**
 * Pass 2: Template AST analysis using htmlparser2.
 * Traverses <template> section, extracts mustache tokens, detects complex expressions (CORALITE-E201),
 * checks inline event listeners (CORALITE-E203), collects template refs, candidate elements, and style content.
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
    const existingKeys = new Set([...definedGetters, ...definedAttributes, ...definedServerProps])

    const extractMustacheFromText = (text, searchFromIndex) => {
      const mustacheRegex = /\{\{\s*([\s\S]+?)\s*\}\}/g

      let match
      while ((match = mustacheRegex.exec(text)) !== null) {
        const fullMatch = match[0]
        const expr = match[1].trim()
        const loc = getLocForSubstring(sourceCode, fullMatch, searchFromIndex)

        if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expr)) {
          templateTokens.add(expr)
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
              templateElements.push({
                tagName: lowerName,
                id: attribs?.id ? String(attribs.id).trim() : null,
                className: attribs?.class ? String(attribs.class).trim() : null,
                hasRef: Boolean(attribs && (attribs.ref !== undefined || Object.keys(attribs).some(a => a.toLowerCase() === 'ref')))
              })
            }
            checkAttribs(attribs, templateSearchOffset)
          }
        },
        ontext (text) {
          if (currentSection === 'template') {
            extractMustacheFromText(text, templateSearchOffset)
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
