import { parse as parseJS } from 'acorn'
import { ancestor as walkAncestorJS } from 'acorn-walk'
import { CoraliteError } from './errors.js'

const CSS_SPECIFIER_REGEX = /\.css(?:[?#].*)?$/i
const REMOTE_SPECIFIER_REGEX = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i

const ALLOWED_TOP_LEVEL_OPTION_KEYS = new Set([
  'media',
  'nonce',
  'crossorigin',
  'referrerPolicy',
  'referrerpolicy',
  'signal',
  'force',
  'with'
])

const ALLOWED_WITH_OPTION_KEYS = new Set([
  'type',
  'media',
  'nonce',
  'crossorigin',
  'referrerPolicy',
  'referrerpolicy'
])

const STRING_OPTION_KEYS = new Set([
  'media',
  'nonce',
  'referrerPolicy',
  'referrerpolicy'
])

const FORBIDDEN_BLOCK_NAMES = new Set([
  'server',
  'paths',
  'getters',
  'style',
  'slots',
  'onError',
  'provide',
  'consume',
  'attributes',
  'formControl',
  'formAssociated',
  'listStrategy',
  'reconcile'
])

/**
 * Checks whether a module specifier string targets a CSS file.
 *
 * @param {any} specifier - Module specifier to check.
 * @returns {boolean} True when the specifier ends with `.css`.
 */
export function isCssSpecifier (specifier) {
  return typeof specifier === 'string' && CSS_SPECIFIER_REGEX.test(specifier.trim())
}

/**
 * Checks whether a stylesheet specifier is a remote URL (`http:`, `https:`, `//`).
 *
 * @param {any} specifier - Stylesheet specifier string.
 * @returns {boolean} True when the specifier is a remote URL.
 */
export function isRemoteStylesheetUrl (specifier) {
  return typeof specifier === 'string' && REMOTE_SPECIFIER_REGEX.test(specifier.trim())
}

/**
 * Builds the serialized option signature for a stylesheet declaration.
 *
 * @param {Object} declaration - Stylesheet declaration object.
 * @returns {string} Serialized option signature.
 */
export function declarationSignature (declaration) {
  return JSON.stringify({
    media: declaration.media,
    nonce: declaration.nonce,
    crossorigin: declaration.crossorigin,
    referrerPolicy: declaration.referrerPolicy
  })
}

/**
 * Sanitizes a raw name or handle for use as an emitted CSS filename stem.
 *
 * @param {string} value - Raw stylesheet stem or handle.
 * @returns {string} Safe filename stem.
 */
export function sanitizeStylesheetStem (value) {
  return String(value || '')
    .replace(/\.css(?:[?#].*)?$/i, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'stylesheet'
}

/**
 * Extracts a property key name from an Acorn Property or ImportAttribute node.
 *
 * @param {any} propNode - AST property node.
 * @returns {string|null} Property key name if static, or null.
 */
function getStaticKeyName (propNode) {
  if (!propNode || propNode.computed) {
    return null
  }
  if (propNode.key && propNode.key.type === 'Identifier') {
    return propNode.key.name
  }
  if (propNode.key && propNode.key.type === 'Literal') {
    return String(propNode.key.value)
  }
  return null
}

/**
 * Checks whether an ImportDeclaration has `with { type: 'css' }`.
 *
 * @param {any} importDeclNode - Acorn ImportDeclaration node.
 * @returns {boolean} True when `type: 'css'` attribute is present.
 */
function hasStaticCssImportAttribute (importDeclNode) {
  const attrs = importDeclNode.attributes || importDeclNode.assertions || []
  for (const attr of attrs) {
    const key = getStaticKeyName(attr)
    if (key === 'type' && attr.value && attr.value.type === 'Literal' && attr.value.value === 'css') {
      return true
    }
  }
  return false
}

/**
 * Checks whether an ImportExpression options node has `with: { type: 'css' }`.
 *
 * @param {any} optionsNode - Second argument AST node of `import(source, options)`.
 * @returns {boolean} True when `with: { type: 'css' }` is present.
 */
function hasCssTypeInOptionsNode (optionsNode) {
  if (!optionsNode || optionsNode.type !== 'ObjectExpression') {
    return false
  }
  for (const prop of optionsNode.properties || []) {
    if (prop.type !== 'Property') {
      continue
    }
    const key = getStaticKeyName(prop)
    if (key === 'with' && prop.value && prop.value.type === 'ObjectExpression') {
      for (const withProp of prop.value.properties || []) {
        if (withProp.type !== 'Property') {
          continue
        }
        const withKey = getStaticKeyName(withProp)
        if (withKey === 'type' && withProp.value && withProp.value.type === 'Literal' && withProp.value.value === 'css') {
          return true
        }
      }
    }
  }
  return false
}

/**
 * Validates a single static option property node on a CSS `import()` call.
 *
 * @param {string} key - Option property key.
 * @param {any} valueNode - AST node for the option value.
 * @param {string} label - Specifier label for error diagnostics.
 * @param {string | undefined} filePath - Declaring file path.
 * @param {Object} extracted - Target object accumulating static string options.
 * @returns {void}
 */
function validateStaticOptionValue (key, valueNode, label, filePath, extracted) {
  if (!valueNode) {
    return
  }

  const isStaticNonString = (
    (valueNode.type === 'Literal' && typeof valueNode.value !== 'string') ||
    valueNode.type === 'ArrayExpression' ||
    valueNode.type === 'ObjectExpression' ||
    valueNode.type === 'ArrowFunctionExpression' ||
    valueNode.type === 'FunctionExpression'
  )

  if (STRING_OPTION_KEYS.has(key)) {
    if (isStaticNonString) {
      const displayKey = key === 'referrerpolicy' ? 'referrerPolicy' : key
      throw new CoraliteError(`CSS import "${label}" option "${displayKey}" must be a string.`, {
        code: 'CORALITE-E109',
        filePath
      })
    }
    if (valueNode.type === 'Literal' && typeof valueNode.value === 'string') {
      const normalizedKey = key === 'referrerpolicy' ? 'referrerPolicy' : key
      extracted[normalizedKey] = valueNode.value
    }
    return
  }

  if (key === 'crossorigin') {
    if (isStaticNonString || (valueNode.type === 'Literal' && valueNode.value !== 'anonymous' && valueNode.value !== 'use-credentials')) {
      throw new CoraliteError(`CSS import "${label}" option "crossorigin" must be 'anonymous' or 'use-credentials'.`, {
        code: 'CORALITE-E109',
        filePath
      })
    }
    if (valueNode.type === 'Literal' && typeof valueNode.value === 'string') {
      extracted.crossorigin = valueNode.value
    }
    return
  }

  if (key === 'force') {
    if (valueNode.type === 'Literal' && typeof valueNode.value !== 'boolean') {
      throw new CoraliteError(`CSS import "${label}" option "force" must be a boolean.`, {
        code: 'CORALITE-E109',
        filePath
      })
    }
  }
}

/**
 * Validates the second argument (`options`) of a CSS `import(specifier, options)` call
 * and extracts any static string link attributes (`media`, `nonce`, `crossorigin`, `referrerPolicy`).
 *
 * @param {any} optionsNode - AST node for the second argument of `import()`.
 * @param {string} label - Specifier label for error messages.
 * @param {string} [filePath] - Declaring file path.
 * @returns {{ media?: string, nonce?: string, crossorigin?: string, referrerPolicy?: string }} Extracted static options.
 */
function validateAndExtractOptions (optionsNode, label, filePath) {
  const extracted = {}

  if (!optionsNode) {
    return extracted
  }

  if (
    optionsNode.type === 'Literal' ||
    optionsNode.type === 'ArrayExpression' ||
    optionsNode.type === 'ArrowFunctionExpression' ||
    optionsNode.type === 'FunctionExpression'
  ) {
    throw new CoraliteError(`CSS import "${label}" options must be an object.`, {
      code: 'CORALITE-E109',
      filePath
    })
  }

  if (optionsNode.type !== 'ObjectExpression') {
    return extracted
  }

  for (const prop of optionsNode.properties || []) {
    if (prop.type !== 'Property') {
      continue
    }
    const key = getStaticKeyName(prop)
    if (!key) {
      continue
    }

    if (!ALLOWED_TOP_LEVEL_OPTION_KEYS.has(key)) {
      throw new CoraliteError(`CSS import "${label}" contains unknown option "${key}". Valid options are: media, nonce, crossorigin, referrerPolicy, signal, force, with.`, {
        code: 'CORALITE-E109',
        filePath
      })
    }

    if (key === 'with') {
      if (
        prop.value &&
        (prop.value.type === 'Literal' || prop.value.type === 'ArrayExpression')
      ) {
        throw new CoraliteError(`CSS import "${label}" option "with" must be an object.`, {
          code: 'CORALITE-E109',
          filePath
        })
      }

      if (prop.value && prop.value.type === 'ObjectExpression') {
        for (const withProp of prop.value.properties || []) {
          if (withProp.type !== 'Property') {
            continue
          }
          const withKey = getStaticKeyName(withProp)
          if (!withKey) {
            continue
          }

          if (!ALLOWED_WITH_OPTION_KEYS.has(withKey)) {
            throw new CoraliteError(`CSS import "${label}" "with" attribute contains unknown option "${withKey}". Valid options are: type, media, nonce, crossorigin, referrerPolicy.`, {
              code: 'CORALITE-E109',
              filePath
            })
          }

          if (withKey === 'type') {
            if (withProp.value && withProp.value.type === 'Literal' && withProp.value.value !== 'css') {
              throw new CoraliteError(`CSS import "${label}" "with.type" must be 'css'.`, {
                code: 'CORALITE-E109',
                filePath
              })
            }
          } else {
            validateStaticOptionValue(withKey, withProp.value, label, filePath, extracted)
          }
        }
      }
      continue
    }

    validateStaticOptionValue(key, prop.value, label, filePath, extracted)
  }

  return extracted
}

/**
 * Parses a JS module or function snippet with Acorn, falling back to expression/object wrappers
 * for object method shorthands such as `async client () {}`.
 *
 * @param {string} code - JS source code.
 * @returns {{ ast: any, offset: number } | null} Parsed AST and character offset, or null on syntax failure.
 */
function parseSnippet (code) {
  try {
    const ast = parseJS(code, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true
    })
    return {
      ast,
      offset: 0
    }
  } catch {
    try {
      const ast = parseJS(`(${code})`, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        locations: true
      })
      return {
        ast,
        offset: 1
      }
    } catch {
      try {
        const ast = parseJS(`({${code}})`, {
          ecmaVersion: 'latest',
          sourceType: 'module',
          locations: true
        })
        return {
          ast,
          offset: 2
        }
      } catch {
        return null
      }
    }
  }
}

/**
 * Determines the enclosing Coralite lifecycle/config block name for an AST node.
 *
 * @param {Array<any>} ancestors - Acorn ancestor chain.
 * @returns {string|null} Block name (e.g. 'client', 'server', 'getters', 'top-level').
 */
function findEnclosingBlockName (ancestors) {
  let insideAnyFunction = false

  for (let i = ancestors.length - 1; i >= 0; i--) {
    const anc = ancestors[i]

    if (
      anc.type === 'FunctionDeclaration' ||
      anc.type === 'FunctionExpression' ||
      anc.type === 'ArrowFunctionExpression'
    ) {
      insideAnyFunction = true
    }

    if (anc.type === 'Property') {
      const propName = getStaticKeyName(anc)
      if (propName && (propName === 'client' || FORBIDDEN_BLOCK_NAMES.has(propName))) {
        return propName
      }
    }

    if (anc.type === 'ExportNamedDeclaration' && anc.declaration) {
      const decl = anc.declaration
      if (decl.type === 'FunctionDeclaration' && decl.id && decl.id.name) {
        const fnName = decl.id.name
        if (fnName === 'client' || FORBIDDEN_BLOCK_NAMES.has(fnName)) {
          return fnName
        }
      }
      if (decl.type === 'VariableDeclaration') {
        for (const varDecl of decl.declarations || []) {
          if (varDecl.id && varDecl.id.type === 'Identifier') {
            const varName = varDecl.id.name
            if (varName === 'client' || FORBIDDEN_BLOCK_NAMES.has(varName)) {
              return varName
            }
          }
        }
      }
    }
  }

  return insideAnyFunction ? 'helper' : 'top-level'
}

/**
 * Extracts and validates CSS `import()` declarations from a script or `client()` snippet,
 * and rewrites them into `window.__coralite__.importCSS(...)` calls.
 *
 * @param {string} code - Script or function source code.
 * @param {Object} [options={}] - Extraction options.
 * @param {string} [options.filePath] - Declaring component or page file path.
 * @param {(declaration: Object) => string} [options.resolveHandle] - Callback returning a deterministic manifest handle.
 * @param {boolean} [options.allowAllFunctions=false] - Whether `code` is already an isolated `client()` function.
 * @returns {{ code: string, declarations: Array<Object> }} Transformed code and extracted stylesheet declarations.
 */
export function extractAndTransformCssImports (code, options = {}) {
  const {
    filePath,
    resolveHandle,
    allowAllFunctions = false
  } = options

  if (!code || typeof code !== 'string' || !code.includes('import')) {
    return {
      code: code || '',
      declarations: []
    }
  }

  const parsed = parseSnippet(code)
  if (!parsed) {
    return {
      code,
      declarations: []
    }
  }

  const { ast, offset } = parsed
  const declarations = []
  const replacements = []

  if (offset === 0 && ast && Array.isArray(ast.body)) {
    for (const node of ast.body) {
      if (node.type === 'ImportDeclaration') {
        const spec = node.source && typeof node.source.value === 'string' ? node.source.value : ''
        if (isCssSpecifier(spec) || hasStaticCssImportAttribute(node)) {
          throw new CoraliteError(`Top-level CSS import "${spec}" is not supported. Use dynamic "await import('${spec}')" inside client() to lazily load stylesheets.`, {
            code: 'CORALITE-E109',
            filePath
          })
        }
      }
    }
  }

  walkAncestorJS(ast, {
    ImportExpression (node, ancestors) {
      /** @type {any} */
      const sourceNode = node.source
      const isLiteralSource = sourceNode && sourceNode.type === 'Literal'
      const literalValue = isLiteralSource ? sourceNode.value : undefined
      const hasCssWith = hasCssTypeInOptionsNode(node.options)
      const isCss = (typeof literalValue === 'string' && isCssSpecifier(literalValue)) || hasCssWith

      if (!isCss) {
        return
      }

      if (!allowAllFunctions) {
        const blockName = findEnclosingBlockName(ancestors)
        if (blockName === 'top-level' || FORBIDDEN_BLOCK_NAMES.has(blockName)) {
          const specLabel = typeof literalValue === 'string' ? literalValue : '<dynamic>'
          throw new CoraliteError(`CSS import "${specLabel}" is only supported inside "client()". Found in "${blockName}".`, {
            code: 'CORALITE-E109',
            filePath
          })
        }
      }

      if (isLiteralSource && (typeof literalValue !== 'string' || literalValue.trim() === '')) {
        throw new CoraliteError('CSS import must specify a non-empty string specifier.', {
          code: 'CORALITE-E109',
          filePath
        })
      }

      const label = typeof literalValue === 'string' ? literalValue : '<dynamic>'
      const staticOptions = validateAndExtractOptions(node.options, label, filePath)

      const optionsText = node.options
        ? `, ${code.slice(node.options.start - offset, node.options.end - offset)}`
        : ''

      if (typeof literalValue === 'string' && !isRemoteStylesheetUrl(literalValue)) {
        const declaration = {
          handle: '',
          from: literalValue,
          media: staticOptions.media,
          nonce: staticOptions.nonce,
          crossorigin: staticOptions.crossorigin,
          referrerPolicy: staticOptions.referrerPolicy,
          filePath
        }

        const handle = typeof resolveHandle === 'function'
          ? resolveHandle(declaration)
          : sanitizeStylesheetStem(literalValue)

        declaration.handle = handle
        declarations.push(declaration)

        replacements.push({
          start: node.start - offset,
          end: node.end - offset,
          replacement: `window.__coralite__.importCSS(${JSON.stringify(handle)}${optionsText})`
        })
      } else {
        const sourceText = code.slice(node.source.start - offset, node.source.end - offset)
        replacements.push({
          start: node.start - offset,
          end: node.end - offset,
          replacement: `window.__coralite__.importCSS(${sourceText}${optionsText})`
        })
      }
    }
  })

  if (replacements.length === 0) {
    return {
      code,
      declarations
    }
  }

  replacements.sort((a, b) => b.start - a.start)
  let transformed = code
  for (const r of replacements) {
    transformed = transformed.slice(0, r.start) + r.replacement + transformed.slice(r.end)
  }

  return {
    code: transformed,
    declarations
  }
}

export default {}
