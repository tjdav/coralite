import { build } from 'esbuild'
import serialize from 'serialize-javascript'
import { normalizeFunction } from './utils.js'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

/**
 * Script Manager for Coralite
 * Manages shared functions across template instances and provides plugin extensibility
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
  if (plugin && typeof plugin.setup === 'function') {
    plugin.setup(this)
  }

  // Register helpers
  if (
    plugin
    && typeof plugin !== 'function'
    && (plugin.helpers || plugin.imports)
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
 * Register shared functions for a template
 * @param {string} templateId - Template identifier
 * @param {import('../types/script.js').ScriptContent} script - Script content or function
 * @param {string} [filePath] - The source file path to map back to
 */
ScriptManager.prototype.registerTemplate = function (templateId, script, filePath) {
  this.sharedFunctions[templateId] = {
    templateId,
    script,
    imports: script.imports || [],
    filePath: filePath ? resolve(filePath) : `/template-${templateId}.js`
  }
}

/**
 * Generate instance-specific script wrapper
 * @param {string} templateId - Template identifier
 * @param {InstanceContext} instanceContext - Instance context
 * @returns {string} Generated script
 */
ScriptManager.prototype.generateInstanceWrapper = function (templateId, instanceContext) {
  const values = instanceContext.values ? serialize(instanceContext.values) : '{}'

  // Generate wrapper that calls shared functions with instance context
  return `await coraliteTemplateFunctions["${templateId}"]({
      values: ${values},
      helpers,
      imports,
      instanceId: '${instanceContext.instanceId}'
    });`
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
    entryCodeParts.push(`import scriptModule_${i} from "${moduleNamespace}${i}";\n`)
  }

  // Setup helpers
  const helperParts = [
    ...this.scriptModules.map((_, i) => `...scriptModule_${i}`),
    this.getHelpersContent()
  ].filter(Boolean).join(',\n')

  entryCodeParts.push(`const coraliteTemplateScriptHelpers = {
    ${helperParts}
  };\n`)

  entryCodeParts.push(`const getHelpers = (context) => {
    const helpers = {}
    for (const [key, helper] of Object.entries(coraliteTemplateScriptHelpers)) {
      helpers[key] = helper(context)
    }
    return helpers
  }\n`)

  const instanceValues = Object.entries(instances)
  // Collect unique templates
  const processedTemplates = {}
  for (const instanceData of instanceValues) {
    processedTemplates[instanceData[1].templateId] = true
  }

  const processedTemplatesKeys = Object.keys(processedTemplates)
  const regex = /[-.:]/g
  const namespace = 'coralite-templates:'
  const componentImportsNamespace = 'coralite-template-imports:'

  // Generate ESM imports for each template script
  for (const templateId of processedTemplatesKeys) {
    if (this.sharedFunctions[templateId]) {
      const safeId = templateId.replace(regex, '_')
      entryCodeParts.push(`import template_${safeId} from "${namespace}${templateId}";\n`)

      if (this.sharedFunctions[templateId].imports && this.sharedFunctions[templateId].imports.length > 0) {
        entryCodeParts.push(`import componentImports_${safeId} from "${componentImportsNamespace}${templateId}";\n`)
      }
    }
  }

  // Map imports to the functions object
  entryCodeParts.push('const coraliteTemplateFunctions = {\n')
  for (const templateId of processedTemplatesKeys) {
    if (this.sharedFunctions[templateId]) {
      entryCodeParts.push(`  "${templateId}": template_${templateId.replace(regex, '_')},\n`)
    }
  }
  entryCodeParts.push('};\n')

  entryCodeParts.push('const coraliteComponentImports = {\n')
  for (const templateId of processedTemplatesKeys) {
    if (this.sharedFunctions[templateId] && this.sharedFunctions[templateId].imports && this.sharedFunctions[templateId].imports.length > 0) {
      entryCodeParts.push(`  "${templateId}": componentImports_${templateId.replace(regex, '_')},\n`)
    }
  }
  entryCodeParts.push('};\n')

  // Invoke instances
  entryCodeParts.push('\n// Instances\n')
  for (const [instanceId, instanceData] of instanceValues) {
    const context = {
      instanceId,
      templateId: instanceData.templateId,
      refs: instanceData.refs,
      values: instanceData.values,
      document: instances[instanceId].document || {}
    }

    entryCodeParts.push(';(async() => {\n')
    entryCodeParts.push('const context = ' + serialize(context) + ';\n')
    entryCodeParts.push('const helpers = getHelpers(context);\n')
    entryCodeParts.push(`const imports = coraliteComponentImports["${context.templateId}"] || {};\n`)
    entryCodeParts.push('context.imports = imports;\n')
    entryCodeParts.push('context.helpers = helpers;\n')
    entryCodeParts.push(`\n// Instance: ${instanceId}\n`)
    entryCodeParts.push(`await coraliteTemplateFunctions["${context.templateId}"](context);\n`)
    entryCodeParts.push('})();\n')
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
    treeShaking: true,
    sourcemap: mode === 'production' ? false : 'inline',
    minify: mode === 'production',
    format: 'esm',
    external: ['http://*', 'https://*'],
    sourceRoot: pathToFileURL(process.cwd()).href,
    plugins: [
      {
        name: 'coralite-template-resolver',
        setup: (pluginBuild) => {
          // Catch the imports and associate them with the real file paths
          const templateRegex = new RegExp(`^${namespace}`)

          pluginBuild.onResolve({ filter: templateRegex }, args => {
            const templateId = args.path.replace(namespace, '')
            const sharedFn = this.sharedFunctions[templateId]

            return {
              path: sharedFn.filePath,
              pluginData: { templateId }
            }
          })

          // Handle script modules
          const componentImportsRegex = new RegExp(`^${componentImportsNamespace}`)

          pluginBuild.onResolve({ filter: componentImportsRegex }, args => {
            const templateId = args.path.replace(componentImportsNamespace, '')
            return {
              path: args.path,
              namespace: 'coralite-component-imports',
              pluginData: { templateId }
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
            const templateId = args.pluginData.templateId
            const sharedFn = this.sharedFunctions[templateId]
            let contents = ''

            const importMap = {}
            if (sharedFn.imports) {
              for (const imp of sharedFn.imports) {
                const specifier = JSON.stringify(imp.specifier)
                let attrStr = ''
                if (imp.attributes) {
                  attrStr = ` with { ${Object.entries(imp.attributes).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')} }`
                }

                if (imp.namespaceExport) {
                  contents += `import * as ${imp.namespaceExport} from ${specifier}${attrStr};\n`
                  importMap[imp.namespaceExport] = imp.namespaceExport
                }

                const parts = []
                if (imp.defaultExport) {
                  parts.push(imp.defaultExport)
                  importMap[imp.defaultExport] = imp.defaultExport
                }

                if (imp.namedExports && imp.namedExports.length) {
                  parts.push(`{ ${imp.namedExports.join(', ')} }`)
                  for (const named of imp.namedExports) {
                    if (named.includes(' as ')) {
                      const [, alias] = named.split(' as ')
                      importMap[alias.trim()] = alias.trim()
                    } else {
                      importMap[named.trim()] = named.trim()
                    }
                  }
                }

                if (parts.length > 0) {
                  const importStr = parts.join(', ')
                  contents += `import ${importStr} from ${specifier}${attrStr};\n`
                }
              }
            }

            const importsObjContent = Object.keys(importMap).length > 0
              ? `const componentImports = { ${Object.entries(importMap).map(([k, v]) => `${k}: ${v}`).join(', ')} };`
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
              for (const imp of module.imports) {
                const specifier = JSON.stringify(imp.specifier)
                let attrStr = ''
                if (imp.attributes) {
                  attrStr = ` with { ${Object.entries(imp.attributes).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')} }`
                }

                // Handle namespaceExport separately to avoid invalid syntax (e.g. import Def, * as N, { Named })
                if (imp.namespaceExport) {
                  contents += `import * as ${imp.namespaceExport} from ${specifier}${attrStr};\n`
                  importMap[imp.namespaceExport] = imp.namespaceExport
                }

                // Handle default and named exports together
                const parts = []
                if (imp.defaultExport) {
                  parts.push(imp.defaultExport)
                  importMap[imp.defaultExport] = imp.defaultExport
                }

                if (imp.namedExports && imp.namedExports.length) {
                  parts.push(`{ ${imp.namedExports.join(', ')} }`)
                  for (const named of imp.namedExports) {
                    // Check for "as" syntax: "original as alias"
                    if (named.includes(' as ')) {
                      const [, alias] = named.split(' as ')
                      importMap[alias.trim()] = alias.trim()
                    } else {
                      importMap[named.trim()] = named.trim()
                    }
                  }
                }

                if (parts.length > 0) {
                  const importStr = parts.join(', ')
                  contents += `import ${importStr} from ${specifier}${attrStr};\n`
                }
              }
            }

            // Generate imports object for context injection
            const importsObjContent = Object.keys(importMap).length > 0
              ? `const pluginImports = { ${Object.entries(importMap).map(([k, v]) => `${k}: ${v}`).join(', ')} };`
              : 'const pluginImports = {};'

            contents += importsObjContent + '\n'

            // Generate config object
            const configContent = module.config
              ? `const pluginConfig = ${JSON.stringify(module.config)};`
              : 'const pluginConfig = {};'

            contents += configContent + '\n'

            // Generate helpers
            contents += 'const helpers = {\n'
            if (module.helpers) {
              for (const key in module.helpers) {
                if (Object.hasOwn(module.helpers, key)) {
                  const fn = normalizeFunction(module.helpers[key])
                  contents += `  "${key}": (context) => {
                    context.imports = { ...(context.imports || {}), ...pluginImports }
                    context.config = { ...(context.config || {}), ...pluginConfig }
                    const fn = ${fn}
                    return fn(context)
                  },\n`
                }
              }
            }
            contents += '};\n'
            contents += 'export default helpers;'

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
            if (!args.pluginData || !args.pluginData.templateId) {
              return
            }

            const sharedFn = this.sharedFunctions[args.pluginData.templateId]
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

  return result.outputFiles[0].text
}
