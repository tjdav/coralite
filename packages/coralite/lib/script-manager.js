import { build } from 'esbuild'
import serialize from 'serialize-javascript'
import { normalizeFunction } from './utils.js'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

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
 */
ScriptManager.prototype.registerComponent = function (id, script, filePath) {
  this.sharedFunctions[id] = {
    id,
    script,
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
 * Compiles a single generic Web Component as a standalone ES Module.
 *
 * @param {string} componentId - The tag name for the custom element.
 * @param {import('../types/script.js').ScriptContent} scriptContent - The component's script logic.
 * @param {string} htmlPayload - The component's HTML structure.
 * @param {string} cssPayload - The component's scoped CSS.
 * @param {string} mode - Build mode ('development' | 'production').
 * @returns {Promise<string>} The compiled JavaScript module.
 */
ScriptManager.prototype.compileStandaloneComponent = async function (componentId, scriptContent, htmlPayload, cssPayload, mode) {
  const entryCodeParts = []
  const moduleNamespace = 'coralite-script-module:'

  // Generate component imports
  const importMap = {}
  if (scriptContent && scriptContent.imports) {
    for (const imp of scriptContent.imports) {
      const specifier = JSON.stringify(imp.specifier)
      let attrStr = ''
      if (imp.attributes) {
        attrStr = ` with { ${Object.entries(imp.attributes).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')} }`
      }

      if (imp.namespaceExport) {
        entryCodeParts.push(`import * as ${imp.namespaceExport} from ${specifier}${attrStr};\n`)
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
        entryCodeParts.push(`import ${importStr} from ${specifier}${attrStr};\n`)
      }
    }
  }

  // Generate imports object for context injection
  const importsObjContent = Object.keys(importMap).length > 0
    ? `const componentImports = { ${Object.entries(importMap).map(([k, v]) => `${k}: ${v}`).join(', ')} };`
    : 'const componentImports = {};'

  entryCodeParts.push(importsObjContent + '\n')

  // Include cleanKeys utility inline for the standalone artifact
  entryCodeParts.push(`
function kebabToCamel(str) {
  return str.replace(/[-|:]([a-z])/g, function (match, letter) {
    return letter.toUpperCase();
  });
}
function cleanKeys(object) {
  const result = {};
  for (const [key, value] of Object.entries(object)) {
    result[key] = value;
    const camelKey = kebabToCamel(key);
    if (camelKey !== key) {
      result[camelKey] = value;
    }
  }
  return result;
}
`)

  // Include script modules (plugins)
  for (let i = 0; i < this.scriptModules.length; i++) {
    entryCodeParts.push(`import { helpers as helpers_${i}, runSetup as runSetup_${i} } from "${moduleNamespace}${i}";\n`)
  }

  // Setup helpers factory
  const helperParts = [
    ...this.scriptModules.map((_, i) => `...helpers_${i}`),
    this.getHelpersContent()
  ].filter(Boolean).join(',\n')

  entryCodeParts.push(`const coraliteComponentScriptHelpers = {
    ${helperParts}
  };\n`)

  entryCodeParts.push(`const getHelpers = (context) => {
    const helpers = {};
    for (const [key, helper] of Object.entries(coraliteComponentScriptHelpers)) {
      helpers[key] = helper(context);
    }
    return helpers;
  };\n`)

  const setupToInject = scriptContent && scriptContent.setupContent ? scriptContent.setupContent : null
  let cleanSetup = setupToInject

  if (cleanSetup) {
    if (cleanSetup.startsWith('function setup(')) {
      cleanSetup = cleanSetup.replace(/^function setup\(/, 'function(')
    } else if (cleanSetup.startsWith('async function setup(')) {
      cleanSetup = cleanSetup.replace(/^async function setup\(/, 'async function(')
    } else if (cleanSetup.startsWith('export default ')) {
      cleanSetup = cleanSetup.replace(/^export default /, '')
    }
  }

  const setupCode = cleanSetup ? `const componentSetup = ${cleanSetup};\n      const componentSetupResult = await componentSetup(context);` : 'const componentSetupResult = {};'

  entryCodeParts.push(`const getSetups = async (context) => {
    const values = {};
    const results = await Promise.all([
      ${this.scriptModules.map((_, i) => `runSetup_${i}(context)`).join(',\n      ')}
    ]);
    
    ${setupCode}
    if (componentSetupResult && typeof componentSetupResult === 'object') {
      results.push(componentSetupResult);
    }

    for (const res of results) {
      if (res && typeof res === 'object') {
        Object.assign(values, res);
      }
    }
    return values;
  };\n`)

  // Include user component script
  const scriptToInject = scriptContent && scriptContent.content ? scriptContent.content : 'export default function(){}'
  let cleanScript = scriptToInject
  if (cleanScript.startsWith('function script(')) {
    cleanScript = cleanScript.replace(/^function script\(/, 'function(')
  } else if (cleanScript.startsWith('async function script(')) {
    cleanScript = cleanScript.replace(/^async function script\(/, 'async function(')
  } else if (cleanScript.startsWith('export default ')) {
    cleanScript = cleanScript.replace(/^export default /, '')
  }

  entryCodeParts.push(`
  const userComponentFn = (() => {
    // Wrap user script in an IIFE to capture the default export cleanly
    let defaultExport;
    const module = { get exports() { return defaultExport; }, set exports(v) { defaultExport = v; } };
    module.exports = ${cleanScript};
    return defaultExport;
  })();
  `)

  // Web Component Class Definition
  entryCodeParts.push(`
class ${componentId.replace(/[-.:]/g, '_')} extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  async connectedCallback() {
    // 1. Map DOM Attributes to values
    const domAttributes = {};
    for (let i = 0; i < this.attributes.length; i++) {
      const attr = this.attributes[i];
      domAttributes[attr.name] = attr.value;
    }
    const initialValues = cleanKeys(domAttributes);

    // 2. Hydrate Refs
    const refs = {};

    // 3. Setup context
    const context = {
      instanceId: this.id || Math.random().toString(36).substr(2, 9),
      componentId: "${componentId}",
      values: initialValues,
      root: this.shadowRoot,
      imports: componentImports // Standalone imports are bundled within the component
    };

    const setupValues = await getSetups(context);
    context.values = { ...context.values, ...setupValues };
    
    // Inject HTML & CSS payload first so user script can interact with DOM
    let htmlPayload = \`${htmlPayload.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
    const cssPayload = \`${cssPayload.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
    
    // Replace text tokens in the payload (rudimentary support for standalone components without the full AST engine)
    for (const [key, value] of Object.entries(context.values)) {
      const token = \`{{ \${key} }}\`;
      htmlPayload = htmlPayload.split(token).join(value);
    }
    
    let styles = '';
    if (cssPayload) {
      styles = \`<style>\${cssPayload}</style>\`;
    }
    this.shadowRoot.innerHTML = styles + htmlPayload;

    // Post-render ref extraction
    const refElements = this.shadowRoot.querySelectorAll('[ref]');
    refElements.forEach(el => {
      const refName = el.getAttribute('ref');
      // Set an ID dynamically if one doesn't exist to match SSR behavior
      const elId = el.id || \`${componentId}__\${refName}-\${Math.random().toString(36).substr(2, 5)}\`;
      el.id = elId;
      context.values[\`ref_\${refName}\`] = elId;
      el.removeAttribute('ref'); // clean up
    });

    context.helpers = getHelpers(context);

    // 4. Execute User Script
    if (typeof userComponentFn === 'function') {
      await userComponentFn.call(this, context);
    }
  }
}
customElements.define("${componentId}", ${componentId.replace(/[-.:]/g, '_')});
  `)

  // Build via ESBuild
  const result = await build({
    stdin: {
      contents: entryCodeParts.join('').trimEnd(),
      resolveDir: process.cwd(),
      sourcefile: `${componentId}.js`
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
        name: 'coralite-script-module-resolver',
        setup: (pluginBuild) => {
          pluginBuild.onResolve({ filter: new RegExp(`^${moduleNamespace}`) }, args => {
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
            const importMap = {}
            if (module.imports) {
              for (const imp of module.imports) {
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
              ? `const pluginImports = { ${Object.entries(importMap).map(([k, v]) => `${k}: ${v}`).join(', ')} };`
              : 'const pluginImports = {};'

            contents += importsObjContent + '\n'

            const configContent = module.config
              ? `const pluginConfig = ${JSON.stringify(module.config)};`
              : 'const pluginConfig = {};'

            contents += configContent + '\n'

            // Generate setup function
            const setupFn = module.setup ? normalizeFunction(module.setup) : 'null'
            contents += `export const runSetup = async (context) => {
              const setup = ${setupFn};
              if (!setup) return {};
              const ctx = {
                imports: pluginImports,
                config: pluginConfig,
                ...context
              };
              return await setup(ctx);
            };\n`

            // Generate helpers
            contents += 'export const helpers = {\n'
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
    for (const res of results) {
      if (res && typeof res === 'object') {
        Object.assign(values, res);
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

  // Invoke instances
  entryCodeParts.push('\n// Instances\n')
  for (const [instanceId, instanceData] of instanceValues) {
    const context = {
      instanceId,
      componentId: instanceData.componentId,
      values: instanceData.values,
      document: instances[instanceId].document || {}
    }

    entryCodeParts.push(';(async() => {\n')
    entryCodeParts.push('const context = ' + serialize(context) + ';\n')
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
    treeShaking: true,
    sourcemap: mode === 'production' ? false : 'inline',
    minify: mode === 'production',
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

            // Generate setup function
            const setupFn = module.setup ? normalizeFunction(module.setup) : 'null'
            contents += `export const runSetup = async (context) => {
              const setup = ${setupFn};
              if (!setup) return {};
              const ctx = {
                imports: pluginImports,
                config: pluginConfig,
                ...context
              };
              return await setup(ctx);
            };\n`

            // Generate helpers
            contents += 'export const helpers = {\n'
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
