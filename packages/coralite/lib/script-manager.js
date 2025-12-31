import { transform } from 'esbuild'
import serialize from 'serialize-javascript'
import { normalizeFunction } from './utils.js'

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
  this.sharedFunctions = new Map()
  this.helpers = {}
  this.factoryHelpers = new Set()
  this.plugins = []
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
  if (plugin && typeof plugin !== 'function' && plugin.helpers) {
    for (const key in plugin.helpers) {
      if (!Object.hasOwn(plugin.helpers, key)) continue

      await this.addHelper(key, plugin.helpers[key])
    }
  }

  this.plugins.push(plugin)
  return this
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
ScriptManager.prototype.getHelpers = function (context) {
  let helpers = ''

  for (const key in this.helpers) {
    if (!Object.hasOwn(this.helpers, key)) continue

    helpers += `"${key}": ${this.helpers[key]},`
  }

  return `{${helpers}}`
}

/**
 * Register shared functions for a template
 * @param {string} templateId - Template identifier
 * @param {string|function} script - Script content or function
 */
ScriptManager.prototype.registerTemplate = async function (templateId, script) {
  this.sharedFunctions.set(templateId, {
    templateId,
    script
  })
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
 * @returns {Promise<string>} Compiled script
 */
ScriptManager.prototype.compileAllInstances = async function (instances) {
  let code = '(async () => {\n'

  code += `  const coraliteTemplateScriptHelpers = ${this.getHelpers()};\n`
  code += `  const getHelpers = (context) => {
    const helpers = {}

    for (const key in coraliteTemplateScriptHelpers) {
      if (!Object.hasOwn(coraliteTemplateScriptHelpers, key)) continue

      helpers[key] = coraliteTemplateScriptHelpers[key](context)
    }

    return helpers
  }\n`
  code += `  const coraliteTemplateFunctions = {\n`

  // Add shared function definitions (once per template)
  const processedTemplates = new Set()

  for (const [instanceId, instanceData] of Object.entries(instances)) {
    const { templateId } = instanceData

    if (!processedTemplates.has(templateId)) {
      const sharedFn = this.sharedFunctions.get(templateId)
      if (sharedFn && typeof sharedFn.script === 'function') {
        const script = normalizeFunction(sharedFn.script)
        code += `    "${templateId}": ${script},\n`
        processedTemplates.add(templateId)
      }
    }
  }

  code += '  };\n'

  // Add instance
  code += '\n// Instances\n'
  for (const [instanceId, instanceData] of Object.entries(instances)) {
    // Create context for instance helpers
    const context = {
      instanceId,
      templateId: instanceData.templateId,
      refs: instanceData.refs,
      values: instanceData.values,
      document: instances[instanceId].document || {}
    }

    // Build instance helpers by calling factories with context
    code += ';(async() => {\n'
    code += 'const context = ' + serialize(context) + ';\n'
    code += 'const helpers = getHelpers(context);\n'
    code += `\n// Instance: ${instanceId}\n`
    code += `await coraliteTemplateFunctions["${context.templateId}"](context, helpers);\n`
    code += '})();\n'
  }

  code += '})();\n'

  const result = await transform(code, {
    treeShaking: true
  })

  return result.code
}
