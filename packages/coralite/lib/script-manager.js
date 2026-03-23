import { build } from 'esbuild'
import serialize from 'serialize-javascript'
import { normalizeFunction } from './utils.js'
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
    helpers += `"${key}": (() => {
      const phase1 = ${this.helpers[key]};
      const phase2 = phase1({});
      return (localContext) => phase2(localContext);
    })(),`
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
    helpers += `"${key}": (() => {
      const phase1 = ${this.helpers[key]};
      const phase2 = phase1({});
      return (localContext) => phase2(localContext);
    })(),`
  }

  return `{${helpers}}`
}

/**
 * Register shared functions for a component
 * @param {Object} options
 * @param {string} options.id - component identifier
 * @param {import('../types/script.js').ScriptContent} [options.script={}] - Script content or function
 * @param {string} [options.filePath] - The source file path to map back to
 * @param {string|null} [options.template=null] - Raw HTML template for imperative client rendering
 * @param {Object} [options.defaultValues={}] - Initial default state from setup()
 * @param {string} [options.styles=''] - Raw CSS string for the Shadow DOM
 */
ScriptManager.prototype.registerComponent = function ({ id, script = {}, filePath, template = null, defaultValues = {}, styles = '' }) {
  this.sharedFunctions[id] = {
    id,
    script,
    template,
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
 * @returns {Promise<string>} Compiled script
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

  entryCodeParts.push(`const getHelpers = (context) => {
    const helpers = {}
    for (const [key, helper] of Object.entries(coraliteComponentScriptHelpers)) {
      helpers[key] = helper(context)
    }
    return helpers
  }\n`)

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
  entryCodeParts.push(`const globalSetupValuesPromise = getSetups(globalContext);\n`)

  const instanceValues = Object.entries(instances)
  // Collect unique components
  const processedComponent = {}
  for (const instanceData of instanceValues) {
    processedComponent[instanceData[1].componentId] = true
  }

  // Force inclusion of imperative components
  for (const [componentId, fnData] of Object.entries(this.sharedFunctions)) {
    if (fnData.template != null || (fnData.defaultValues && Object.keys(fnData.defaultValues).length > 0) || (fnData.script && fnData.script.components && fnData.script.components.length > 0) || (fnData.script && fnData.script.content && fnData.script.content !== 'export default function(){}') || (fnData.script && fnData.script.content && fnData.script.content !== 'export default function() {}') || (fnData.styles && fnData.styles !== '')) {
      processedComponent[componentId] = true
    } else if (fnData.script && fnData.script.content && fnData.script.content.trim() !== 'export default function(){}' && fnData.script.content.trim() !== 'export default function() {}' && fnData.script.content.trim() !== 'export default function() { }') {
      processedComponent[componentId] = true
    } else if (fnData.script && fnData.script.content) {
      processedComponent[componentId] = true
    } else if (fnData.template || fnData.styles) {
      processedComponent[componentId] = true
    }
  }

  const processedComponentKeys = Object.keys(processedComponent)
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

  entryCodeParts.push('const coraliteComponentTemplates = {\n')
  for (const key of processedComponentKeys) {
    if (this.sharedFunctions[key] && this.sharedFunctions[key].template) {
      entryCodeParts.push(`  "${key}": ${serialize(this.sharedFunctions[key].template)},\n`)
    }
  }
  entryCodeParts.push('};\n')

  entryCodeParts.push('const coraliteComponentDefaults = {\n')
  for (const key of processedComponentKeys) {
    if (this.sharedFunctions[key] && this.sharedFunctions[key].defaultValues) {
      entryCodeParts.push(`  "${key}": ${serialize(this.sharedFunctions[key].defaultValues)},\n`)
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

  entryCodeParts.push(`
class CoraliteElement extends HTMLElement {
  constructor(componentId) {
    super();
    this.componentId = componentId;
    
    const defaults = coraliteComponentDefaults[componentId] || {};
    this.values = { ...defaults };
    
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    const template = coraliteComponentTemplates[this.componentId] || '';
    const styles = coraliteComponentStyles[this.componentId];
    
    if (!this.shadowRoot.innerHTML.trim()) {
      let content = '';
      if (styles) {
        content += \`<style>\${styles}</style>\`;
      }
      content += template;
      this.shadowRoot.innerHTML = content; 
    }

    const localContext = {
      instanceId: crypto.randomUUID(),
      componentId: this.componentId,
      values: this.values,
      root: this.shadowRoot, 
      helpers: {}
    };

    const refElements = this.shadowRoot.querySelectorAll('[ref]');
    for (let i = 0; i < refElements.length; i++) {
      const element = refElements[i];
      const refName = element.getAttribute('ref');
      
      const dynamicId = \`\${this.componentId}__\${refName}-\${localContext.instanceId}\`;
      element.setAttribute('ref', dynamicId);
      
      this.values[\`ref_\${refName}\`] = dynamicId;
    }

    const helpers = getHelpers(localContext);
    localContext.helpers = helpers;
    
    const imports = coraliteComponentImports[this.componentId] || {};
    localContext.imports = imports;

    const userScript = coraliteComponentFunctions[this.componentId];
    if (userScript) {
      userScript(localContext);
    }
  }
}

for (const componentId of Object.keys(coraliteComponentTemplates)) {
  if (!customElements.get(componentId)) {
    customElements.define(componentId, class extends CoraliteElement {
      constructor() {
        super(componentId);
      }
    });
  }
}
`)

  // Invoke instances
  entryCodeParts.push('\n// Instances\n')
  for (const [instanceId, instanceData] of instanceValues) {
    const context = {
      instanceId,
      componentId: instanceData.componentId,
      values: instanceData.values,
      component: instances[instanceId].component || {}
    }

    entryCodeParts.push(';(async() => {\n')
    entryCodeParts.push('const context = ' + serialize(context) + ';\n')
    entryCodeParts.push('context.root = window.document;\n')
    entryCodeParts.push(`const imports = coraliteComponentImports["${context.componentId}"] || {};\n`)
    entryCodeParts.push('context.imports = imports;\n')
    entryCodeParts.push('const setupValues = await globalSetupValuesPromise;\n')
    entryCodeParts.push('context.values = { ...context.values, ...setupValues };\n')
    entryCodeParts.push('const helpers = getHelpers(context);\n')
    entryCodeParts.push('context.helpers = helpers;\n')
    entryCodeParts.push(`\n// Instance: ${instanceId}\n`)
    entryCodeParts.push(`await coraliteComponentFunctions["${context.componentId}"](context);\n`)
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
    treeShaking: false,
    sourcemap: mode === 'production' ? false : 'inline',
    format: 'esm',
    external: ['http://*', 'https://*'],
    sourceRoot: pathToFileURL(process.cwd()).href,
    plugins: [
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
                  contents += `  "${key}": (() => {
                    const globalContext = {
                      imports: pluginImports,
                      config: pluginConfig
                    };
                    const fn = ${fn};
                    return fn(globalContext);
                  })(),\n`
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

  return result.outputFiles[0].text
}
