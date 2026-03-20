import { build } from 'esbuild'
import serialize from 'serialize-javascript'
import { normalizeFunction } from './utils.js'
import { generateWebComponentClass } from './compile-component.js'
import { pathToFileURL } from 'node:url'
import { resolve, relative, dirname, parse, format } from 'node:path'

/**
 * Script Manager for Coralite
 * Manages shared functions across component instances and provides plugin extensibility
 * @import {ScriptPlugin, InstanceContext} from '../types/index.js'
 */

/**
 * ScriptManager constructor function
 * @constructor
 */
export function ScriptManager () {
  this.sharedFunctions = Object.create(null)
  this.helpers = Object.create(null)
  this.plugins = []
  this.scriptModules = []
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
    && plugin.client
    && (plugin.client.helpers || plugin.client.imports || typeof plugin.client.setup === 'function')
  ) {
    this.scriptModules.push(plugin.client)
  } else if (
    plugin
    && typeof plugin !== 'function'
    // @ts-ignore
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
    helpers += `"${key}": ${this.helpers[key]},`
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
    helpers += `"${key}": ${this.helpers[key]},`
  }

  return `{${helpers}}`
}

/**
 * Register shared functions for a component
 * @param {string} id - component identifier
 * @param {import('../types/script.js').ScriptContent} script - Script content or function
 * @param {string} [filePath] - The source file path to map back to
 * @param {string} [htmlPayload] - The component's HTML structure
 * @param {string} [cssPayload] - The component's scoped CSS
 */
ScriptManager.prototype.registerComponent = function (id, script, filePath, htmlPayload, cssPayload) {
  this.sharedFunctions[id] = {
    id,
    script,
    components: script.components || [],
    imports: script.imports || [],
    htmlPayload: htmlPayload || '',
    cssPayload: cssPayload || '',
    filePath: filePath ? resolve(filePath) : `/component-${id}.js`
  }
}

/**
 * Compile all instances for a document
 * @param {Object.<string, InstanceContext>} instances - Map of instanceId -> instance data
 * @param {string} mode - Build mode
 * @returns {Promise<string>} Compiled script
 */
ScriptManager.prototype.compileAllInstances = async function (instances, mode) {
  const entryCodeParts = []
  const moduleNamespace = 'coralite-script-module:'
  // Generate ESM imports for each script module
  for (let i = 0; i < this.scriptModules.length; i++) {
    entryCodeParts.push(`import { helpers as helpers_${i}, runSetup as runSetup_${i} } from "${moduleNamespace}${i}";\n`)
  }

  entryCodeParts.push(`import { registry } from "coralite-runtime-context";\n`)

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
  entryCodeParts.push(`const globalContext = {};\n`)
  entryCodeParts.push(`registry.globalSetupPromise = getSetups(globalContext);\n`)

  entryCodeParts.push(`
  for (const [key, factory] of Object.entries(coraliteComponentScriptHelpers)) {
    if (typeof factory === 'function') {
      registry.globalHelperFactories[key] = factory(globalContext);
    } else {
      registry.globalHelperFactories[key] = factory;
    }
  }
  \n`)

  const instanceValues = Object.entries(instances)
  // Collect unique components recursively
  const processedComponent = {}
  const self = this

  function collectComponents (componentId) {
    if (!processedComponent[componentId]) {
      processedComponent[componentId] = true
      const sharedFn = self.sharedFunctions[componentId]
      if (sharedFn && sharedFn.components && sharedFn.components.length > 0) {
        for (const childId of sharedFn.components) {
          collectComponents(childId)
        }
      }
    }
  }

  for (const instanceData of instanceValues) {
    collectComponents(instanceData[1].componentId)
  }

  const processedComponentKeys = Object.keys(processedComponent)
  const regex = /[-.:]/g
  const namespace = 'coralite-component:'
  const componentImportsNamespace = 'coralite-component-imports:'

  // Import components as side effects
  for (const componentId of processedComponentKeys) {
    if (this.sharedFunctions[componentId]) {
      entryCodeParts.push(`import "${namespace}${componentId}";\n`)
    }
  }

  // Build and bundle
  const result = await build({
    stdin: {
      contents: entryCodeParts.join('').trimEnd(),
      resolveDir: process.cwd(),
      sourcefile: 'coralite-client-runtime.js'
    },
    bundle: true,
    write: false,
    treeShaking: false,
    sourcemap: mode === 'production' ? false : 'inline',
    minify: mode === 'production',
    format: 'esm',
    external: ['http://*', 'https://*'],
    sourceRoot: pathToFileURL(process.cwd()).href,
    plugins: [
      {
        name: 'coralite-component-resolver',
        setup: (pluginBuild) => {
          pluginBuild.onResolve({ filter: /^coralite-runtime-context$/ }, args => {
            return {
              path: args.path,
              namespace: 'coralite-runtime-context'
            }
          })

          pluginBuild.onLoad({
            filter: /.*/,
            namespace: 'coralite-runtime-context'
          }, () => {
            return {
              contents: 'export const registry = { globalSetupPromise: null, globalHelperFactories: {}, coraliteComponentImports: {} };',
              loader: 'js',
              resolveDir: process.cwd()
            }
          })

          // Catch the imports and associate them with the real file paths
          const componentRegex = new RegExp(`^${namespace}`)

          pluginBuild.onResolve({ filter: componentRegex }, args => {
            const componentId = args.path.replace(namespace, '')
            const sharedFn = this.sharedFunctions[componentId]

            return {
              path: args.path,
              namespace: 'coralite-component',
              pluginData: { componentId },
              sideEffects: true
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

            // Generate helpers (Phase 1 & 2 Currying)
            contents += 'export const helpers = {\n'
            if (module.helpers) {
              for (const key in module.helpers) {
                if (Object.hasOwn(module.helpers, key)) {
                  const fn = normalizeFunction(module.helpers[key])
                  contents += `  "${key}": (globalContext) => {
                    globalContext.imports = { ...(globalContext.imports || {}), ...pluginImports }
                    globalContext.config = { ...(globalContext.config || {}), ...pluginConfig }
                    const userPhase1Fn = ${fn}
                    return userPhase1Fn(globalContext)
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
            filter: /.*/,
            namespace: 'coralite-component'
          }, args => {
            if (!args.pluginData || !args.pluginData.componentId) {
              return
            }

            const componentId = args.pluginData.componentId
            const sharedFn = this.sharedFunctions[componentId]
            let contents = `import { registry } from "coralite-runtime-context";\n`

            // Import framework components specified in client.components
            if (sharedFn.components && sharedFn.components.length > 0) {
              for (const childId of sharedFn.components) {
                contents += `import "coralite-component:${childId}";\n`
              }
            }

            // Generate imports obj content to bind to component class
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

            contents += generateWebComponentClass(componentId, sharedFn.htmlPayload, sharedFn.cssPayload, sharedFn.script)

            return {
              contents,
              loader: 'js',
              resolveDir: process.cwd()
            }
          })
        }
      }
    ]
  })

  return result.outputFiles[0].text
}
