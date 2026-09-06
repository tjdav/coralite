import { camelToKebab, kebabToCamel, stripCssComments } from '../../utils/core.js'
import {
  INTERACTIVE_TAGS,
  isRefUsedInSelector,
  createDiagnostic
} from '../helpers.js'

/**
 * Pass 10: Dead code detection, precision ref scanning, candidate matching, metrics, and result assembly.
 * Evaluates unused getters/serverProps/attributes (CORALITE-W401), unused template refs (CORALITE-W402),
 * missing refs called in script (CORALITE-E202), calculates metrics, and builds final CoraliteComponentValidationResult.
 *
 * @param {object} context - ValidationContext instance
 * @returns {object} Final CoraliteComponentValidationResult object
 */
export function collectDeadCode (context) {
  const {
    sourceCode,
    filePath,
    styleContent,
    scriptStringPool,
    templateTokens,
    templateRefs,
    templateElements,
    diagnostics,
    definedAttributes,
    definedServerProps,
    definedConsumedKeys,
    definedGetters,
    definedSlots,
    topLevelImports,
    getterLocations,
    serverPropLocations,
    attributeLocations,
    usedTopLevelImportsInClient,
    stateReads,
    refsCalls,
    getterStateDependencies,
    ignoredSymbols,
    isEntireComponentIgnored
  } = context

  // 3. CSS Attribute & DOM Host Selector Check
  const combinedCssAndSource = (styleContent + '\n' + sourceCode).toLowerCase()
  for (const attr of definedAttributes) {
    const kebabAttr = camelToKebab(attr)
    if (
      combinedCssAndSource.includes(`[${kebabAttr}`) ||
      combinedCssAndSource.includes(`[${attr.toLowerCase()}`) ||
      combinedCssAndSource.includes(`getattribute('${kebabAttr}')`) ||
      combinedCssAndSource.includes(`getattribute("${kebabAttr}")`) ||
      combinedCssAndSource.includes(`getattribute('${attr}')`) ||
      combinedCssAndSource.includes(`getattribute("${attr}")`)
    ) {
      stateReads.add(attr)
    }
  }

  // Cross-reference unused items & emit CORALITE-W401
  const unusedGetters = []
  for (const getter of definedGetters) {
    if (
      !isEntireComponentIgnored &&
      !ignoredSymbols.has(getter) &&
      !templateTokens.has(getter) &&
      !stateReads.has(getter) &&
      !getterStateDependencies.has(getter)
    ) {
      unusedGetters.push(getter)
      const loc = getterLocations.get(getter) || {
        line: 1,
        column: 1
      }
      diagnostics.push(createDiagnostic({
        code: 'CORALITE-W401',
        severity: 'warning',
        message: `Unused getter '${getter}'.`,
        filePath,
        line: loc.line,
        column: loc.column,
        sourceCode,
        cause: `Unreferenced getter '${getter}'.`,
        fix: {
          description: 'Remove unused getter/serverProp/attribute'
        }
      }))
    }
  }

  const unusedServerProps = []
  for (const prop of definedServerProps) {
    if (
      !definedConsumedKeys.has(prop) &&
      !isEntireComponentIgnored &&
      !ignoredSymbols.has(prop) &&
      !templateTokens.has(prop) &&
      !stateReads.has(prop) &&
      !getterStateDependencies.has(prop)
    ) {
      unusedServerProps.push(prop)
      const loc = serverPropLocations.get(prop) || {
        line: 1,
        column: 1
      }

      diagnostics.push(createDiagnostic({
        code: 'CORALITE-W401',
        severity: 'warning',
        message: `Unused server property '${prop}'.`,
        filePath,
        line: loc.line,
        column: loc.column,
        sourceCode,
        cause: `Unreferenced server property '${prop}'.`,
        fix: {
          description: 'Remove unused getter/serverProp/attribute'
        }
      }))
    }
  }

  const unusedAttributes = []
  for (const attr of definedAttributes) {
    const errorCamelToken = 'error_' + kebabToCamel(attr)
    const errorKebabToken = 'error_' + camelToKebab(attr)
    const isErrorTokenUsed = templateTokens.has(errorCamelToken) || templateTokens.has(errorKebabToken) || stateReads.has(errorCamelToken) || stateReads.has(errorKebabToken)

    if (
      !isEntireComponentIgnored &&
      !ignoredSymbols.has(attr) &&
      !templateTokens.has(attr) &&
      !stateReads.has(attr) &&
      !getterStateDependencies.has(attr) &&
      !definedServerProps.has(attr) &&
      !isErrorTokenUsed
    ) {
      unusedAttributes.push(attr)
      const loc = attributeLocations.get(attr) || {
        line: 1,
        column: 1
      }
      diagnostics.push(createDiagnostic({
        code: 'CORALITE-W401',
        severity: 'warning',
        message: `Unused attribute '${attr}'.`,
        filePath,
        line: loc.line,
        column: loc.column,
        sourceCode,
        cause: `Unreferenced attribute '${attr}'.`,
        fix: {
          description: 'Remove unused getter/serverProp/attribute'
        }
      }))
    }
  }

  // Element refs cross-referencing (CORALITE-W402 & CORALITE-E202)
  const cleanStyleContent = stripCssComments(styleContent)

  const unusedRefs = []
  for (const [ref, loc] of templateRefs.entries()) {
    const refToken = 'ref_' + ref
    const refCamelToken = 'ref_' + kebabToCamel(ref)
    const refKebabToken = 'ref_' + camelToKebab(ref)

    const isUsed =
      isRefUsedInSelector(ref, scriptStringPool, cleanStyleContent) ||
      refsCalls.has(ref) ||
      refsCalls.has(refToken) ||
      refsCalls.has(refCamelToken) ||
      refsCalls.has(refKebabToken) ||
      templateTokens.has(refToken) ||
      templateTokens.has(refCamelToken) ||
      templateTokens.has(refKebabToken) ||
      stateReads.has(refToken) ||
      stateReads.has(refCamelToken) ||
      stateReads.has(refKebabToken) ||
      getterStateDependencies.has(refToken) ||
      getterStateDependencies.has(refCamelToken) ||
      getterStateDependencies.has(refKebabToken)

    const isIgnored =
      isEntireComponentIgnored ||
      ignoredSymbols.has(ref) ||
      ignoredSymbols.has(refToken) ||
      ignoredSymbols.has(refCamelToken) ||
      ignoredSymbols.has(refKebabToken)

    if (!isUsed && !isIgnored) {
      unusedRefs.push(ref)
      diagnostics.push(createDiagnostic({
        code: 'CORALITE-W402',
        severity: 'warning',
        message: `Element ref '${ref}' defined in template but never accessed.`,
        filePath,
        line: loc.line,
        column: loc.column,
        sourceCode,
        cause: `Unused ref="${ref}" attribute in template.`,
        fix: {
          description: 'Remove unused ref attribute'
        }
      }))
    }
  }

  // Collect candidate ref references from refsCalls, templateTokens, stateReads, getterStateDependencies
  const candidateRefRefs = new Map()

  const addCandidateRef = (rawName, sourceToken) => {
    let stripped = rawName
    if (stripped.startsWith('ref_')) {
      stripped = stripped.slice(4)
    }
    if (!candidateRefRefs.has(stripped)) {
      candidateRefRefs.set(stripped, new Set())
    }
    candidateRefRefs.get(stripped).add(sourceToken || rawName)
  }

  for (const call of refsCalls.keys()) {
    addCandidateRef(call, call)
  }
  for (const token of templateTokens) {
    if (token.startsWith('ref_')) {
      addCandidateRef(token, token)
    }
  }
  for (const read of stateReads) {
    if (read.startsWith('ref_')) {
      addCandidateRef(read, read)
    }
  }
  for (const dep of getterStateDependencies) {
    if (dep.startsWith('ref_')) {
      addCandidateRef(dep, dep)
    }
  }

  const missingRefs = []
  for (const [strippedRef, sourceTokens] of candidateRefRefs.entries()) {
    const refToken = 'ref_' + strippedRef
    const refCamel = kebabToCamel(strippedRef)
    const refKebab = camelToKebab(strippedRef)

    let existsInTemplate = templateRefs.has(strippedRef) || templateRefs.has(refKebab) || templateRefs.has(refCamel)
    if (!existsInTemplate) {
      for (const tRef of templateRefs.keys()) {
        if (kebabToCamel(tRef) === refCamel || camelToKebab(tRef) === refKebab) {
          existsInTemplate = true
          break
        }
      }
    }

    if (existsInTemplate) {
      continue
    }

    const isDefinedElsewhere =
      definedAttributes.has(strippedRef) ||
      definedAttributes.has(refToken) ||
      definedAttributes.has(refCamel) ||
      definedServerProps.has(strippedRef) ||
      definedServerProps.has(refToken) ||
      definedServerProps.has(refCamel) ||
      definedGetters.has(strippedRef) ||
      definedGetters.has(refToken) ||
      definedGetters.has(refCamel)

    if (isDefinedElsewhere) {
      continue
    }

    let isIgnored = isEntireComponentIgnored || ignoredSymbols.has(strippedRef) || ignoredSymbols.has(refToken) || ignoredSymbols.has(refCamel)
    if (!isIgnored) {
      for (const token of sourceTokens) {
        if (ignoredSymbols.has(token)) {
          isIgnored = true
          break
        }
      }
    }

    if (!isIgnored) {
      missingRefs.push(strippedRef)
      const callLoc = refsCalls.get(strippedRef) || refsCalls.get('ref_' + strippedRef) || {
        line: 1,
        column: 1
      }

      // Candidate matching logic
      const isSemanticMatch = (el) => {
        const rLower = strippedRef.toLowerCase()
        const rCamel = kebabToCamel(strippedRef)
        const rKebab = camelToKebab(strippedRef)

        if (el.id && (el.id === strippedRef || el.id.toLowerCase() === rLower || kebabToCamel(el.id) === rCamel)) {
          return true
        }

        if (el.className) {
          const classes = el.className.split(/\s+/)
          if (classes.some(c => c === strippedRef || c.toLowerCase() === rLower || kebabToCamel(c) === rCamel)) {
            return true
          }
        }

        const tag = el.tagName.toLowerCase()
        if (tag === rLower || tag === rKebab) {
          return true
        }
        if (tag === 'button' && (rLower === 'btn' || rLower === 'button' || rLower.endsWith('-btn') || rLower.endsWith('_btn') || rLower.endsWith('button') || rLower.includes('btn'))) {
          return true
        }
        if (tag === 'input' && (rLower.endsWith('-input') || rLower.endsWith('_input') || rLower.includes('input'))) {
          return true
        }

        return false
      }

      let candidates = templateElements.filter(isSemanticMatch)
      if (candidates.length === 0) {
        const interactiveCandidates = templateElements.filter(el => INTERACTIVE_TAGS.has(el.tagName))
        if (interactiveCandidates.length > 0) {
          candidates = interactiveCandidates
        } else {
          candidates = templateElements
        }
      }

      const eligibleCandidates = candidates.filter(el => !el.hasRef)
      const candidateCount = eligibleCandidates.length
      const candidateTag = candidateCount === 1 ? eligibleCandidates[0].tagName : null

      const causeMessage = candidateCount === 1
        ? `Found 1 matching candidate element (<${candidateTag}>) in template for ref "${strippedRef}".`
        : `Found ${candidateCount} candidate elements in template for ref "${strippedRef}". Auto-injection skipped due to ambiguity.`

      const fixPayload = candidateCount === 1
        ? {
          action: 'inject_ref',
          description: `Add ref="${strippedRef}" to matching <${candidateTag}> element`,
          replacement: `ref="${strippedRef}"`
        }
        : {
          description: `Manually add ref="${strippedRef}" to target element in template`
        }

      diagnostics.push(createDiagnostic({
        code: 'CORALITE-E202',
        severity: 'error',
        message: `Missing ref "${strippedRef}" in template`,
        filePath,
        line: callLoc.line,
        column: callLoc.column,
        sourceCode,
        cause: causeMessage,
        fix: fixPayload
      }))
    }
  }

  const invalidClientImports = Array.from(usedTopLevelImportsInClient)

  const totalDefined = definedGetters.size + definedServerProps.size + definedAttributes.size + templateRefs.size
  const totalUnused = unusedGetters.length + unusedServerProps.length + unusedAttributes.length + unusedRefs.length + invalidClientImports.length
  const totalErrors = diagnostics.filter(d => d.severity === 'error').length
  const valid = totalErrors === 0 && totalUnused === 0
  const usageCoveragePercentage = totalDefined > 0
    ? Math.round(((totalDefined - totalUnused) / totalDefined) * 100)
    : 100

  return {
    filePath,
    valid,
    diagnostics,
    defined: {
      getters: Array.from(definedGetters),
      serverProps: Array.from(definedServerProps),
      attributes: Array.from(definedAttributes),
      refs: Array.from(templateRefs.keys()),
      imports: Array.from(topLevelImports.keys()),
      slots: Array.from(definedSlots)
    },
    unused: {
      getters: unusedGetters,
      serverProps: unusedServerProps,
      attributes: unusedAttributes,
      refs: unusedRefs,
      missingRefs,
      invalidClientImports,
      invalidImports: invalidClientImports
    },
    metrics: {
      totalDefined,
      totalUnused,
      totalErrors,
      usageCoveragePercentage
    }
  }
}
