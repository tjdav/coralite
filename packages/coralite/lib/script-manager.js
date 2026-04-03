import { build } from 'esbuild'
import serialize from 'serialize-javascript'
import { normalizeFunction } from './utils.js'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { resolve, parse } from 'node:path'
import { createHash } from 'node:crypto'
import { nodeModulesPolyfillPlugin } from 'esbuild-plugins-node-modules-polyfill'

/**
 * Script Manager for Coralite
 * Manages shared functions across component instances and provides plugin extensibility
 * @import {ScriptPlugin, InstanceContext} from '../types/index.js'
 */

/**
 * ScriptManager constructor function
 * @constructor
 */
export function ScriptManager (options = {}) {
  this.sharedFunctions = Object.create(null)
  this.helpers = Object.create(null)
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
    && (plugin.helpers || plugin.imports || typeof plugin.setup === 'function')
  ) {
    this.scriptModules.push(plugin)
  }

  this.plugins.push(plugin)
  return this
}

/**
 * Get helpers object content string
 * @returns {string} String containing all helpers as object properties
 */
ScriptManager.prototype.getHelpersContent = function () {
  let helpers = ''

  for (const key of Object.keys(this.helpers)) {
    helpers += `"${key}": async (globalContext) => {
      const phase1 = ${this.helpers[key]};
      const phase2 = await phase1(globalContext);
      return (localContext) => phase2(localContext);
    },`
  }

  return helpers
}

/**
 * Add a helper function with metadata
 * @param {string} name - Helper name
 * @param {function} method - The helper function
 * @returns {Promise<ScriptManager>} - Returns this for method chaining
 */
ScriptManager.prototype.addHelper = async function (name, method) {
  this.helpers[name] = normalizeFunction(method)

  return this
}

/**
 * Get helpers
 * @returns {string} Object containing all helpers
 */
ScriptManager.prototype.getHelpers = function () {
  let helpers = ''

  for (const key of Object.keys(this.helpers)) {
    helpers += `"${key}": async (globalContext) => {
      const phase1 = ${this.helpers[key]};
      const phase2 = await phase1(globalContext);
      return (localContext) => phase2(localContext);
    },`
  }

  return `{${helpers}}`
}

/**
 * Register shared functions for a component
 * @param {Object} options
 * @param {string} options.id - component identifier
 * @param {import('../types/script.js').ScriptContent} [options.script={}] - Script content or function
 * @param {string} [options.filePath] - The source file path to map back to
 * @param {Array<Object>|null} [options.templateAST=null] - Parsed HTML template AST for the client side rendering
 * @param {Object|null} [options.templateValues=null] - Token positions for AST updates
 * @param {Object} [options.defaultValues={}] - Initial default state from setup()
 * @param {string} [options.styles=''] - Raw CSS string for the Shadow DOM
 */
ScriptManager.prototype.registerComponent = function ({ id, script = {}, filePath, templateAST = null, templateValues = null, defaultValues = {}, styles = '' }) {
  this.sharedFunctions[id] = {
    id,
    script,
    templateAST,
    templateValues,
    defaultValues,
    styles,
    imports: script.imports || [],
    filePath: filePath ? resolve(filePath) : `/component-${id}.js`
  }
}

/**
 * Generate instance-specific script wrapper
 * @param {string} id - component identifier
 * @param {InstanceContext} instanceContext - Instance context
 * @returns {string} Generated script
 */
ScriptManager.prototype.generateInstanceWrapper = function (id, instanceContext) {
  const values = instanceContext.values ? serialize(instanceContext.values) : '{}'

  // Generate wrapper that calls shared functions with instance context
  return `await coraliteComponentFunctions["${id}"]({
      values: ${values},
      helpers,
      imports,
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
    entryCodeParts.push(`import { helpers as helpers_${i}, runSetup as runSetup_${i} } from "${moduleNamespace}${i}";\n`)
  }

  // Setup helpers
  const helperParts = [
    ...this.scriptModules.map((_, i) => `...helpers_${i}`),
    this.getHelpersContent()
  ].filter(Boolean).join(',\n')

  entryCodeParts.push(`const coraliteComponentScriptHelpers = {
    ${helperParts}
  };\n`)

  entryCodeParts.push(`const getSetups = async (context) => {
    const values = {};
    const results = await Promise.all([
      ${this.scriptModules.map((_, i) => `runSetup_${i}(context)`).join(',\n      ')}
    ]);
    for (const result of results) {
      if (result && typeof result === 'object') {
        Object.assign(values, result);
      }
    }
    return values;
  }\n`)

  // Global setups initialization
  entryCodeParts.push(`const globalContext = { values: {} };\n`)
  entryCodeParts.push(`const globalSetupValuesPromise = getSetups(globalContext).then(setupValues => {
    Object.assign(globalContext.values, setupValues);
    return setupValues;
  });\n`)

  entryCodeParts.push(`const resolvedHelpersPromise = globalSetupValuesPromise.then(async () => {
    const resolvedHelpers = {};
    for (const [key, helperFn] of Object.entries(coraliteComponentScriptHelpers)) {
      resolvedHelpers[key] = await helperFn(globalContext);
    }
    return resolvedHelpers;
  });\n`)

  entryCodeParts.push(`const getHelpers = async (context) => {
    const helpers = {}
    const resolvedHelpers = await resolvedHelpersPromise;
    for (const [key, resolvedHelper] of Object.entries(resolvedHelpers)) {
      helpers[key] = resolvedHelper(context)
    }
    return helpers
  }\n`)

  const instanceValues = Object.entries(instances)
  // Collect unique components
  const processedComponent = {}
  for (const instanceData of instanceValues) {
    processedComponent[instanceData[1].componentId] = true
  }

  // Force inclusion of imperative components
  for (const [componentId, fnData] of Object.entries(this.sharedFunctions)) {
    if (fnData.templateAST != null || (fnData.defaultValues && Object.keys(fnData.defaultValues).length > 0) || (fnData.script && fnData.script.components && fnData.script.components.length > 0) || (fnData.script && fnData.script.content && fnData.script.content !== 'export default function(){}') || (fnData.script && fnData.script.content && fnData.script.content !== 'export default function() {}') || (fnData.styles && fnData.styles !== '')) {
      processedComponent[componentId] = true
    } else if (fnData.script && fnData.script.content && fnData.script.content.trim() !== 'export default function(){}' && fnData.script.content.trim() !== 'export default function() {}' && fnData.script.content.trim() !== 'export default function() { }') {
      processedComponent[componentId] = true
    } else if (fnData.script && fnData.script.content) {
      processedComponent[componentId] = true
    } else if (fnData.templateAST || fnData.styles) {
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

      if (this.sharedFunctions[componentId].imports && this.sharedFunctions[componentId].imports.length > 0) {
        entryCodeParts.push(`import componentImports_${safeId} from "${componentImportsNamespace}${componentId}";\n`)
      }
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

  entryCodeParts.push('const coraliteComponentImports = {\n')
  for (const componentId of processedComponentKeys) {
    if (this.sharedFunctions[componentId] && this.sharedFunctions[componentId].imports && this.sharedFunctions[componentId].imports.length > 0) {
      entryCodeParts.push(`  "${componentId}": componentImports_${componentId.replace(regex, '_')},\n`)
    }
  }
  entryCodeParts.push('};\n')

  entryCodeParts.push('const coraliteComponentDefaults = {\n')
  for (const key of processedComponentKeys) {
    if (this.sharedFunctions[key] && this.sharedFunctions[key].defaultValues) {
      entryCodeParts.push(`  "${key}": (() => {\n`)
      entryCodeParts.push(`    const defaults = ${serialize(this.sharedFunctions[key].defaultValues)};\n`)
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

  // Resolve dom-serializer path using import.meta.resolve
  const domSerializerPath = fileURLToPath(import.meta.resolve('dom-serializer'))

  entryCodeParts.push(`import render from "${domSerializerPath}";\n`)
  entryCodeParts.push('\nexport { getHelpers, getSetups, render };\n')

  const entryPoints = {
    'chunk-shared': entryCodeParts.join('').trimEnd()
  }

  // Create virtual entry points for each component
  for (const componentId of processedComponentKeys) {
    if (this.sharedFunctions[componentId]) {
      const safeId = componentId.replace(regex, '_')
      let componentEntryCode = ''

      let hasImports = false
      if (this.sharedFunctions[componentId].imports && this.sharedFunctions[componentId].imports.length > 0) {
        componentEntryCode += `import componentImports from "${componentImportsNamespace}${componentId}";\n`
        hasImports = true
      }

      if (this.sharedFunctions[componentId].script && this.sharedFunctions[componentId].script.content && this.sharedFunctions[componentId].script.content.trim() !== 'export default function(){}' && this.sharedFunctions[componentId].script.content.trim() !== 'export default function() {}' && this.sharedFunctions[componentId].script.content.trim() !== 'export default function() { }') {
        componentEntryCode += `import componentScript from "${namespace}${componentId}";\n`
      } else {
        componentEntryCode += `const componentScript = null;\n`
      }

      // Use a WeakMap to map original nodes to a unique index
      const nodeMap = new WeakMap()
      let nodeCounter = 0

      const cleanAST = (nodes) => {
        if (!nodes) return null
        return nodes.map((node) => {
          const cloned = { ...node }
          // Assign unique ID for token mapping
          const id = nodeCounter++
          nodeMap.set(node, id)
          cloned._id = id

          // Remove circular references
          delete cloned.parent
          delete cloned.prev
          delete cloned.next
          if (cloned.children) {
            cloned.children = cleanAST(cloned.children)
          }
          return cloned
        })
      }

      const cleanValues = (values) => {
        if (!values) return null
        const result = { ...values }
        if (result.attributes) {
          result.attributes = result.attributes.map(item => {
            const cloned = { ...item }
            cloned.elementId = nodeMap.get(item.element)
            delete cloned.element // Remove reference to DOM element
            return cloned
          })
        }
        if (result.textNodes) {
          result.textNodes = result.textNodes.map(item => {
            const cloned = { ...item }
            cloned.textNodeId = nodeMap.get(item.textNode)
            delete cloned.textNode // Remove reference to DOM element
            return cloned
          })
        }
        if (result.refs) {
          result.refs = result.refs.map(item => {
            const cloned = { ...item }
            cloned.elementId = nodeMap.get(item.element)
            delete cloned.element // Remove reference to DOM element
            return cloned
          })
        }
        return result
      }

      const templateAST = serialize(cleanAST(this.sharedFunctions[componentId].templateAST) || [])
      const templateValues = serialize(cleanValues(this.sharedFunctions[componentId].templateValues) || {
        attributes: [],
        textNodes: [],
        refs: []
      })
      const styles = JSON.stringify(this.sharedFunctions[componentId].styles || '')
      const defaults = serialize(this.sharedFunctions[componentId].defaultValues || {})

      componentEntryCode += `
export default {
  componentId: "${componentId}",
  templateAST: ${templateAST},
  templateValues: ${templateValues},
  styles: ${styles},
  defaultValues: (() => { const defaults = ${defaults}; return defaults; })(),
  imports: ${hasImports ? 'componentImports' : '{}'},
  script: componentScript
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
    treeShaking: false,
    splitting: true,
    metafile: true,
    minify: mode === 'production',
    sourcemap: mode === 'production' ? 'external' : 'inline',
    outdir: 'assets/js',
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
                args.path.startsWith('coralite-component-imports:') ||
                args.path.startsWith('coralite-script-module:') ||
                args.path === 'chunk-shared' ||
                args.path === 'coralite-shared') {
              return null // Let other resolvers handle it
            }


            // Do not externalize if the entry point name actually matches a bare specifier
            if (Object.keys(entryPoints).includes(args.path)) {
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
          // Catch the imports and associate them with the real file paths
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
          const componentImportsRegex = new RegExp(`^${componentImportsNamespace}`)

          pluginBuild.onResolve({ filter: componentImportsRegex }, args => {
            const componentId = args.path.replace(componentImportsNamespace, '')
            return {
              path: args.path,
              namespace: 'coralite-component-imports',
              pluginData: { componentId }
            }
          })

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
            namespace: 'coralite-component-imports'
          }, args => {
            const componentId = args.pluginData.componentId
            const sharedFn = this.sharedFunctions[componentId]
            let contents = ''

            const importMap = {}
            if (sharedFn.imports) {
              for (const importDefinition of sharedFn.imports) {
                const specifier = JSON.stringify(importDefinition.specifier)
                let attributesString = ''
                if (importDefinition.attributes) {
                  attributesString = ` with { ${Object.entries(importDefinition.attributes).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(', ')} }`
                }

                if (importDefinition.namespaceExport) {
                  contents += `import * as ${importDefinition.namespaceExport} from ${specifier}${attributesString};\n`
                  importMap[importDefinition.namespaceExport] = importDefinition.namespaceExport
                }

                const parts = []
                if (importDefinition.defaultExport) {
                  parts.push(importDefinition.defaultExport)
                  importMap[importDefinition.defaultExport] = importDefinition.defaultExport
                }

                if (importDefinition.namedExports && importDefinition.namedExports.length) {
                  parts.push(`{ ${importDefinition.namedExports.join(', ')} }`)
                  for (const namedExport of importDefinition.namedExports) {
                    if (namedExport.includes(' as ')) {
                      const [, exportAlias] = namedExport.split(' as ')
                      importMap[exportAlias.trim()] = exportAlias.trim()
                    } else {
                      importMap[namedExport.trim()] = namedExport.trim()
                    }
                  }
                }

                if (parts.length > 0) {
                  const importStr = parts.join(', ')
                  contents += `import ${importStr} from ${specifier}${attributesString};\n`
                }
              }
            }

            const importsObjContent = Object.keys(importMap).length > 0
              ? `const componentImports = { ${Object.entries(importMap).map(([key, value]) => `"${key}": ${value}`).join(', ')} };`
              : 'const componentImports = {};'

            contents += importsObjContent + '\n'
            contents += 'export default componentImports;'

            return {
              contents,
              loader: 'js',
              resolveDir: process.cwd()
            }
          })

          pluginBuild.onLoad({
            filter: /.*/,
            namespace: 'coralite-script-module'
          }, args => {
            const index = args.pluginData.index
            const module = this.scriptModules[index]
            let contents = ''

            // Generate imports
            const importMap = {}
            if (module.imports) {
              for (const importDefinition of module.imports) {
                const specifier = JSON.stringify(importDefinition.specifier)
                let attributesString = ''
                if (importDefinition.attributes) {
                  attributesString = ` with { ${Object.entries(importDefinition.attributes).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(', ')} }`
                }

                // Handle namespaceExport separately to avoid invalid syntax (e.g. import Def, * as N, { Named })
                if (importDefinition.namespaceExport) {
                  contents += `import * as ${importDefinition.namespaceExport} from ${specifier}${attributesString};\n`
                  importMap[importDefinition.namespaceExport] = importDefinition.namespaceExport
                }

                // Handle default and namedExport exports together
                const parts = []
                if (importDefinition.defaultExport) {
                  parts.push(importDefinition.defaultExport)
                  importMap[importDefinition.defaultExport] = importDefinition.defaultExport
                }

                if (importDefinition.namedExports && importDefinition.namedExports.length) {
                  parts.push(`{ ${importDefinition.namedExports.join(', ')} }`)
                  for (const namedExport of importDefinition.namedExports) {
                    // Check for "as" syntax: "original as exportAlias"
                    if (namedExport.includes(' as ')) {
                      const [, exportAlias] = namedExport.split(' as ')
                      importMap[exportAlias.trim()] = exportAlias.trim()
                    } else {
                      importMap[namedExport.trim()] = namedExport.trim()
                    }
                  }
                }

                if (parts.length > 0) {
                  const importStr = parts.join(', ')
                  contents += `import ${importStr} from ${specifier}${attributesString};\n`
                }
              }
            }

            // Generate imports object for context injection
            const importsObjContent = Object.keys(importMap).length > 0
              ? `const pluginImports = { ${Object.entries(importMap).map(([key, value]) => `"${key}": ${value}`).join(', ')} };`
              : 'const pluginImports = {};'

            contents += importsObjContent + '\n'

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
                imports: pluginImports,
                config: pluginConfig,
                ...context
              };
              return await setup(contextObject);
            };\n`

            // Generate helpers
            contents += 'export const helpers = {\n'
            if (module.helpers) {
              for (const key in module.helpers) {
                if (Object.hasOwn(module.helpers, key)) {
                  const fn = normalizeFunction(module.helpers[key])
                  contents += `  "${key}": async (context) => {
                    const globalContext = {
                      ...context,
                      imports: pluginImports,
                      config: pluginConfig
                    };
                    const fn = ${fn};
                    const phase2 = await fn(globalContext);
                    return (localContext) => phase2(localContext);
                  },\n`
                }
              }
            }
            contents += '};\n'

            return {
              contents,
              loader: 'js',
              resolveDir: process.cwd()
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
            const padding = '\n'.repeat(Math.max(0, sharedFn.script.lineOffset || 0))

            return {
              contents: `${padding}export default ${sharedFn.script.content};`,
              loader: 'js',
              resolveDir: process.cwd()
            }
          })
        }
      }
    ]
  })

  // Hash the output files to create a manifest
  const manifest = {}
  const outputFiles = {}

  if (result.outputFiles) {
    for (const file of result.outputFiles) {
      const fileName = parse(file.path).name
      const fileExt = parse(file.path).ext

      const hash = createHash('md5').update(file.text).digest('hex').substring(0, 8)
      const hashedName = `${fileName}-${hash}${fileExt}`

      // Store the mapping from original chunk name to hashed chunk name
      manifest[fileName] = hashedName

      // Keep track of the raw file objects for saving later
      outputFiles[hashedName] = {
        ...file,
        hashedPath: hashedName
      }
    }

    // Rewrite imports in the output chunks to use the hashed filenames
    for (const key in outputFiles) {
      if (Object.prototype.hasOwnProperty.call(outputFiles, key)) {
        let content = outputFiles[key].text

        // Find import/export statements to other chunks
        for (const [originalName, hashedName] of Object.entries(manifest)) {
          if (originalName !== parse(outputFiles[key].path).name) {
            // Replace e.g., import "./chunk-shared.js" with import "./chunk-shared-[hash].js"
            const regex = new RegExp(`(["'])\\.\\/${originalName}\\.js(["'])`, 'g')
            content = content.replace(regex, `$1./${hashedName}$2`)
          }
        }

        outputFiles[key].text = content
      }
    }
  }

  return {
    manifest,
    outputFiles,
    importMap: resolvedImportMap
  }
}
