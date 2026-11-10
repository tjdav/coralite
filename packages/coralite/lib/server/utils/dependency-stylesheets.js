import { build, transform } from 'esbuild'
import postcss from 'postcss'
import { existsSync } from 'node:fs'
import { basename, extname } from 'node:path'
import { CoraliteError } from '../../shared/errors.js'
import {
  declarationSignature,
  extractAndTransformCssImports,
  isRemoteStylesheetUrl,
  sanitizeStylesheetStem
} from '../../shared/stylesheets.js'
import { hash } from './manifest.js'
import { resolveFileSpecifier } from './package.js'
import { getAST } from './server.js'

const ASSET_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
  'webp',
  'avif',
  'ico',
  'bmp',
  'woff',
  'woff2',
  'ttf',
  'otf',
  'eot',
  'mp4',
  'webm',
  'mp3',
  'wav',
  'ogg',
  'pdf'
]

/** @type {Record<string, import('esbuild').Loader>} */
const ASSET_LOADERS = Object.fromEntries(ASSET_EXTENSIONS.map(ext => [`.${ext}`, 'file']))

/**
 * Computes a deterministic manifest handle for a dependency stylesheet declaration.
 *
 * @param {Object} declaration - Stylesheet declaration object.
 * @returns {string} Deterministic stylesheet handle.
 */
export function createStylesheetHandle (declaration) {
  let targetKey = declaration.from

  if (declaration.filePath && !isRemoteStylesheetUrl(declaration.from)) {
    try {
      targetKey = resolveFileSpecifier(declaration.from, declaration.filePath)
    } catch {
      targetKey = `${declaration.filePath}\u0000${declaration.from}`
    }
  }

  const stem = sanitizeStylesheetStem(basename(declaration.from))
  const sig = `${targetKey}\u0000${declarationSignature(declaration)}`
  return `${stem}-${hash(sig).slice(0, 6)}`
}

const MAX_STYLESHEET_CACHE_ENTRIES = 2000

/**
 * Results of the last `extractScriptStylesheets()` pass, keyed by source code.
 *
 * The same component/page script is extracted several times during a build
 * (component definition, base registration, script-manager virtual modules,
 * page collection, renderer serialization). Acorn parsing dominates that work,
 * so the deterministic result is reused instead of re-parsed.
 *
 * @type {Map<string, Map<string, { code: string, declarations: Array<Object> }>>}
 */
const stylesheetExtractionCache = new Map()

/**
 * Clears cached stylesheet extraction results.
 *
 * Called by the dev rebuild/reset path so edited scripts are re-analyzed.
 */
export function clearScriptStylesheetCache () {
  stylesheetExtractionCache.clear()
}

/**
 * Extracts and transforms CSS `import()` calls in a script or `client()` snippet,
 * assigning deterministic handles resolved relative to `filePath`.
 *
 * Returned objects are shared and must be treated as read-only.
 *
 * @param {string} code - Script or function source code.
 * @param {Object} [options={}] - Extraction options.
 * @param {string} [options.filePath] - Declaring component or page file path.
 * @param {boolean} [options.allowAllFunctions=false] - Whether `code` is an isolated `client()` function.
 * @returns {{ code: string, declarations: Array<Object> }} Transformed code and extracted stylesheet declarations.
 */
export function extractScriptStylesheets (code, options = {}) {
  if (!code || typeof code !== 'string' || !code.includes('import')) {
    return {
      code: code || '',
      declarations: []
    }
  }

  const filePath = options.filePath || ''
  const allowAllFunctions = Boolean(options.allowAllFunctions)
  const variantKey = `${allowAllFunctions ? '1' : '0'}\u0000${filePath}`
  let variants = stylesheetExtractionCache.get(code)

  if (!variants) {
    variants = new Map()
    stylesheetExtractionCache.set(code, variants)
  }

  const cached = variants.get(variantKey)
  if (cached) {
    return cached
  }

  let ast = null
  if (!allowAllFunctions) {
    // Full component/page scripts are parsed again by findAndExtractScript()
    // and the validators through getAST(). Reuse that AST instead of parsing
    // the same source a second time with Acorn.
    try {
      ast = getAST(code, true)
    } catch {
      ast = null
    }
  }

  const result = extractAndTransformCssImports(code, {
    ...options,
    ...(ast ? { ast } : {}),
    resolveHandle: createStylesheetHandle
  })

  variants.set(variantKey, result)

  if (stylesheetExtractionCache.size > MAX_STYLESHEET_CACHE_ENTRIES) {
    const oldestKey = stylesheetExtractionCache.keys().next().value
    if (oldestKey !== undefined) {
      stylesheetExtractionCache.delete(oldestKey)
    }
  }

  return result
}

/**
 * Creates a deterministic one-shot esbuild build for dependency stylesheets.
 *
 * @param {Object} options - Build options.
 * @param {Record<string, string>} options.entryPoints - Entry name to absolute CSS path.
 * @param {boolean} options.minify - Whether to minify the final CSS.
 * @param {boolean} options.sourcemap - Whether to include an inline source map in development.
 * @returns {Promise<import('esbuild').BuildResult>} The esbuild build result.
 */
function runEsbuildBuild ({ entryPoints, minify, sourcemap }) {
  return build({
    entryPoints,
    bundle: true,
    write: false,
    outdir: 'assets/css',
    entryNames: '[name]',
    assetNames: '[name]-[hash]',
    metafile: true,
    logLevel: 'silent',
    minify,
    sourcemap: sourcemap ? 'inline' : false,
    loader: ASSET_LOADERS,
    plugins: [
      {
        name: 'coralite-root-relative-stylesheet-urls',
        setup (pluginBuild) {
          pluginBuild.onResolve({ filter: /^\// }, (args) => {
            if (args.kind === 'entry-point') {
              return null
            }
            return {
              path: args.path,
              external: true
            }
          })
        }
      }
    ]
  })
}

/**
 * Resolves and validates a declared dependency stylesheet file.
 *
 * @param {Object} declaration - Normalized stylesheet declaration.
 * @returns {string} Absolute path to the CSS file.
 */
function resolveStylesheetPath (declaration) {
  let resolvedPath

  try {
    resolvedPath = resolveFileSpecifier(declaration.from, declaration.filePath)
  } catch (error) {
    throw new CoraliteError(`Could not resolve stylesheet "${declaration.from}" in "${declaration.filePath}": ${error.message}`, {
      code: 'CORALITE-E403',
      filePath: declaration.filePath,
      cause: error
    })
  }

  if (!existsSync(resolvedPath)) {
    throw new CoraliteError(`Stylesheet "${declaration.from}" resolved to a missing file: ${resolvedPath}`, {
      code: 'CORALITE-E403',
      filePath: declaration.filePath
    })
  }

  if (extname(resolvedPath).toLowerCase() !== '.css') {
    throw new CoraliteError(`Stylesheet "${declaration.from}" must resolve to a .css file. Received: ${resolvedPath}`, {
      code: 'CORALITE-E403',
      filePath: declaration.filePath
    })
  }

  return resolvedPath
}

/**
 * Processes a bundled stylesheet through user PostCSS plugins and optionally minifies it.
 *
 * @param {string} css - Bundled CSS text.
 * @param {string} from - Original dependency CSS path.
 * @param {Object} options - Processing options.
 * @param {Array} [options.postcssPlugins] - User PostCSS plugins.
 * @param {boolean} options.minify - Whether to minify the result.
 * @returns {Promise<string>} Processed CSS.
 */
async function processCss (css, from, options) {
  let output = css

  if (options.postcssPlugins && options.postcssPlugins.length > 0) {
    const result = await postcss(options.postcssPlugins).process(output, {
      from,
      map: false
    })
    output = result.css
  }

  if (options.minify) {
    const result = await transform(output, {
      loader: 'css',
      minify: true
    })
    output = result.code
  }

  return output
}

/**
 * Builds declared dependency stylesheets into hashed CSS assets.
 *
 * @param {Array<Object>} declarations - Normalized stylesheet declarations.
 * @param {Object} [options={}] - Build options.
 * @param {'production' | 'development' | 'testing' | string} [options.mode='production'] - Build mode.
 * @param {Array} [options.postcssPlugins=[]] - User PostCSS plugins.
 * @returns {Promise<{ outputFiles: Object, manifest: Object }>} Emitted files and stylesheet manifest.
 */
export async function buildDependencyStylesheets (declarations, options = {}) {
  const mode = options.mode || 'production'
  const postcssPlugins = options.postcssPlugins || []
  const manifest = {}
  const outputFiles = {}

  if (!declarations || declarations.length === 0) {
    return {
      outputFiles,
      manifest
    }
  }

  const entries = new Map()
  const handleDeclarations = new Map()
  const usedEntryNames = new Map()
  const declarationOrder = new Map()

  for (let i = 0; i < declarations.length; i++) {
    const declaration = declarations[i]
    const resolvedPath = resolveStylesheetPath(declaration)
    const handle = declaration.handle || createStylesheetHandle(declaration)

    if (!declarationOrder.has(handle)) {
      declarationOrder.set(handle, i)
      handleDeclarations.set(handle, declaration)
    }

    let entry = entries.get(resolvedPath)

    if (!entry) {
      const baseStem = sanitizeStylesheetStem(basename(resolvedPath, extname(resolvedPath)))
      let entryName = baseStem
      const existingNamePath = usedEntryNames.get(entryName)

      if (existingNamePath && existingNamePath !== resolvedPath) {
        entryName = `${entryName}-${hash(resolvedPath).slice(0, 6)}`
      }

      usedEntryNames.set(entryName, resolvedPath)
      entry = {
        entryName,
        resolvedPath,
        handles: new Set()
      }
      entries.set(resolvedPath, entry)
    }

    entry.handles.add(handle)
  }

  /** @type {Record<string, string>} */
  const entryPoints = {}

  for (const entry of entries.values()) {
    entryPoints[entry.entryName] = entry.resolvedPath
  }

  let result

  try {
    result = await runEsbuildBuild({
      entryPoints,
      minify: false,
      sourcemap: mode === 'development'
    })
  } catch (error) {
    const firstError = error.errors && error.errors[0]
    const detail = firstError ? firstError.text : error.message
    const location = firstError && firstError.location
    throw new CoraliteError(`Failed to build dependency stylesheets: ${detail}`, {
      code: 'CORALITE-E403',
      filePath: location ? location.file : undefined,
      cause: error
    })
  }

  const cssOutputByEntryName = new Map()

  for (const file of result.outputFiles) {
    const filename = basename(file.path)

    if (filename.endsWith('.css')) {
      const entryName = filename.slice(0, -4)
      const entry = Array.from(entries.values()).find(value => value.entryName === entryName)

      if (!entry) {
        continue
      }

      let css = file.text

      try {
        css = await processCss(css, entry.resolvedPath, {
          postcssPlugins,
          minify: mode === 'production'
        })
      } catch (error) {
        throw new CoraliteError(`Failed to process dependency stylesheet "${entryName}": ${error.message}`, {
          code: 'CORALITE-E403',
          filePath: entry.resolvedPath,
          cause: error
        })
      }

      const finalName = `${entryName}-${hash(css).slice(0, 8)}.css`
      cssOutputByEntryName.set(entryName, finalName)

      const relativePath = `assets/css/${finalName}`
      outputFiles[relativePath] = {
        path: relativePath,
        hashedPath: finalName,
        outputDir: 'assets/css',
        text: css
      }
      continue
    }

    const relativePath = `assets/css/${filename}`
    outputFiles[relativePath] = {
      path: relativePath,
      hashedPath: filename,
      outputDir: 'assets/css',
      contents: file.contents,
      text: file.text
    }
  }

  for (const entry of entries.values()) {
    const finalName = cssOutputByEntryName.get(entry.entryName)
    if (!finalName) {
      continue
    }

    for (const handle of entry.handles) {
      const declaration = handleDeclarations.get(handle)
      manifest[handle] = {
        href: `assets/css/${finalName}`,
        order: declarationOrder.get(handle),
        media: declaration.media,
        nonce: declaration.nonce,
        crossorigin: declaration.crossorigin,
        referrerPolicy: declaration.referrerPolicy
      }

      for (const key of Object.keys(manifest[handle])) {
        if (manifest[handle][key] === undefined) {
          delete manifest[handle][key]
        }
      }
    }
  }

  return {
    outputFiles,
    manifest
  }
}

export default buildDependencyStylesheets
