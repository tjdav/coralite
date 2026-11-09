import { extractScriptTagsFromHTML } from '../utils/parse.js'
/**
 * Creates and initializes a shared ValidationContext object for component validation passes.
 *
 * @param {string} sourceCode - Raw component file content
 * @param {string} [filePath=''] - Path to component file for context
 * @param {Object} [options={}] - Validation options
 * @param {string} [options.kind] - Module kind ('component' or 'page')
 * @returns {object} The initialized ValidationContext
 */
export function createValidationContext (sourceCode, filePath = '', options = {}) {
  let scriptContent = ''
  let scriptStartLine = 0

  if (sourceCode.includes('<script')) {
    const scripts = extractScriptTagsFromHTML(sourceCode)
    const candidate = scripts.find(script => {
      const type = script.attribs?.type ? String(script.attribs.type).trim().toLowerCase() : ''
      return !type || type === 'module'
    }) || scripts[0]

    if (candidate) {
      scriptContent = candidate.content
      scriptStartLine = candidate.lineOffset
    }
  } else if (!sourceCode.includes('<template')) {
    scriptContent = sourceCode
  }

  if (!scriptContent && sourceCode.includes('<script')) {
    scriptStartLine = 0
  }

  const kind = options.kind || (sourceCode.includes('<template') ? 'component' : 'page')

  return {
    kind,
    sourceCode,
    filePath,
    scriptContent,
    styleContent: '',
    scriptStartLine,
    templateId: null,
    scriptStringPool: [],
    templateTokens: new Set(),
    templateSlots: [],
    templateRefs: new Map(),
    templateElements: [],
    diagnostics: [],
    definedAttributes: new Set(),
    attributeSchemas: new Map(),
    definedServerProps: new Set(),
    definedStateProps: new Set(),
    hasStateBlock: false,
    hasUnresolvableState: false,
    hasServerBlock: false,
    hasUnresolvableServer: false,
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
