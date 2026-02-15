/**
 * @import Coralite from './coralite.js'
 * @import { CoralitePlugin, CoralitePluginResult, HTMLData, CoralitePluginPageSetCallback, CoralitePluginPageUpdateCallback, CoralitePluginPageDeleteCallback, CoralitePluginTemplateCallback } from '../types/index.js'
 */

import { basename, dirname } from 'path'
import { getHtmlFileSync } from './html.js'

/**
 * Validates that a value is a non-empty string
 * @param {*} value - Value to validate
 * @param {string} paramName - Parameter name for error messages
 * @throws {Error} If value is not a valid non-empty string
 */
function validateNonEmptyString (value, paramName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `Coralite plugin validation failed: "${paramName}" must be a non-empty string, received ${typeof value}`
    )
  }
}

/**
 * Validates that a value is a function (or undefined/null)
 * @param {*} value - Value to validate
 * @param {string} paramName - Parameter name for error messages
 * @throws {Error} If value is defined but not a function
 */
function validateOptionalFunction (value, paramName) {
  if (value != null && typeof value !== 'function') {
    throw new Error(
      `Coralite plugin validation failed: "${paramName}" must be a function, received ${typeof value}`
    )
  }
}

/**
 * Validates that a value is an array of strings (or empty array)
 * @param {*} value - Value to validate
 * @param {string} paramName - Parameter name for error messages
 * @throws {Error} If value is defined but not an array of strings
 */
function validateStringArray (value, paramName) {
  if (!Array.isArray(value)) {
    throw new Error(
      `Coralite plugin validation failed: "${paramName}" must be an array, received ${typeof value}`
    )
  }

  for (let i = 0; i < value.length; i++) {
    if (typeof value[i] !== 'string') {
      throw new Error(
        `Coralite plugin validation failed: "${paramName}[${i}]" must be a string, received ${typeof value[i]}`
      )
    }
  }
}

/**
 * Processes a single template file with optional caching
 * @param {string} path - Template file path
 * @returns {HTMLData} Template data
 * @throws {Error} If template file cannot be read or is invalid
 */
function processTemplate (path) {
  try {
    const content = getHtmlFileSync(path)

    const templateData = {
      content,
      path: {
        pathname: path,
        dirname: dirname(path),
        filename: basename(path)
      }
    }

    return templateData
  } catch (error) {
    throw new Error(
      `Coralite plugin template processing failed for "${path}": ${error.message}`
    )
  }
}

/**
 * Creates a new Coralite plugin instance based on provided configuration options.
 * @template T
 * @param {CoralitePlugin<T> & ThisType<Coralite> & { templates?: string[] }} options - Plugin configuration object
 * @returns {CoralitePlugin<T> & { templates: HTMLData[] }} A configured plugin instance ready to be registered with Coralite
 * @example
 * // Basic plugin
 * const myPlugin = createPlugin({
 *   name: 'my-plugin',
 *   method: (options, context) => {
 *     // Plugin logic implementation
 *     return { ...context.values, custom: 'data' }
 *   }
 * })
 *
 * @example
 * // Plugin with templates and metadata
 * const advancedPlugin = createPlugin({
 *   name: 'advanced-plugin',
 *   method: async (options, context) => {
 *     // Async plugin logic
 *     return { ...context.values, processed: true }
 *   },
 *   templates: ['src/components/header.html', 'src/components/footer.html'],
 *   onPageSet: async (data) => {
 *     console.log('Page created:', data.path.pathname)
 *   }
 * })
 *
 * @example
 * // Plugin with caching disabled
 * const devPlugin = createPlugin({
 *   name: 'dev-plugin',
 *   method: (options, context) => context.values,
 *   templates: ['src/components/dev.html'],
 * })
 */
export function createPlugin ({
  name,
  method,
  templates = [],
  onPageSet,
  onPageUpdate,
  onPageDelete,
  onTemplateSet,
  onTemplateUpdate,
  onTemplateDelete,
  script,
  server
}) {
  // Validate required parameters
  validateNonEmptyString(name, 'name')

  // Validate optional parameters
  validateOptionalFunction(method, 'method')
  validateOptionalFunction(onPageSet, 'onPageSet')
  validateOptionalFunction(onPageUpdate, 'onPageUpdate')
  validateOptionalFunction(onPageDelete, 'onPageDelete')
  validateOptionalFunction(onTemplateSet, 'onTemplateSet')
  validateOptionalFunction(onTemplateUpdate, 'onTemplateUpdate')
  validateOptionalFunction(onTemplateDelete, 'onTemplateDelete')
  validateOptionalFunction(server, 'server')

  // Validate templates array
  validateStringArray(templates, 'templates')

  // Validate scriptPlugin if provided
  if (script != null) {
    if (typeof script !== 'object') {
      throw new Error(
        `Coralite plugin validation failed: "scriptPlugin" must be an object, received ${typeof script}`
      )
    }

    // Validate optional scriptPlugin properties
    if (script.setup != null && typeof script.setup !== 'function') {
      throw new Error(
        `Coralite plugin validation failed: "scriptPlugin.setup" must be a function, received ${typeof script.setup}`
      )
    }

    if (script.helpers != null && typeof script.helpers !== 'object') {
      throw new Error(
        `Coralite plugin validation failed: "scriptPlugin.helpers" must be an object, received ${typeof script.helpers}`
      )
    }
  }

  // Process template files with error handling
  /** @type {HTMLData[]} */
  const templateResults = []

  if (templates.length > 0) {
    try {
      // Process all templates
      for (const path of templates) {
        const result = processTemplate(path)
        templateResults.push(result)
      }
    } catch (error) {
      // Enhance error message with plugin context
      throw new Error(
        `Coralite plugin "${name}" failed to load templates: ${error.message}`
      )
    }
  }

  // Create the plugin object with all configured properties
  return {
    name,
    method,
    templates: templateResults,
    onPageSet,
    onPageUpdate,
    onPageDelete,
    onTemplateSet,
    onTemplateUpdate,
    onTemplateDelete,
    script,
    server
  }
}

