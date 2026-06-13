import { build, context } from 'esbuild'
import serialize from 'serialize-javascript'
import { parse as parseJS } from 'acorn'
import { simple as walkJS } from 'acorn-walk'
import { normalizeFunction, normalizeObjectFunctions, hasObjectKeys, mergeUniqueObjects, addComponentAndDependencies, cleanAST, cleanValues, generateHydrationMap } from './utils/core.js'
import { findAndExtractImperativeComponents, astTransformer } from './utils/server/server.js'
import { CoraliteError } from './utils/errors.js'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { resolve, parse, dirname, relative } from 'node:path'
import { nodeModulesPolyfillPlugin } from 'esbuild-plugins-node-modules-polyfill'
import render from 'dom-serializer'

/**
 * Script Manager for Coralite
 * @import { ScriptPlugin, InstanceContext, CoralitePlugin } from '../types/index.js'
 * @import { ScriptContent } from '../types/script.js'
 */

/**
 * ScriptManager constructor function
 * @class
 * @param {Object} options - The configuration options for the script manager.
 */
export function ScriptManager (options = {}) {
  this.sharedFunctions = Object.create(null)
  this.contextProps = Object.create(null)
  this.plugins = []
  this.scriptModules = []
  this.options = options
  this.context = null
}

/**
 * Register a plugin
 * @param {CoralitePlugin | ScriptPlugin} plugin - Plugin object or setup function
 * @returns {Promise<ScriptManager>} - Returns this for method chaining
 */
ScriptManager.prototype.use = async function (plugin) {
  // Register script modules (client plugins)
  if (
    plugin
    && typeof plugin !== 'function'
  ) {
    // @ts-ignore
    const client = plugin.client || plugin
    if (client.context
      || typeof client.setup === 'function'
      || typeof client.onBeforeComponentRender === 'function'
      || typeof client.onAfterComponentRender === 'function'
      || typeof client.onDisconnected === 'function') {
      this.scriptModules.push(plugin)

      if (client.context) {
        const contextStr = serialize(client.context)
        const extractedComponents = findAndExtractImperativeComponents(contextStr)

        if (extractedComponents.length > 0) {
          client._extractedComponents = Array.from(new Set(extractedComponents))
        }
      }
    }
  }

  this.plugins.push(plugin)
  return this
}

/**
 * Get context object content string
 * @returns {string} String containing all context as object state
 */
ScriptManager.prototype.getClientContextContent = function () {
  let contextPropsStr = ''

  for (const [key, value] of Object.entries(this.contextProps)) {
    contextPropsStr += `"${key}": async (globalContext) => {
      const phase1 = ${value};
      const phase2 = await phase1(globalContext);
      return (localContext) => phase2(localContext);
    },`
  }

  return contextPropsStr
}

/**
 * Add a context property function
 * @param {string} name - Property name
 * @param {function} method - The property function
 * @returns {Promise<ScriptManager>} - Returns this for method chaining
 */
ScriptManager.prototype.addContextProp = async function (name, method) {
  this.contextProps[name] = normalizeFunction(method)

  return this
}

/**
 * Register shared functions for a component
 * @param {Object} options - The options used to register the component.
 * @param {string} options.id - The component identifier.
 * @param {ScriptContent} [options.script={}] - The script content or function associated with the component.
 * @param {string} [options.filePath] - The source file path used to map back to the original source.
 * @param {Array<Object>|null} [options.templateAST=null] - The parsed HTML template AST for client-side rendering.
 * @param {Object|null} [options.templateValues=null] - The token positions for AST updates.
 * @param {Object} [options.defaultValues={}] - The initial default state from setup().
 * @param {Object} [options.getters={}] - The component getters.
 * @param {string} [options.styles=''] - The raw CSS string for the component.
 * @param {Object.<string, Function>} [options.slots={}] - The transformation functions for computed slots.
 * @param {boolean} [options.override=false] - Whether to override existing component definition.
 */
ScriptManager.prototype.registerComponent = function ({
  id,
  script = {},
  filePath,
  templateAST = null,
  templateValues = null,
  defaultValues = {},
  getters = {},
  styles = '',
  slots = {},
  override = false
}) {
  // Initialize base object if it's the first time we are seeing this ID
  const isNew = !this.sharedFunctions[id]
  if (isNew) {
    this.sharedFunctions[id] = {
      id,
      components: [],
      filePath: `/component-${id}.js`
    }
  }

  const target = this.sharedFunctions[id]

  if (hasObjectKeys(script)) {
    if (isNew || override) {
      target.script = script
    }
  }

  if (hasObjectKeys(getters)) {
    if (isNew || override) {
      target.getters = getters
    }
  }

  if (templateAST) {
    if (isNew || override) {
      target.templateAST = templateAST
    }
  }

  if (templateValues) {
    if (isNew || override) {
      target.templateValues = templateValues
    }
  }

  if (styles) {
    if (isNew || override) {
      target.styles = styles
    }
  }

  if (filePath) {
    if (isNew || override) {
      target.filePath = resolve(filePath)
    }
  }


  if (hasObjectKeys(defaultValues)) {
    if (isNew || override) {
      target.defaultValues = defaultValues
    }
  }

  if (hasObjectKeys(slots)) {
    if (isNew || override) {
      target.slots = slots
    }
  }

  if (script) {
    if (script.components?.length) {
      if (isNew || override) {
        target.components = script.components
      } else {
        target.components = mergeUniqueObjects(target.components, script.components)
      }
    }
  }
}

/**
 * Disposes the current esbuild context if it exists.
 * @returns {Promise<void>}
 */
ScriptManager.prototype.disposeContext = async function () {
  if (this.context) {
    await this.context.dispose()
    this.context = null
  }
}

/**
 * Compile all instances for a component
 * @param {Object.<string, InstanceContext> | string[]} instances - The map of instanceId to instance data (development) or an array of component IDs (production).
 * @param {string} mode - Build mode
 * @returns {Promise<any>} Compiled script
 */
ScriptManager.prototype.compileAllInstances = async function (instances, mode) {
  const entryCodeParts = []
  const moduleNamespace = 'coralite-script-module:'
  const componentNamespace = 'coralite-component:'
  const virtualPrefix = 'coralite-virtual:'

  // Generate ESM imports for each script module
  for (let i = 0; i < this.scriptModules.length; i++) {
    entryCodeParts.push(`import { clientContextProps as clientContextProps_${i}, runSetup as runSetup_${i}, onBeforeComponentRender as onBeforeComponentRender_${i}, onAfterComponentRender as onAfterComponentRender_${i}, onDisconnected as onDisconnected_${i} } from "${virtualPrefix}${moduleNamespace}${i}";\n`)
  }

  // Setup client context state
  const contextParts = [
    ...this.scriptModules.map((_, i) => `...clientContextProps_${i}`),
    this.getClientContextContent()
  ].filter(Boolean).join(',\n')

  entryCodeParts.push(`const coraliteComponentClientContextProps = {
    ${contextParts}
  };\n`)

  entryCodeParts.push(`const getSetups = async (context) => {
    const state = {};
    for (const runSetup of [${this.scriptModules.map((_, i) => `runSetup_${i}`).join(', ')}]) {
      const result = await runSetup(context);
      if (result && typeof result === 'object') {
        Object.assign(state, result);
      }
    }
    return state;
  }\n`)

  // Global setups initialization
  entryCodeParts.push('const globalContext = { values: {} };\n')

  entryCodeParts.push(`const resolvedContextPropsPromise = (async () => {
    const setupValues = await getSetups(globalContext);
    Object.assign(globalContext.values, setupValues);

    const resolvedProps = {};
    const keys = Object.keys(coraliteComponentClientContextProps);
    for (const key of keys) {
      resolvedProps[key] = await coraliteComponentClientContextProps[key](globalContext);
      globalContext[key] = resolvedProps[key];
    }
    return resolvedProps;
  })();\n`)

  entryCodeParts.push(`const getClientContext = async (context) => {
    const clientContextProps = {}
    const resolvedProps = await resolvedContextPropsPromise;
    for (const [key, resolvedProp] of Object.entries(resolvedProps)) {
      clientContextProps[key] = typeof resolvedProp === 'function' ? resolvedProp(context) : resolvedProp;
    }
    return clientContextProps
  }\n`)

  const coraliteElementPath = fileURLToPath(import.meta.resolve('./coralite-element.js'))

  entryCodeParts.push(`const globalClientHooks = {
    onBeforeComponentRender: [${this.scriptModules.map((_, i) => `onBeforeComponentRender_${i}`).join(', ')}].filter(Boolean),
    onAfterComponentRender: [${this.scriptModules.map((_, i) => `onAfterComponentRender_${i}`).join(', ')}].filter(Boolean),
    onDisconnected: [${this.scriptModules.map((_, i) => `onDisconnected_${i}`).join(', ')}].filter(Boolean)
  };\n`)

  entryCodeParts.push(`import { createCoraliteClass } from ${JSON.stringify(coraliteElementPath)};\n`)
  entryCodeParts.push('\nexport { getClientContext, getSetups, createCoraliteClass, globalClientHooks };\n')

  const entryPoints = {
    'coralite-runtime': entryCodeParts.join('').trimEnd()
  }

  // Determine which components to bundle
  /** @type {Record<string, boolean>} */
  const processedComponent = {}

  if (Array.isArray(instances)) {
    // Production: instances is an array of IDs
    for (const id of instances) {
      processedComponent[id] = true
    }
  } else {
    // Development: instances is a map of instanceId -> instance data
    const instanceValues = Object.entries(instances)
    for (const instanceData of instanceValues) {
      addComponentAndDependencies(instanceData[1].componentId, processedComponent, this.sharedFunctions)
    }

    // Add plugin dependencies explicitly if they are standalone
    for (const plugin of this.plugins) {
      if (plugin && plugin._extractedComponents && Array.isArray(plugin._extractedComponents)) {
        for (const compPath of plugin._extractedComponents) {
          for (const id of Object.keys(this.sharedFunctions)) {
            if (compPath.endsWith(`/${id}.html`) || compPath.endsWith(`\\${id}.html`) || compPath === id || compPath.endsWith(`/${id}`)) {
              addComponentAndDependencies(id, processedComponent, this.sharedFunctions)
            }
          }
        }
      }
    }

    // Force inclusion of all components that evaluate something inside
    for (const [componentId, fnData] of Object.entries(this.sharedFunctions)) {
      if (fnData.script && fnData.script.content) {
        const scriptContent = fnData.script.content.replace(/\s+/g, '')
        if (scriptContent !== 'function(){}') {
          processedComponent[componentId] = true
        }
      } else if (fnData.script && fnData.script.components && fnData.script.components.length > 0) {
        processedComponent[componentId] = true
      } else if (hasObjectKeys(fnData.defaultValues)) {
        processedComponent[componentId] = true
      }
    }
  }

  const processedComponentKeys = Object.keys(processedComponent).sort()
  const regex = /[-.:]/g

  // Create virtual entry points for each component
  for (const componentId of processedComponentKeys) {
    if (this.sharedFunctions[componentId]) {
      const safeId = componentId.replace(regex, '_')
      let componentEntryCode = ''

      const hasScript = this.sharedFunctions[componentId].script && this.sharedFunctions[componentId].script.content && this.sharedFunctions[componentId].script.content.trim() !== 'function(){}' && this.sharedFunctions[componentId].script.content.trim() !== 'function() {}' && this.sharedFunctions[componentId].script.content.trim() !== 'function() { }'
      const hasState = this.sharedFunctions[componentId].script && this.sharedFunctions[componentId].script.stateContent

      if (hasScript || hasState) {
        componentEntryCode += `import * as componentModule_${safeId} from "${virtualPrefix}${componentNamespace}${componentId}";\n`
      }

      // Use a WeakMap to map original nodes to a unique index
      const nodeMap = new WeakMap()
      const state = { counter: 0 }

      cleanAST(this.sharedFunctions[componentId].templateAST, nodeMap, state)
      const templateHTML = serialize(this.sharedFunctions[componentId].templateAST ? render(this.sharedFunctions[componentId].templateAST, { decodeEntities: false }) : '')
      const templateValues = serialize(cleanValues(this.sharedFunctions[componentId].templateValues, nodeMap) || {
        attributes: [],
        textNodes: [],
        refs: []
      })
      const styles = JSON.stringify(this.sharedFunctions[componentId].styles || '')

      let normalizedDefaults = this.sharedFunctions[componentId].defaultValues || {}
      if (this.sharedFunctions[componentId].defaultValues) {
        normalizedDefaults = normalizeObjectFunctions(this.sharedFunctions[componentId].defaultValues, astTransformer)
      }
      const defaults = serialize(normalizedDefaults)
      const attributes = serialize(this.sharedFunctions[componentId].script?.attributes || {})
      const hydrationMap = serialize(generateHydrationMap(this.sharedFunctions[componentId].templateAST, this.sharedFunctions[componentId].templateValues))
      const getters = serialize(this.sharedFunctions[componentId].getters || this.sharedFunctions[componentId].script?.getters || {})
      const dependencies = JSON.stringify(this.sharedFunctions[componentId].components || [])

      let normalizedSlots = this.sharedFunctions[componentId].slots || {}
      if (this.sharedFunctions[componentId].slots) {
        normalizedSlots = normalizeObjectFunctions(this.sharedFunctions[componentId].slots, astTransformer)
      }
      const slots = serialize(normalizedSlots)

      componentEntryCode += `
export default {
  componentId: "${componentId}",
  templateHTML: ${templateHTML},
  templateValues: ${templateValues},
  styles: ${styles},
  attributes: ${attributes},
  hydrationMap: ${hydrationMap},
  getters: ${getters},
  defaultValues: (() => { const defaults = ${defaults}; return defaults; })(),
  slots: (() => { const slots = ${slots}; return slots; })(),
  dependencies: ${dependencies},
  imports: {},
  client: ${hasScript ? `componentModule_${safeId}.script` : 'null'},
  server: ${hasState ? `componentModule_${safeId}.state` : 'null'}
};
`
      entryPoints[componentId] = componentEntryCode
    }
  }

  const resolvedImportMap = {}

  // Use config's import map if available
  const userImportMap = this.options?.importMap || {}

  // Since we cannot pass raw code directly as values in the entryPoints object to esbuild,
  // we need to pass virtual paths.
  /** @type {Record<string, string>} */
  const virtualEntryPoints = {}
  for (const key of Object.keys(entryPoints)) {
    virtualEntryPoints[key] = `${virtualPrefix}${key}`
  }

  const injectPath = fileURLToPath(import.meta.resolve('./utils/client/inject.js'))

  // Build and bundle
  /** @type {import('esbuild').BuildOptions} */
  const esbuildOptions = {
    entryPoints: virtualEntryPoints,
    inject: [injectPath],
    bundle: true,
    write: false,
    treeShaking: true,
    splitting: true,
    metafile: true,
    minify: mode === 'production',
    sourcemap: mode === 'production' ? 'external' : 'inline',
    outdir: 'assets/js',
    entryNames: '[name]-[hash]',
    chunkNames: '[name]-[hash]',
    format: 'esm',
    sourceRoot: pathToFileURL(process.cwd()).href,
    define: {
      global: 'window',
      __dirname: '""',
      __filename: '""'
    },
    plugins: [
      nodeModulesPolyfillPlugin(),
      {
        name: 'coralite-externaliser',
        setup: (pluginBuild) => {
          pluginBuild.onResolve({ filter: /\.(spec|test)\.js$|\.md$/ }, () => {
            return { external: true }
          })
        }
      },
      {
        name: 'coralite-import-map-resolver',
        setup: (pluginBuild) => {
          // Regex to catch bare specifiers (doesn't start with ., .., /, or http)
          const bareSpecifierRegex = /^[^.\/]|^\.[^.\/]|^\.\.[^\/]/

          pluginBuild.onResolve({ filter: bareSpecifierRegex }, (args) => {
            // Only intercept specifiers inside generated component scripts/files.
            // Do not externalize entry points themselves.
            if (args.kind === 'entry-point') {
              return null
            }

            // Do not externalize if the path resolves to a virtual module
            if (args.namespace === 'coralite-virtual') {
              return null
            }

            // Check for Coralite internal modules first
            if (args.path.startsWith(virtualPrefix) ||
              args.path === 'coralite-runtime' ||
              Object.hasOwn(entryPoints, args.path)) {
              return null
            }

            if (args.path === 'coralite') {
              return {
                path: injectPath
              }
            }

            if (args.path === 'coralite/utils') {
              return {
                path: fileURLToPath(import.meta.resolve('./utils/index.js'))
              }
            }

            // Ignore absolute URLs that are already explicitly defined
            if (args.path.startsWith('http')) {
              return {
                path: args.path,
                external: true
              }
            }

            // Check if the user provided an explicit override in coralite.config.js
            if (userImportMap[args.path]) {
              resolvedImportMap[args.path] = userImportMap[args.path]
              return {
                path: userImportMap[args.path],
                external: true
              }
            }
          })
        }
      },
      {
        name: 'coralite-virtual-modules',
        setup: (pluginBuild) => {
          pluginBuild.onResolve({ filter: new RegExp(`^${virtualPrefix}`) }, args => {
            return {
              path: args.path,
              namespace: 'coralite-virtual'
            }
          })

          pluginBuild.onLoad({
            filter: /.*/,
            namespace: 'coralite-virtual'
          }, args => {
            const path = args.path.replace(virtualPrefix, '')

            if (entryPoints[path]) {
              return {
                contents: entryPoints[path],
                loader: 'js',
                resolveDir: process.cwd()
              }
            }

            if (path.startsWith(moduleNamespace)) {
              const index = parseInt(path.replace(moduleNamespace, ''), 10)
              const module = this.scriptModules[index]
              let contents = ''

              // Generate config object
              const configContent = module.config
                ? `const pluginConfig = ${JSON.stringify(module.config)};`
                : 'const pluginConfig = {};'

              contents += configContent + '\n'

              // Generate setup function
              const setupFn = module.setup ? normalizeFunction(module.setup) : 'null'
              contents += `export const runSetup = async (context) => {
                const setup = ${setupFn};
                if (!setup) return {};
                const contextObject = Object.create(context);
                contextObject.config = pluginConfig;
                return await setup(contextObject);
              };\n`

              const beforeFn = module.onBeforeComponentRender ? normalizeFunction(module.onBeforeComponentRender) : 'null'
              contents += `export const onBeforeComponentRender = ${beforeFn};\n`

              const afterFn = module.onAfterComponentRender ? normalizeFunction(module.onAfterComponentRender) : 'null'
              contents += `export const onAfterComponentRender = ${afterFn};\n`

              const disconnectedFn = module.onDisconnected ? normalizeFunction(module.onDisconnected) : 'null'
              contents += `export const onDisconnected = ${disconnectedFn};\n`

              // Generate client context state
              contents += 'export const clientContextProps = {\n'
              if (module.context) {
                const clientName = module.name
                if (['id', 'state', 'page', 'root', 'signal'].includes(clientName)) {
                  throw new CoraliteError(`Reserved context key '${clientName}' cannot be used in plugin context.`)
                }

                const fn = normalizeFunction(module.context)
                contents += `  "${clientName}": async (globalContext) => {\n`
                contents += `    const fn = ${fn};\n`
                contents += `    const pluginContext = new Proxy(globalContext, {
                          get (target, prop) {
                            if (prop === 'config') return pluginConfig;
                            return target[prop];
                          },
                          set (target, prop, value) {
                            return Reflect.set(target, prop, value);
                          }
                        });
                        return await fn(pluginContext);
                      },\n`
              }
              contents += '};\n'

              return {
                contents,
                loader: 'js',
                resolveDir: module.rootDir || (module.filePath ? dirname(module.filePath) : process.cwd())
              }
            }

            if (path.startsWith(componentNamespace)) {
              const componentId = path.replace(componentNamespace, '')
              const sharedFn = this.sharedFunctions[componentId]
              let contents = ''

              if (sharedFn.script && sharedFn.script.content) {
                const padding = '\n'.repeat(Math.max(0, sharedFn.script.lineOffset || 0))

                // More robust way to strip 'server' from defineComponent call
                let strippedContent = sharedFn.script.content

                try {
                  const ast = parseJS(strippedContent, {
                    ecmaVersion: 'latest',
                    sourceType: 'module'
                  })
                  let dataStart = -1
                  let dataEnd = -1

                  walkJS(ast, {
                    CallExpression (node) {
                      if (node.callee.type === 'Identifier' && node.callee.name === 'defineComponent') {
                        const firstArg = node.arguments[0]
                        if (firstArg && firstArg.type === 'ObjectExpression') {
                          const dataProp = firstArg.properties.find(p => p.type === 'Property' && p.key?.type === 'Identifier' && p.key?.name === 'server')
                          // @ts-ignore
                          if (dataProp && dataProp.type === 'Property') {
                            // @ts-ignore
                            dataStart = dataProp.start
                            // @ts-ignore
                            dataEnd = dataProp.end
                          }
                        }
                      }
                    }
                  })

                  if (dataStart !== -1) {
                    let start = dataStart
                    let end = dataEnd

                    // Handle comma to avoid syntax errors
                    const afterContent = strippedContent.slice(end)
                    const trailingComma = afterContent.match(/^\s*,/)
                    if (trailingComma) {
                      end += trailingComma[0].length
                    } else {
                      const beforeContent = strippedContent.slice(0, start)
                      const leadingComma = beforeContent.match(/,\s*$/)
                      if (leadingComma) {
                        start -= leadingComma[0].length
                      }
                    }
                    strippedContent = strippedContent.slice(0, start) + strippedContent.slice(end)
                  }
                } catch {
                  // Fallback to regex if AST parsing fails
                  strippedContent = strippedContent.replace(/server\s*:\s*async\s*function\s*\([^\)]*\)\s*\{[\s\S]*?\}(?=\s*,|\s*\})/, '/* server stripped */')
                  strippedContent = strippedContent.replace(/async\s*server\s*\([^\)]*\)\s*\{[\s\S]*?\}(?=\s*,|\s*\})/, '/* server stripped */')
                }

                contents += `${padding}export const script = ${strippedContent};\n`
                contents += `export default script;\n`
              } else {
                contents += `export const script = null;\n`
                contents += `export default null;\n`
              }

              contents += `export const state = null;\n`

              return {
                contents,
                loader: 'js',
                resolveDir: sharedFn.filePath ? dirname(sharedFn.filePath) : process.cwd()
              }
            }
          })
        }
      }
    ]
  }

  let result
  if (mode === 'development') {
    if (!this.context) {
      this.context = await context(esbuildOptions)
    }
    result = await this.context.rebuild()
  } else {
    result = await build(esbuildOptions)
  }

  const manifest = {}
  if (result.metafile && result.metafile.outputs) {
    for (const [outputPath, meta] of Object.entries(result.metafile.outputs)) {
      if (meta.entryPoint) {
        const entryPoint = meta.entryPoint
        const cleanEntry = entryPoint.includes(':') ? entryPoint.split(':').pop() : entryPoint

        // STRIP THE EXTENSION (Fixes E2E Bootstrapper Timeout)
        const tagName = parse(cleanEntry).name

        // USE RELATIVE PATHS (Fixes the chunks/ 404 issue)
        const relativePath = relative('assets/js', outputPath).replace(/\\/g, '/')

        manifest[tagName] = relativePath
      }
    }
  }

  const outdirAbs = resolve('assets/js')
  const outputFiles = {}

  if (result.outputFiles) {
    for (const file of result.outputFiles) {
      // Keep the relative path for the output file creation on disk
      const relativePath = relative(outdirAbs, file.path).replace(/\\/g, '/')

      outputFiles[relativePath] = {
        ...file,
        hashedPath: relativePath,
        text: file.text
      }
    }
  }

  return {
    manifest,
    outputFiles,
    importMap: resolvedImportMap
  }
}
