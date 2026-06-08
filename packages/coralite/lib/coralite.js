import { getHtmlFile, getHtmlFiles, discoverHtmlFiles } from './utils/server/html.js'
import { parseHTML, parseModule } from './utils/server/parse.js'
import { ScriptManager } from './script-manager.js'
import { metadataPlugin, staticAssetPlugin, testingPlugin } from '#plugins'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, normalize, relative } from 'node:path'
import { handleError } from './utils/errors.js'
import { createExecutionError } from './utils/server/errors.js'
import { transformNode } from './parser.js'
import { evaluate } from './compiler.js'
import {
  triggerPluginAggregateHook,
  triggerPluginHook,
  bindPlugins
} from './hooks.js'
import CoraliteCollection from './collection.js'

// Refactored helper imports
import { createComponentDefinition } from './component-setup.js'
import { setupPlugins } from './plugin-setup.js'
import { createPageHandlers } from './collection-handlers.js'
import { createRenderer } from './renderer.js'
import { initHasher } from './utils/server/manifest.js'

/**
 * @import {
 *  CoraliteConfig,
 *  CoraliteInstance,
 *  CoraliteBuildOptions,
 *  CoraliteSaveResult
 * } from '../types/index.js'
 */

/**
 * Factory function to create and initialize a Coralite instance.
 *
 * @param {CoraliteConfig} options - The configuration options for the Coralite instance.
 * @returns {Promise<CoraliteInstance>} A fully initialized Coralite instance.
 */
export async function createCoralite ({
  components,
  pages,
  plugins: userPlugins,
  assets,
  externalStyles,
  baseURL = '/',
  projectRoot = process.cwd(),
  ignoreByAttribute,
  skipRenderByAttribute,
  onError,
  mode = 'production',
  output
}) {
  // Validate required parameters
  if (!components || typeof components !== 'string') {
    handleError({
      onErrorCallback: onError,
      data: {
        level: 'ERR',
        message: 'createCoralite requires "components" option to be defined as a string'
      }
    })
  }

  if (!pages || typeof pages !== 'string') {
    handleError({
      onErrorCallback: onError,
      data: {
        level: 'ERR',
        message: 'createCoralite requires "pages" option to be defined as a string'
      }
    })
  }

  const path = {
    components: normalize(components),
    pages: normalize(pages)
  }

  const normalizedOptions = {
    components,
    pages,
    plugins: [...(userPlugins || [])],
    assets,
    externalStyles,
    baseURL,
    projectRoot: normalize(projectRoot),
    ignoreByAttribute,
    skipRenderByAttribute,
    mode,
    path,
    output: output ? normalize(output) : undefined
  }

  /** @type {CoraliteInstance} */
  // @ts-ignore
  const app = {
    options: normalizedOptions,
    pages: null,
    components: null,
    build: null,
    save: null,
    transform: transformNode,
    addRenderQueue: null,
    getPagePathsUsingCustomElement: null,
    createComponentElement: null,
    _dependencyGraph: {
      pageCustomElements: {},
      childCustomElements: {}
    },
    _clearDependencies: () => {
      app._dependencyGraph.pageCustomElements = {}
      app._dependencyGraph.childCustomElements = {}
    }
  }

  // State
  const plugins = {
    components: [],
    hooks: {
      onPageSet: [],
      onPageUpdate: [],
      onPageDelete: [],
      onComponentSet: [],
      onComponentUpdate: [],
      onComponentDelete: [],
      onBeforePageRender: [],
      onAfterPageRender: [],
      onBeforeComponentRender: [],
      onAfterComponentRender: [],
      onBeforeBuild: [],
      onAfterBuild: []
    }
  }
  const scriptManager = new ScriptManager(normalizedOptions)
  // @ts-ignore
  const serverGlobalContext = { app }

  const _handleErrorLocal = (data) => handleError({
    onErrorCallback: onError,
    data
  })

  const source = {
    utils: {
      parseHTML: (string, ignore = normalizedOptions.ignoreByAttribute, skip = normalizedOptions.skipRenderByAttribute) => parseHTML(string, ignore, skip, _handleErrorLocal),
      parseModule: (string, opts) => parseModule(string, {
        ignoreByAttribute: normalizedOptions.ignoreByAttribute,
        skipRenderByAttribute: normalizedOptions.skipRenderByAttribute,
        onError: _handleErrorLocal,
        ...opts
      }),
      getHtmlFiles,
      getHtmlFile
    },
    plugins: {}
  }

  // @ts-ignore
  app.source = source

  // Helper to register a component via its ID
  const getComponent = (id) => app.components.getItem(id)

  const _triggerPluginHookLocal = (name, initialData) => triggerPluginHook({
    app,
    hooks: plugins.hooks,
    serverGlobalContext,
    name,
    initialData
  })

  const _triggerPluginAggregateHookLocal = (name, contextData) => triggerPluginAggregateHook({
    app,
    hooks: plugins.hooks,
    serverGlobalContext,
    name,
    contextData
  })

  const _bindPluginsLocal = (phase2Functions, instanceContext) => bindPlugins({
    serverGlobalContext,
    phase2Functions,
    instanceContext
  })

  const _defineComponent = createComponentDefinition({ app })

  const _evaluateLocal = (options) => evaluate({
    ...options,
    app,
    source,
    bindPlugins: _bindPluginsLocal,
    defineComponent: _defineComponent,
    createExecutionError,
    getComponent
  })

  // Instantiate the isolated rendering engine
  const renderer = createRenderer({
    app,
    scriptManager,
    source,
    evaluate: _evaluateLocal,
    handleError: _handleErrorLocal,
    hooks: {
      trigger: _triggerPluginHookLocal,
      triggerAggregate: _triggerPluginAggregateHookLocal,
      bind: _bindPluginsLocal
    },
    options: normalizedOptions,
    createExecutionError
  })

  // --- Public API Population ---

  Object.assign(app, {
    outputFiles: renderer.outputFiles,
    createComponentElement: renderer.createComponentElement,
    build: renderer.build,
    /**
     * Executes a full build and saves the generated pages to the configured output directory.
     *
     * @param {string | string[]} [savePath] - The target path or directory to build.
     * @param {CoraliteBuildOptions} [saveOptions={}] - Additional configuration for the save process.
     * @returns {Promise<CoraliteSaveResult[]>} A promise resolving to an array of all saved file results.
     */
    save: async (savePath, saveOptions = {}) => {
      const signal = saveOptions?.signal
      const createdDir = {}
      if (!app.options.output) {
        handleError({
          onErrorCallback: onError,
          data: {
            level: 'ERR',
            message: 'Coralite instance must be configured with an "output" option to use save()'
          }
        })
      }
      const outputDir = app.options.output
      const results = []
      await app.build(savePath, saveOptions, async (result) => {
        // @ts-ignore
        const relativeDir = relative(app.options.path.pages, result.path.dirname)
        const outDir = join(outputDir, relativeDir)
        const outFile = join(outDir, result.path.filename)

        if (result.status === 'skipped') {
          return undefined
        }

        if (!createdDir[outDir]) {
          await mkdir(outDir, { recursive: true }); createdDir[outDir] = true
        }

        await writeFile(outFile, result.content, { signal })

        results.push({
          path: outFile,
          duration: result.duration
        })

        return undefined
      })

      if (renderer.outputFiles) {
        const assetsDir = join(outputDir, 'assets', 'js')

        if (!createdDir[assetsDir]) {
          await mkdir(assetsDir, { recursive: true }); createdDir[assetsDir] = true
        }

        const assetWrites = Object.values(renderer.outputFiles).map(async (file) => {
          const outFile = join(assetsDir, file.hashedPath)
          const outDir = dirname(outFile)

          if (!createdDir[outDir]) {
            await mkdir(outDir, { recursive: true }); createdDir[outDir] = true
          }

          await writeFile(outFile, file.text, { signal })

          results.push({
            path: outFile,
            duration: 0
          })
        })
        await Promise.all(assetWrites)
      }
      return results
    },

    addRenderQueue: renderer.addRenderQueue,

    _triggerPluginAggregateHook: _triggerPluginAggregateHookLocal,
    _triggerPluginHook: _triggerPluginHookLocal,
    /**
     * Retrieves all page paths that utilize a specific custom element.
     *
     * @param {string} targetPath - The path or ID of the custom element (component) to search for.
     * @returns {string[]} An array of page pathnames that include the specified component.
     */
    getPagePathsUsingCustomElement: (targetPath) => {
      // @ts-ignore
      if (targetPath.startsWith(app.options.path.components)) {
        // @ts-ignore
        targetPath = targetPath.substring(app.options.path.components.length + 1)
      }
      const item = app.components.getItem(targetPath)
      const results = []
      if (item) {
        const id = app._dependencyGraph.childCustomElements[item.result.id] || item.result.id
        const pce = app._dependencyGraph.pageCustomElements[id]
        if (pce) {
          pce.forEach(p => results.push(p))
        }
      }
      return results
    }
  })

  // --- Initialization ---

  // Pre-initialization: load core plugins
  if (app.options.mode === 'development') {
    app.options.plugins.unshift(testingPlugin)
  }
  app.options.plugins.unshift(metadataPlugin)
  if (assets) {
    app.options.plugins.unshift(staticAssetPlugin(assets))
  }

  await Promise.all([
    initHasher(),
    setupPlugins({
      app,
      // @ts-ignore
      serverGlobalContext,
      plugins,
      scriptManager,
      source
    })
  ])

  const handlers = createPageHandlers({
    app,
    triggerHook: _triggerPluginHookLocal,
    handleError: _handleErrorLocal
  })

  app.components = await getHtmlFiles({
    path: app.options.components,
    recursive: true,
    type: 'component',
    onFileSet: handlers.onComponentSet,
    onFileUpdate: handlers.onComponentUpdate,
    onFileDelete: handlers.onComponentDelete
  })

  await Promise.all(plugins.components.map(c => app.components.setItem(c)))

  app.pages = new CoraliteCollection({
    rootDir: app.options.pages,
    onSet: handlers.onPageSet,
    onUpdate: handlers.onPageUpdate,
    onDelete: handlers.onPageDelete
  })

  if (app.options.mode === 'production') {
    for await (const file of discoverHtmlFiles({
      path: app.options.pages,
      recursive: true,
      type: 'page',
      discoverOnly: false
    })) {
      // @ts-ignore
      await app.pages.setItem(file)
    }
  } else {
    await getHtmlFiles({
      path: app.options.pages,
      recursive: true,
      type: 'page',
      discoverOnly: false,
      // @ts-ignore
      collection: app.pages
    })
  }

  return app
}

export default createCoralite
