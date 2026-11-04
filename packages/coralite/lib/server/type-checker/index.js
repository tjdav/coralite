import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { coraliteLanguagePlugin, extractScriptBlock } from './volar-plugin.js'
import { isNodeGlobal } from '../../utils/node-global-surface.js'

/**
 * @typedef {Object} Diagnostic
 * @property {string} file - Absolute path to .html file
 * @property {number} line - 1-based line in .html
 * @property {number} column - 1-based column in .html
 * @property {'error' | 'warning'} severity
 * @property {number} code - TS error code
 * @property {string} message - TS diagnostic message
 */

/**
 * @typedef {Object} TypeCheckResult
 * @property {Diagnostic[]} diagnostics
 * @property {boolean} skipped
 * @property {string} [reason]
 */

/**
 * Determines whether TypeScript in this program can actually resolve the
 * 'node' type package. Appending 'node' to compilerOptions.types without
 * visibility would introduce a new TS2688 diagnostic instead of curing TS2580.
 *
 * @param {object} compilerOptions - Parsed compiler options
 * @param {string} tsconfigDir - Directory of the active tsconfig (or cwd when none exists)
 * @param {ReturnType<typeof import('node:module').createRequire>} requireUser - Require bound to the user project
 * @returns {boolean} True when the 'node' types are visible to TypeScript
 */
function nodeTypesVisibleToProgram (compilerOptions, tsconfigDir, requireUser) {
  if (Array.isArray(compilerOptions.typeRoots) && compilerOptions.typeRoots.length > 0) {
    for (const typeRoot of compilerOptions.typeRoots) {
      if (fs.existsSync(path.join(path.resolve(tsconfigDir, typeRoot), 'node'))) {
        return true
      }
    }
    return false
  }

  try {
    requireUser.resolve('@types/node/package.json')
    return true
  } catch {
    return false
  }
}

/**
 * Collects the character ranges of client() function declarations in a
 * component or page module: named exports, const exports, function
 * declarations, and the client property of definePage/defineComponent calls.
 * Node-global tolerances must not apply inside these ranges — that is browser
 * code, and CORALITE-E304 owns the deterministic diagnostics for it.
 *
 * @param {object} sourceFile - Parsed source file AST of the virtual module
 * @param {object} ts - Loaded TypeScript compiler module
 * @returns {Array<{ start: number, end: number }>} Character ranges of client functions
 */
function collectClientRanges (sourceFile, ts) {
  const ranges = []

  const pushFunction = (fn) => {
    if (
      fn &&
      (fn.kind === ts.SyntaxKind.FunctionDeclaration ||
        fn.kind === ts.SyntaxKind.FunctionExpression ||
        fn.kind === ts.SyntaxKind.ArrowFunction)
    ) {
      ranges.push({
        start: fn.getStart(sourceFile),
        end: fn.end
      })
    }
  }

  const pushClientProp = (objExpr) => {
    if (!objExpr || objExpr.kind !== ts.SyntaxKind.ObjectLiteralExpression) {
      return
    }
    for (const prop of objExpr.properties) {
      if (
        prop.name &&
        (prop.name.kind === ts.SyntaxKind.Identifier || prop.name.kind === ts.SyntaxKind.StringLiteral) &&
        prop.name.text === 'client'
      ) {
        if (prop.kind === ts.SyntaxKind.MethodDeclaration) {
          ranges.push({
            start: prop.getStart(sourceFile),
            end: prop.end
          })
        } else {
          pushFunction(prop.initializer)
        }
      }
    }
  }

  const pushDefineCall = (callExpr) => {
    if (
      !callExpr ||
      callExpr.kind !== ts.SyntaxKind.CallExpression ||
      !callExpr.expression ||
      callExpr.expression.kind !== ts.SyntaxKind.Identifier ||
      (callExpr.expression.text !== 'definePage' && callExpr.expression.text !== 'defineComponent')
    ) {
      return
    }
    pushClientProp(callExpr.arguments[0])
  }

  for (const stmt of sourceFile.statements) {
    if (stmt.kind === ts.SyntaxKind.ExportDeclaration) {
      const decl = stmt.declaration
      if (decl) {
        if (decl.kind === ts.SyntaxKind.FunctionDeclaration && decl.name && decl.name.text === 'client') {
          pushFunction(decl)
        } else if (decl.kind === ts.SyntaxKind.VariableStatement) {
          for (const vDecl of decl.declarationList.declarations) {
            if (vDecl.name && vDecl.name.kind === ts.SyntaxKind.Identifier && vDecl.name.text === 'client') {
              pushFunction(vDecl.initializer)
            }
            pushDefineCall(vDecl.initializer)
          }
        }
        continue
      }
      if (stmt.isExportEquals || !stmt.exportClause || stmt.exportClause.kind !== ts.SyntaxKind.NamedExports) {
        continue
      }
      for (const name of stmt.exportClause.elements) {
        const localName = name.originalName || name.name
        if (localName && localName.text === 'client') {
          pushFunction(name.initializer)
        }
      }
    } else if (stmt.kind === ts.SyntaxKind.ExportAssignment) {
      pushDefineCall(stmt.expression)
    } else if (stmt.kind === ts.SyntaxKind.VariableStatement) {
      for (const decl of stmt.declarationList.declarations) {
        if (decl.name && decl.name.kind === ts.SyntaxKind.Identifier && decl.name.text === 'client') {
          pushFunction(decl.initializer)
        }
        pushDefineCall(decl.initializer)
      }
    } else if (stmt.kind === ts.SyntaxKind.FunctionDeclaration) {
      if (stmt.name && stmt.name.text === 'client') {
        pushFunction(stmt)
      }
    }
  }

  return ranges
}

/**
 * Type-checks .html component and page files using a Volar-bridged TypeScript compiler program.
 *
 * @param {string[]} files - Array of .html file paths to check
 * @param {Object} [options={}] - Options
 * @param {string} [options.tsconfig] - Path to tsconfig.json
 * @param {string} [options.cwd] - Working directory
 * @param {AbortSignal} [options.signal] - Abort signal
 * @returns {Promise<TypeCheckResult>}
 */
export async function typeCheck (files, options = {}) {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd()

  if (options.signal?.aborted) {
    const err = new Error('Type check aborted')
    err.name = 'AbortError'
    throw err
  }

  // Check if typescript is installed
  const requireUser = createRequire(path.join(cwd, 'package.json'))
  const requireSelf = createRequire(import.meta.url)

  let ts
  try {
    ts = requireUser('typescript')
  } catch {
    if (options.cwd) {
      return {
        diagnostics: [],
        skipped: true,
        reason: 'typescript not installed'
      }
    }
    try {
      ts = requireSelf('typescript')
    } catch {
      return {
        diagnostics: [],
        skipped: true,
        reason: 'typescript not installed'
      }
    }
  }

  if (!files || files.length === 0) {
    return {
      diagnostics: [],
      skipped: false
    }
  }

  // Resolve runTsc / proxyCreateProgram from @volar/typescript
  let volarTs
  try {
    volarTs = requireSelf('@volar/typescript')
  } catch {
    try {
      const coralitePkg = createRequire(new URL('../../../package.json', import.meta.url))
      volarTs = coralitePkg('@volar/typescript')
    } catch {
      try {
        volarTs = requireUser('@volar/typescript')
      } catch {
        return {
          diagnostics: [],
          skipped: true,
          reason: '@volar/typescript not installed'
        }
      }
    }
  }

  // Read tsconfig options if provided or default
  let compilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    noEmit: true,
    skipLibCheck: true,
    allowJs: true,
    checkJs: true
  }

  const tsconfigPath = options.tsconfig
    ? path.resolve(cwd, options.tsconfig)
    : ts.findConfigFile(cwd, ts.sys.fileExists, 'tsconfig.json')

  if (tsconfigPath && ts.sys.fileExists(tsconfigPath)) {
    const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile)
    if (!configFile.error && configFile.config) {
      const parsedConfig = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.dirname(tsconfigPath)
      )
      compilerOptions = {
        ...compilerOptions,
        ...parsedConfig.options,
        noEmit: true
      }
    }
  }

  const tsconfigDir = tsconfigPath && ts.sys.fileExists(tsconfigPath) ? path.dirname(tsconfigPath) : cwd

  if (Array.isArray(compilerOptions.types) && !compilerOptions.types.includes('node')) {
    if (nodeTypesVisibleToProgram(compilerOptions, tsconfigDir, requireUser)) {
      compilerOptions.types = [...compilerOptions.types, 'node']
    }
  }

  const absoluteFiles = files.map(file => path.resolve(cwd, file))
  const targetMap = new Map()
  const virtualRootNames = absoluteFiles.map(filePath => {
    const virtualName = filePath + '.ts'
    targetMap.set(virtualName, filePath)
    return virtualName
  })

  const ambientUrlFile = path.join(cwd, '__coralite_ambient_urls__.d.ts')
  const ambientUrlContent = [
    "declare module 'https://*' {",
    '  const content: any;',
    '  export default content;',
    '  export = content;',
    '}',
    "declare module 'http://*' {",
    '  const content: any;',
    '  export default content;',
    '  export = content;',
    '}'
  ].join('\n')

  // Create compiler host mapping virtual .html.ts files to source script blocks
  const host = ts.createCompilerHost(compilerOptions)
  const originalGetSourceFile = host.getSourceFile
  const originalFileExists = host.fileExists

  host.fileExists = (fileName) => {
    if (fileName === ambientUrlFile) {
      return true
    }
    if (targetMap.has(fileName)) {
      const realFilePath = targetMap.get(fileName)
      return originalFileExists(realFilePath)
    }
    return originalFileExists(fileName)
  }

  host.getSourceFile = (fileName, languageVersionOrOptions, onError, shouldCreateNewSourceFile) => {
    if (fileName === ambientUrlFile) {
      return ts.createSourceFile(fileName, ambientUrlContent, languageVersionOrOptions, true, ts.ScriptKind.TS)
    }
    if (targetMap.has(fileName)) {
      const realFilePath = targetMap.get(fileName)
      if (originalFileExists(realFilePath)) {
        const htmlContent = host.readFile(realFilePath)
        if (htmlContent !== undefined) {
          const scriptBlock = extractScriptBlock(htmlContent)
          if (scriptBlock) {
            const prefix = htmlContent.slice(0, scriptBlock.offset)
            const lineBreaks = prefix.split('\n')
            const lineCount = lineBreaks.length - 1
            const lastLineCols = lineBreaks[lineBreaks.length - 1].length
            const padding = '\n'.repeat(lineCount) + ' '.repeat(lastLineCols)
            const paddedCode = padding + scriptBlock.content

            return ts.createSourceFile(fileName, paddedCode, languageVersionOrOptions, true, ts.ScriptKind.TS)
          } else {
            return ts.createSourceFile(fileName, '', languageVersionOrOptions, true, ts.ScriptKind.TS)
          }
        }
      }
    }
    return originalGetSourceFile(fileName, languageVersionOrOptions, onError, shouldCreateNewSourceFile)
  }

  const createProgram = volarTs?.proxyCreateProgram
    ? volarTs.proxyCreateProgram(ts, ts.createProgram, () => [coraliteLanguagePlugin])
    : ts.createProgram

  const program = createProgram({
    rootNames: [...virtualRootNames, ambientUrlFile],
    options: compilerOptions,
    host
  })

  /** @type {Diagnostic[]} */
  const diagnostics = []

  for (const virtualFile of virtualRootNames) {
    if (options.signal?.aborted) {
      const err = new Error('Type check aborted')
      err.name = 'AbortError'
      throw err
    }

    const realFilePath = targetMap.get(virtualFile)
    const sourceFile = program.getSourceFile(virtualFile)
    if (!sourceFile) {
      continue
    }

    const syntaxDiagnostics = program.getSyntacticDiagnostics(sourceFile)
    const semanticDiagnostics = program.getSemanticDiagnostics(sourceFile)
    const allDiagnostics = [...syntaxDiagnostics, ...semanticDiagnostics]

    const clientRanges = collectClientRanges(sourceFile, ts)

    for (const diag of allDiagnostics) {
      if (!diag.file) {
        continue
      }

      const pos = sourceFile.getLineAndCharacterOfPosition(diag.start)
      const severity = diag.category === ts.DiagnosticCategory.Warning ? 'warning' : 'error'
      const message = typeof diag.messageText === 'string'
        ? diag.messageText
        : ts.flattenDiagnosticMessageText(diag.messageText, '\n')

      if (diag.code === 2307 && (message.includes("'http://") || message.includes("'https://"))) {
        continue
      }

      const nameMatch = /^Cannot find name '([^']+)'/u.exec(message)
      const isNodeGlobalName = nameMatch !== null && isNodeGlobal(nameMatch[1])
      const insideClientRange = diag.file === sourceFile && clientRanges.some(range => diag.start >= range.start && diag.start < range.end
      )

      if (isNodeGlobalName && (diag.code === 2304 || diag.code === 2580 || diag.code === 2591) && !insideClientRange) {
        continue
      }

      diagnostics.push({
        file: realFilePath,
        line: pos.line + 1,
        column: pos.character + 1,
        severity,
        code: diag.code,
        message
      })
    }
  }

  return {
    diagnostics,
    skipped: false
  }
}

export default typeCheck
