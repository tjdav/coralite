import { getLocForSubstring } from './helpers.js'

/**
 * Creates and initializes a shared ValidationContext object for component validation passes.
 *
 * @param {string} sourceCode - Raw component file content
 * @param {string} [filePath=''] - Path to component file for context
 * @returns {object} The initialized ValidationContext
 */
export function createValidationContext (sourceCode, filePath = '') {
  let scriptContent = ''
  if (sourceCode.includes('<script')) {
    const scriptMatch = sourceCode.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/i)
    if (scriptMatch) {
      scriptContent = scriptMatch[1]
    }
  } else if (!sourceCode.includes('<template')) {
    scriptContent = sourceCode
  }

  const scriptStartLine = scriptContent && sourceCode.includes('<script')
    ? getLocForSubstring(sourceCode, scriptContent).line - 1
    : 0

  return {
    sourceCode,
    filePath,
    scriptContent,
    styleContent: '',
    scriptStartLine,
    scriptStringPool: [],
    templateTokens: new Set(),
    templateRefs: new Map(),
    templateElements: [],
    diagnostics: [],
    definedAttributes: new Set(),
    definedServerProps: new Set(),
    definedConsumedKeys: new Set(),
    definedGetters: new Set(),
    definedSlots: new Set(),
    topLevelImports: new Map(),
    importLocations: new Map(),
    attributeLocations: new Map(),
    getterLocations: new Map(),
    serverPropLocations: new Map(),
    usedTopLevelImportsInClient: new Set(),
    usedTopLevelImportsOutsideClient: new Set(),
    stateReads: new Set(),
    refsCalls: new Map(),
    getterStateDependencies: new Set(),
    ignoredSymbols: new Set(),
    isEntireComponentIgnored: false,
    configObj: null,
    configProps: new Map()
  }
}
