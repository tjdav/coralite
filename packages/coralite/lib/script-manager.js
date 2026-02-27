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
    for (const helper of Object.values(coraliteTemplateScriptHelpers)) {
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
  // Generate ESM imports for each template script
  for (const templateId of processedTemplatesKeys) {
    if (this.sharedFunctions[templateId]) {
      entryCodeParts.push(`import template_${templateId.replace(regex, '_')} from "${namespace}${templateId}";\n`)
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
    entryCodeParts.push(`\n// Instance: ${instanceId}\n`)
    entryCodeParts.push(`await coraliteTemplateFunctions["${context.templateId}"](context, helpers);\n`)
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
    format: 'iife',
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

            // Generate imports
            if (module.imports) {
              for (const imp of module.imports) {
                const parts = []
                if (imp.defaultExport) parts.push(imp.defaultExport)
                if (imp.namedExports && imp.namedExports.length) {
                  parts.push(`{ ${imp.namedExports.join(', ')} }`)
                }
                const importStr = parts.length ? parts.join(', ') : ''
                const fromStr = importStr ? `import ${importStr} from` : 'import'

                let attrStr = ''
                if (imp.attributes) {
                  attrStr = ` with { ${Object.entries(imp.attributes).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')} }`
                }

                contents += `${fromStr} ${JSON.stringify(imp.specifier)}${attrStr};\n`
              }
            }

            // Generate helpers
            contents += 'const helpers = {\n'
            if (module.helpers) {
              for (const key in module.helpers) {
                if (Object.hasOwn(module.helpers, key)) {
                  contents += `  "${key}": ${normalizeFunction(module.helpers[key])},\n`
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
