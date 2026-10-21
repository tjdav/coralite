import { createRequire } from 'node:module'
import path from 'node:path'
import { coraliteLanguagePlugin, extractScriptBlock } from './volar-plugin.js'

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

  const absoluteFiles = files.map(file => path.resolve(cwd, file))
  const targetMap = new Map()
  const virtualRootNames = absoluteFiles.map(filePath => {
    const virtualName = filePath + '.ts'
    targetMap.set(virtualName, filePath)
    return virtualName
  })

  // Create compiler host mapping virtual .html.ts files to source script blocks
  const host = ts.createCompilerHost(compilerOptions)
  const originalGetSourceFile = host.getSourceFile
  const originalFileExists = host.fileExists

  host.fileExists = (fileName) => {
    if (targetMap.has(fileName)) {
      const realFilePath = targetMap.get(fileName)
      return originalFileExists(realFilePath)
    }
    return originalFileExists(fileName)
  }

  host.getSourceFile = (fileName, languageVersionOrOptions, onError, shouldCreateNewSourceFile) => {
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
    rootNames: virtualRootNames,
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

    for (const diag of allDiagnostics) {
      if (!diag.file) {
        continue
      }

      const pos = sourceFile.getLineAndCharacterOfPosition(diag.start)
      const severity = diag.category === ts.DiagnosticCategory.Warning ? 'warning' : 'error'
      const message = typeof diag.messageText === 'string'
        ? diag.messageText
        : ts.flattenDiagnosticMessageText(diag.messageText, '\n')

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
