import { build } from 'esbuild'
import serialize from 'serialize-javascript'
import { parse as parseJS } from 'acorn'
import { simple as walkJS } from 'acorn-walk'
import { normalizeFunction, normalizeObjectFunctions, hasObjectKeys, mergeUniqueObjects, addComponentAndDependencies, cleanAST, cleanValues, generateHydrationMap } from './utils.js'
import { findAndExtractImperativeComponents, astTransformer } from './server-utils.js'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { resolve, parse, dirname, relative } from 'node:path'
import { nodeModulesPolyfillPlugin } from 'esbuild-plugins-node-modules-polyfill'
import render from 'dom-serializer'

/**
 * Script Manager for Coralite
 * Manages shared functions across component instances and provides plugin extensibility
 * @import { ScriptPlugin, InstanceContext } from '../types/index.js'
 * @import { ScriptContent } from '../types/script.js'
 */

/**
 * ScriptManager constructor function
 * @class
 */
export function ScriptManager (options = {}) {
  this.sharedFunctions = Object.create(null)
  this.contextProps = Object.create(null)
  this.plugins = []
  this.scriptModules = []
  this.options = options
}

/**
 * Register a plugin
 * @param {ScriptPlugin} plugin - Plugin object or setup function
 * @returns {Promise<ScriptManager>} - Returns this for method chaining
 */
ScriptManager.prototype.use = async function (plugin) {
  // Register script modules (client plugins)
  if (
    plugin
    && typeof plugin !== 'function'
  ) {
    if (plugin.context
      || typeof plugin.setup === 'function'
      || typeof plugin.onBeforeComponentRender === 'function'
      || typeof plugin.onAfterComponentRender === 'function'
      || typeof plugin.onDisconnected === 'function') {
      this.scriptModules.push(plugin)

      if (plugin.context) {
        let extractedComponents = []
        for (const key in plugin.context) {
          if (Object.hasOwn(plugin.context, key)) {
            const contextFn = plugin.context[key]
            const contextStr = typeof contextFn === 'function' ? `(${contextFn.toString()})` : serialize(contextFn)
            const foundComponents = findAndExtractImperativeComponents(contextStr)
            extractedComponents = extractedComponents.concat(foundComponents)
          }
        }
        if (extractedComponents.length > 0) {
          plugin._extractedComponents = Array.from(new Set(extractedComponents))
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
 * @param {Object} options
 * @param {string} options.id - component identifier
 * @param {ScriptContent} [options.script={}] - Script content or function
 * @param {string} [options.filePath] - The source file path to map back to
 * @param {Array<Object>|null} [options.templateAST=null] - Parsed HTML template AST for the client side rendering
 * @param {Object|null} [options.templateValues=null] - Token positions for AST updates
 * @param {Object} [options.defaultValues={}] - Initial default state from setup()
 * @param {Object} [options.getters={}] - Component getters
 * @param {string} [options.styles=''] - Raw CSS string for the component
 * @param {Object.<string, Function>} [options.slots={}] - Computed slots
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
  slots = {}
}) {
  // Initialize base object if it's the first time we are seeing this ID
  if (!this.sharedFunctions[id]) {
    this.sharedFunctions[id] = {
      id,
      components: [],
      filePath: `/component-${id}.js`
    }
  }

  const target = this.sharedFunctions[id]

  if (hasObjectKeys(script)) {
    target.script = script
  }

  if (hasObjectKeys(getters)) {
    if (target.getters) {
      target.getters = {
        ...target.getters,
        ...getters
      }
    } else {
      target.getters = getters
    }
  }

  if (templateAST) {
    target.templateAST = templateAST
  }

  if (templateValues) {
    target.templateValues = templateValues
  }

  if (styles) {
    target.styles = styles
  }

  if (filePath) {
    target.filePath = resolve(filePath)
  }


  if (hasObjectKeys(defaultValues)) {
    if (target.defaultValues) {
      target.defaultValues = {
        ...target.defaultValues,
        ...defaultValues
      }
    } else {
      target.defaultValues = defaultValues
    }
  }

  if (hasObjectKeys(slots)) {
    if (target.slots) {
      target.slots = {
        ...target.slots,
        ...slots
      }
    } else {
      target.slots = slots
    }
  }

  if (script) {
    if (script.components?.length) {
      target.components = mergeUniqueObjects(target.components, script.components)
    }
  }
}

/**
 * Generate instance-specific script wrapper
 * @param {string} id - component identifier
 * @param {InstanceContext} instanceContext - Instance context
 * @returns {string} Generated script
 */
ScriptManager.prototype.generateInstanceWrapper = function (id, instanceContext) {
  const state = instanceContext.state ? serialize(instanceContext.state) : '{}'
  const page = instanceContext.page ? serialize(instanceContext.page) : '{}'

  // Generate wrapper that calls shared functions with instance context
  return `await coraliteComponentFunctions["${id}"]({
      state: ${state},
      page: ${page},
      ...pluginContexts,
      instanceId: '${instanceContext.instanceId}'
    });`
}

/**
 * Compile all instances for a component
 * @param {Object.<string, InstanceContext>} instances - Map of instanceId -> instance data
 * @param {string} mode - Build mode
 * @returns {Promise<any>} Compiled script
 */
ScriptManager.prototype.compileAllInstances = async function (instances, mode) {
  const entryCodeParts = []
  const moduleNamespace = 'coralite-script-module:'
  // Generate ESM imports for each script module
  for (let i = 0; i < this.scriptModules.length; i++) {
    entryCodeParts.push(`import { clientContextProps as clientContextProps_${i}, runSetup as runSetup_${i}, onBeforeComponentRender as onBeforeComponentRender_${i}, onAfterComponentRender as onAfterComponentRender_${i}, onDisconnected as onDisconnected_${i} } from "${moduleNamespace}${i}";\n`)
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
  entryCodeParts.push(`const globalContext = { values: {} };\n`)
  entryCodeParts.push(`const globalSetupPropertiesPromise = getSetups(globalContext).then(setupValues => {
    Object.assign(globalContext.values, setupValues);
    return setupValues;
  });\n`)

  entryCodeParts.push(`const resolvedContextPropsPromise = globalSetupPropertiesPromise.then(async () => {
    const resolvedProps = {};
    const keys = Object.keys(coraliteComponentClientContextProps);
    for (const key of keys) {
      resolvedProps[key] = await coraliteComponentClientContextProps[key](globalContext);
    }
    return resolvedProps;
  });\n`)

  entryCodeParts.push(`const getClientContext = async (context) => {
    const clientContextProps = {}
    const resolvedProps = await resolvedContextPropsPromise;
    for (const [key, resolvedProp] of Object.entries(resolvedProps)) {
      clientContextProps[key] = resolvedProp(context)
    }
    return clientContextProps
  }\n`)

  const instanceValues = Object.entries(instances)
  // Collect unique components
  /** @type {Record<string, boolean>} */
  const processedComponent = {}

  for (const instanceData of instanceValues) {
    addComponentAndDependencies(instanceData[1].componentId, processedComponent, this.sharedFunctions)
  }

  // Add plugin dependencies explicitly if they are standalone
  for (const plugin of this.plugins) {
    if (plugin && plugin._extractedComponents && Array.isArray(plugin._extractedComponents)) {
      for (const compPath of plugin._extractedComponents) {
        for (const [id, fnData] of Object.entries(this.sharedFunctions)) {
          if (compPath.endsWith(`/${id}.html`) || compPath.endsWith(`\\${id}.html`) || compPath === id || compPath.endsWith(`/${id}`)) {
            addComponentAndDependencies(id, processedComponent, this.sharedFunctions)
          }
        }
      }
    }
  }

  // Force inclusion of all components that evaluate something inside
  // This is required because if a parent is ONLY instantiated via script dynamically,
  // it might not be in instances or plugin explicit references.
  for (const [componentId, fnData] of Object.entries(this.sharedFunctions)) {
    // "forcing all imperative components into the final chunks bundle, is fine, but it must not include the children of the imperative components since the imperative should load its own dependent components."
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

  const processedComponentKeys = Object.keys(processedComponent).sort()
  const regex = /[-.:]/g
  const namespace = 'coralite-component:'
  const componentImportsNamespace = 'coralite-component-imports:'

  // Generate ESM imports for each component script
  for (const componentId of processedComponentKeys) {
    if (this.sharedFunctions[componentId]) {
      const safeId = componentId.replace(regex, '_')
      entryCodeParts.push(`import component_${safeId} from "${namespace}${componentId}";\n`)
    }
  }

  // Map imports to the functions object
  entryCodeParts.push('const coraliteComponentFunctions = {\n')
  for (const componentId of processedComponentKeys) {
    if (this.sharedFunctions[componentId]) {
      entryCodeParts.push(`  "${componentId}": component_${componentId.replace(regex, '_')},\n`)
    }
  }
  entryCodeParts.push('};\n')

  entryCodeParts.push('const coraliteComponentDefaults = {\n')
  for (const key of processedComponentKeys) {
    if (this.sharedFunctions[key] && this.sharedFunctions[key].defaultValues) {
      const normalizedDefaults = normalizeObjectFunctions(this.sharedFunctions[key].defaultValues, astTransformer)

      entryCodeParts.push(`  "${key}": (() => {\n`)
      entryCodeParts.push(`    const defaults = ${serialize(normalizedDefaults)};\n`)
      entryCodeParts.push(`    return defaults;\n`)
      entryCodeParts.push(`  })(),\n`)
    } else {
      entryCodeParts.push(`  "${key}": {},\n`)
    }
  }
  entryCodeParts.push('};\n')

  entryCodeParts.push('const coraliteComponentStyles = {\n')
  for (const key of processedComponentKeys) {
    if (this.sharedFunctions[key] && this.sharedFunctions[key].styles) {
      entryCodeParts.push(`  "${key}": ${JSON.stringify(this.sharedFunctions[key].styles)},\n`)
    }
  }
  entryCodeParts.push('};\n')

  const coraliteElementPath = fileURLToPath(import.meta.resolve('./coralite-element.js'))

  entryCodeParts.push(`const globalClientHooks = {
    onBeforeComponentRender: [${this.scriptModules.map((_, i) => `onBeforeComponentRender_${i}`).join(', ')}].filter(Boolean),
    onAfterComponentRender: [${this.scriptModules.map((_, i) => `onAfterComponentRender_${i}`).join(', ')}].filter(Boolean),
    onDisconnected: [${this.scriptModules.map((_, i) => `onDisconnected_${i}`).join(', ')}].filter(Boolean)
  };\n`)

  entryCodeParts.push(`import { createCoraliteClass } from ${JSON.stringify(coraliteElementPath)};\n`)
  entryCodeParts.push('\nexport { getClientContext, getSetups, createCoraliteClass, globalClientHooks };\n')

  const entryPoints = {
    'chunk-shared': entryCodeParts.join('').trimEnd()
  }

  // Create virtual entry points for each component
  for (const componentId of processedComponentKeys) {
    if (this.sharedFunctions[componentId]) {
      const safeId = componentId.replace(regex, '_')
      let componentEntryCode = ''

      const hasScript = this.sharedFunctions[componentId].script && this.sharedFunctions[componentId].script.content && this.sharedFunctions[componentId].script.content.trim() !== 'function(){}' && this.sharedFunctions[componentId].script.content.trim() !== 'function() {}' && this.sharedFunctions[componentId].script.content.trim() !== 'function() { }'
      const hasState = this.sharedFunctions[componentId].script && this.sharedFunctions[componentId].script.stateContent

      if (hasScript || hasState) {
        componentEntryCode += `import * as componentModule_${safeId} from "${namespace}${componentId}";\n`
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
  script: ${hasScript ? `componentModule_${safeId}.script` : 'null'},
  state: ${hasState ? `componentModule_${safeId}.state` : 'null'}
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
    virtualEntryPoints[key] = `virtual-entry-point:${key}`
  }

  // Build and bundle
  const result = await build({
    entryPoints: virtualEntryPoints,
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
            if (args.namespace === 'coralite-entry') {
              return null
            }

            // Check for Coralite internal modules first
            if (args.path.startsWith('coralite-component:') ||
              args.path.startsWith('coralite-script-module:') ||
              args.path === 'chunk-shared' ||
              args.path === 'coralite-shared') {
              return null
            }

            if (args.path === 'coralite') {
              return {
                path: 'coralite',
                namespace: 'coralite-virtual'
              }
            }

            if (args.path === 'coralite/utils') {
              return {
                path: fileURLToPath(import.meta.resolve('./utils.js'))
              }
            }

            // Support virtual module imports for plugins by name
            if (this.plugins.some(p => p.name === args.path)) {
              return {
                path: args.path,
                external: true
              }
            }


            // Do not externalize if the entry point name actually matches a bare specifier
            if (Object.hasOwn(entryPoints, args.path)) {
              return null
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
          pluginBuild.onLoad({
            filter: /.*/,
            namespace: 'coralite-virtual'
          }, args => {
            if (args.path === 'coralite') {
              const utilsPath = fileURLToPath(import.meta.resolve('./utils.js'))
              const pluginPath = fileURLToPath(import.meta.resolve('./plugin.js'))
              return {
                contents: `
                  export { defineComponent } from '${utilsPath.replace(/\\/g, '/')}';
                  export { definePlugin } from '${pluginPath.replace(/\\/g, '/')}';
                `,
                loader: 'js'
              }
            }
          })

          pluginBuild.onResolve({ filter: /^virtual-entry-point:/ }, args => {
            const key = args.path.replace('virtual-entry-point:', '')
            if (entryPoints[key]) {
              return {
                path: key,
                namespace: 'coralite-entry'
              }
            }
          })

          pluginBuild.onLoad({
            filter: /.*/,
            namespace: 'coralite-entry'
          }, args => {
            if (entryPoints[args.path]) {
              return {
                contents: entryPoints[args.path],
                loader: 'js',
                resolveDir: process.cwd()
              }
            }
          })
        }
      },
      {
        name: 'coralite-component-resolver',
        setup: (pluginBuild) => {
          // Catch the script module, associate with real file paths
          const componentRegex = new RegExp(`^${namespace}`)

          pluginBuild.onResolve({ filter: componentRegex }, args => {
            const componentId = args.path.replace(namespace, '')
            const sharedFn = this.sharedFunctions[componentId]

            return {
              path: sharedFn.filePath,
              pluginData: { componentId }
            }
          })

          // Handle script modules
          const moduleRegex = new RegExp(`^${moduleNamespace}`)
          pluginBuild.onResolve({ filter: moduleRegex }, args => {
            const index = parseInt(args.path.replace(moduleNamespace, ''), 10)
            return {
              path: args.path,
              namespace: 'coralite-script-module',
              pluginData: { index }
            }
          })

          pluginBuild.onLoad({
            filter: /.*/,
            namespace: 'coralite-script-module'
          }, args => {
            const index = args.pluginData.index
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
              const contextObject = {
                config: pluginConfig,
                ...context
              };
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
              for (const key in module.context) {
                if (Object.hasOwn(module.context, key)) {
                  if (['id', 'state', 'page', 'root', 'signal'].includes(key)) {
                    throw new Error(`Reserved context key '${key}' cannot be used in plugin context.`)
                  }
                  const fn = normalizeFunction(module.context[key])
                  contents += `  "${key}": async (globalContext) => {
                    const fn = ${fn};
                    const phase2 = await fn(globalContext, pluginConfig);
                    return (localContext) => phase2(localContext);
                  },\n`
                }
              }
            }
            contents += '};\n'

            return {
              contents,
              loader: 'js',
              resolveDir: module.rootDir || (module.filePath ? dirname(module.filePath) : process.cwd())
            }
          })

          // Provide the script content to esbuild when it loads those file paths
          pluginBuild.onLoad({
            filter: /.*/
          }, args => {
            if (!args.pluginData || !args.pluginData.componentId) {
              return
            }

            const sharedFn = this.sharedFunctions[args.pluginData.componentId]
            let contents = ''


            if (sharedFn.script && sharedFn.script.content) {
              const padding = '\n'.repeat(Math.max(0, sharedFn.script.lineOffset || 0))

              // More robust way to strip 'data' from defineComponent call
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
                        const dataProp = firstArg.properties.find(p => p.type === 'Property' && p.key?.type === 'Identifier' && p.key?.name === 'data')
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
              } catch (e) {
                // Fallback to regex if AST parsing fails
                strippedContent = strippedContent.replace(/data\s*:\s*async\s*function\s*\([^\)]*\)\s*\{[\s\S]*?\}(?=\s*,|\s*\})/, '/* data stripped */')
                strippedContent = strippedContent.replace(/async\s*data\s*\([^\)]*\)\s*\{[\s\S]*?\}(?=\s*,|\s*\})/, '/* data stripped */')
              }

              contents += `${padding}export const script = ${strippedContent};\n`
              contents += `export default script;\n`
            } else {
              contents += `export const script = null;\n`
              contents += `export default null;\n`
            }

            if (sharedFn.script && sharedFn.script.stateContent) {
              const padding = '\n'.repeat(Math.max(0, sharedFn.script.stateLineOffset || 0))
              contents += `${padding}export const state = ${sharedFn.script.stateContent};\n`
            } else {
              contents += `export const state = null;\n`
            }

            return {
              contents,
              loader: 'js',
              resolveDir: sharedFn.filePath ? dirname(sharedFn.filePath) : process.cwd()
            }
          })
        }
      }
    ]
  })

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
