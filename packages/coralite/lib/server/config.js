/**
 * @import {CoraliteConfig} from '../../types/index.js'
 */
import { CoraliteError, handleError } from '../shared/errors.js'

/**
 * Validates and defines a Coralite configuration object
 * @param {CoraliteConfig} options - The configuration options to validate and define
 * @param {Object} [context={}] - Optional context containing onError callback
 * @param {Function} [context.onError] - Optional error handler callback
 * @returns {CoraliteConfig} The validated configuration object
 * @throws {Error} If the configuration is invalid
 */
export function defineConfig (options, { onError } = {}) {
  if (onError !== undefined && typeof onError !== 'function') {
    throw new CoraliteError('defineConfig requires "onError" option to be a function if provided')
  }

  // Validate that options is an object
  if (!options || typeof options !== 'object') {
    throw new CoraliteError('Config must be an object')
  }

  // Validate required string state
  const requiredProps = ['output', 'components', 'pages']

  for (const prop of requiredProps) {
    // Check if property exists
    if (!(prop in options)) {
      throw new CoraliteError(`Missing required config property: "${prop}"`)
    }

    // Check if property is a string
    if (typeof options[prop] !== 'string') {
      throw new CoraliteError(
        `Config property "${prop}" must be a string, received ${typeof options[prop]}`
      )
    }

    // Check if property is not empty
    if (options[prop].trim() === '') {
      throw new CoraliteError(`Config property "${prop}" cannot be empty`)
    }
  }

  // Validate urlStyle migration error
  if ('urlStyle' in options) {
    throw new CoraliteError('Config property "urlStyle" has been replaced by "cleanUrls".\nUse cleanUrls: true for directory-style URLs, or cleanUrls: false for file-style.')
  }

  // Validate optional string properties
  if (options.public !== undefined) {
    if (typeof options.public !== 'string') {
      throw new CoraliteError(`Config property "public" must be a string, received ${typeof options.public}`)
    }
    if (options.public.trim() === '') {
      throw new CoraliteError('Config property "public" cannot be empty')
    }
  }

  if (options.baseURL !== undefined && typeof options.baseURL !== 'string') {
    throw new CoraliteError(`Config property "baseURL" must be a string, received ${typeof options.baseURL}`)
  }

  if (options.projectRoot !== undefined && typeof options.projectRoot !== 'string') {
    throw new CoraliteError(`Config property "projectRoot" must be a string, received ${typeof options.projectRoot}`)
  }

  // Validate path property
  if (options.path !== undefined && (typeof options.path !== 'object' || options.path === null)) {
    throw new CoraliteError('Config property "path" must be an object')
  }

  // Validate concurrency
  if (options.concurrency !== undefined && (typeof options.concurrency !== 'number' || options.concurrency <= 0)) {
    throw new CoraliteError('Config property "concurrency" must be a positive number')
  }

  // Validate callbacks
  if (options.onError !== undefined && typeof options.onError !== 'function') {
    throw new CoraliteError('Config property "onError" must be a function')
  }

  if (options.onComponentBuild !== undefined && typeof options.onComponentBuild !== 'function') {
    throw new CoraliteError('Config property "onComponentBuild" must be a function')
  }

  // Validate boolean properties
  const booleanProps = [
    'cleanUrls',
    'viewTransitions',
    'incremental',
    'preserveTestId',
    'suppressValidationWarnings'
  ]

  for (const prop of booleanProps) {
    if (options[prop] !== undefined && typeof options[prop] !== 'boolean') {
      throw new CoraliteError(`Config property "${prop}" must be a boolean, received ${typeof options[prop]}`)
    }
  }

  // Validate enum properties
  if (options.mode !== undefined) {
    const validModes = ['production', 'development', 'testing']
    if (!validModes.includes(options.mode)) {
      throw new CoraliteError(`Invalid mode: "${options.mode}". Valid modes are: ${validModes.join(', ')}`)
    }
  }

  if (options.reactivity !== undefined) {
    const validReactivity = ['signal', 'proxy']
    if (!validReactivity.includes(options.reactivity)) {
      throw new CoraliteError(`Invalid reactivity mode: "${options.reactivity}". Valid reactivity modes are: ${validReactivity.join(', ')}`)
    }
  }

  if (options.reconcile !== undefined) {
    const validReconcile = ['full', 'minimal']
    if (!validReconcile.includes(options.reconcile)) {
      throw new CoraliteError(`Invalid reconcile mode: "${options.reconcile}". Valid reconcile modes are: ${validReconcile.join(', ')}`)
    }
  }

  // Validate compilerOptimizations
  if (options.compilerOptimizations !== undefined) {
    if (typeof options.compilerOptimizations === 'string') {
      const validOptimizations = ['all', 'none']
      if (!validOptimizations.includes(options.compilerOptimizations)) {
        throw new CoraliteError(`Config property "compilerOptimizations" must be "all" or "none", received ${JSON.stringify(options.compilerOptimizations)}`)
      }
    } else if (Array.isArray(options.compilerOptimizations)) {
      for (const item of options.compilerOptimizations) {
        if (typeof item !== 'string') {
          throw new CoraliteError('Config property "compilerOptimizations" array items must be strings')
        }
      }
    } else {
      throw new CoraliteError('Config property "compilerOptimizations" must be "all", "none", or an array of strings')
    }
  }

  // Validate string array properties
  const stringArrayProps = ['externalStyles', 'ignoreTags']
  for (const prop of stringArrayProps) {
    if (options[prop] !== undefined) {
      if (!Array.isArray(options[prop])) {
        throw new CoraliteError(`Config property "${prop}" must be an array of strings`)
      }
      for (const item of options[prop]) {
        if (typeof item !== 'string') {
          throw new CoraliteError(`Config property "${prop}" items must be strings`)
        }
      }
    }
  }

  // Validate attribute filter array properties (ignoreByAttribute, skipRenderByAttribute)
  const attributeFilterProps = ['ignoreByAttribute', 'skipRenderByAttribute']
  for (const prop of attributeFilterProps) {
    if (options[prop] !== undefined) {
      if (!Array.isArray(options[prop])) {
        throw new CoraliteError(`Config property "${prop}" must be an array`)
      }
      for (let i = 0; i < options[prop].length; i++) {
        const item = options[prop][i]
        if (typeof item === 'string') {
          continue
        }
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          throw new CoraliteError(`Config property "${prop}" items must be strings or objects with string "name" and "value" properties`)
        }
        if (typeof item.name !== 'string' || typeof item.value !== 'string') {
          throw new CoraliteError(`Config property "${prop}" items must be strings or objects with string "name" and "value" properties`)
        }
      }
    }
  }

  // Validate script-specific keys (server, styles, build)
  if (options.server !== undefined) {
    if (typeof options.server !== 'object' || options.server === null) {
      throw new CoraliteError('Config property "server" must be an object')
    }
    if (options.server.port !== undefined && (typeof options.server.port !== 'number' || options.server.port <= 0)) {
      throw new CoraliteError('Config property "server.port" must be a positive number')
    }
    if (options.server.host !== undefined && typeof options.server.host !== 'string') {
      throw new CoraliteError('Config property "server.host" must be a string')
    }
  }

  if (options.styles !== undefined) {
    if (typeof options.styles !== 'object' || options.styles === null) {
      throw new CoraliteError('Config property "styles" must be an object')
    }

    // @ts-ignore
    if (typeof options.styles.input === 'string' || options.styles.type !== undefined) {
      throw new CoraliteError('Coralite Config Error: The "styles" configuration has been upgraded. "input" must now be an array, and "type" has been replaced by the "processors" object. Please update your coralite.config.js.')
    }

    if (options.styles.input !== undefined) {
      if (!Array.isArray(options.styles.input)) {
        throw new CoraliteError('Config property "styles.input" must be an array of strings')
      }

      const outputs = new Set()
      for (const input of options.styles.input) {
        if (typeof input !== 'string') {
          throw new CoraliteError('Config property "styles.input" must be an array of strings')
        }

        const ext = input.split('.').pop()
        const filename = input.split('/').pop().replace(`.${ext}`, '.css')

        if (outputs.has(filename)) {
          throw new CoraliteError(`Coralite Build Error: Filename collision detected in styles.input. Multiple inputs will output to "${filename}". Please rename one of the files.`)
        }
        outputs.add(filename)
      }
    }

    if (options.styles.processors !== undefined && (typeof options.styles.processors !== 'object' || options.styles.processors === null)) {
      throw new CoraliteError('Config property "styles.processors" must be an object')
    }
  }

  if (options.build !== undefined) {
    if (typeof options.build !== 'object' || options.build === null) {
      throw new CoraliteError('Config property "build" must be an object')
    }
    if (options.build.concurrency !== undefined && (typeof options.build.concurrency !== 'number' || options.build.concurrency <= 0)) {
      throw new CoraliteError('Config property "build.concurrency" must be a positive number')
    }
  }

  // Validate csp config
  if (options.csp !== undefined) {
    if (typeof options.csp !== 'object' || options.csp === null) {
      throw new CoraliteError('Config property "csp" must be an object')
    }

    if (options.csp.enabled !== undefined && typeof options.csp.enabled !== 'boolean') {
      throw new CoraliteError('Config property "csp.enabled" must be a boolean')
    }

    if (options.csp.nonce !== undefined && typeof options.csp.nonce !== 'string' && typeof options.csp.nonce !== 'function') {
      throw new CoraliteError('Config property "csp.nonce" must be a string or function')
    }

    if (options.csp.hashAlgorithm !== undefined) {
      const validAlgorithms = ['sha256', 'sha384', 'sha512']
      if (!validAlgorithms.includes(options.csp.hashAlgorithm)) {
        throw new CoraliteError(`Invalid csp.hashAlgorithm: "${options.csp.hashAlgorithm}". Valid algorithms are: ${validAlgorithms.join(', ')}`)
      }
    }

    if (options.csp.injectMeta !== undefined && typeof options.csp.injectMeta !== 'boolean') {
      throw new CoraliteError('Config property "csp.injectMeta" must be a boolean')
    }

    if (options.csp.reportOnly !== undefined && typeof options.csp.reportOnly !== 'boolean') {
      throw new CoraliteError('Config property "csp.reportOnly" must be a boolean')
    }

    if (options.csp.externalScripts !== undefined && typeof options.csp.externalScripts !== 'boolean') {
      throw new CoraliteError('Config property "csp.externalScripts" must be a boolean')
    }

    if (options.csp.externalStyles !== undefined && typeof options.csp.externalStyles !== 'boolean') {
      throw new CoraliteError('Config property "csp.externalStyles" must be a boolean')
    }

    if (options.csp.directives !== undefined && (typeof options.csp.directives !== 'object' || options.csp.directives === null)) {
      throw new CoraliteError('Config property "csp.directives" must be an object')
    }
  }

  // Validate testing config
  if (options.testing !== undefined) {
    if (typeof options.testing !== 'object' || options.testing === null) {
      throw new CoraliteError('Config property "testing" must be an object')
    }

    if (options.testing.mocks !== undefined) {
      if (typeof options.testing.mocks !== 'object' || options.testing.mocks === null) {
        throw new CoraliteError('Config property "testing.mocks" must be an object')
      }

      const validMocksKeys = ['components', 'plugins']
      for (const key of Object.keys(options.testing.mocks)) {
        if (!validMocksKeys.includes(key)) {
          throw new CoraliteError(`Invalid key "${key}" in testing.mocks. Valid keys are: ${validMocksKeys.join(', ')}`)
        }
      }

      if (options.testing.mocks.components !== undefined) {
        if (typeof options.testing.mocks.components !== 'object' || options.testing.mocks.components === null) {
          throw new CoraliteError('Config property "testing.mocks.components" must be an object')
        }
        for (const [key, mock] of Object.entries(options.testing.mocks.components)) {
          if (typeof mock !== 'object' || mock === null) {
            throw new CoraliteError(`Mock for component "${key}" must be an object`)
          }
          if (mock.server !== undefined && typeof mock.server !== 'function') {
            throw new CoraliteError(`Mock server for component "${key}" must be a function`)
          }
        }
      }

      if (options.testing.mocks.plugins !== undefined) {
        if (typeof options.testing.mocks.plugins !== 'object' || options.testing.mocks.plugins === null) {
          throw new CoraliteError('Config property "testing.mocks.plugins" must be an object')
        }
        for (const [key, mock] of Object.entries(options.testing.mocks.plugins)) {
          if (typeof mock !== 'object' || mock === null) {
            throw new CoraliteError(`Mock for plugin "${key}" must be an object`)
          }
          if (mock.server !== undefined) {
            if (typeof mock.server !== 'object' || mock.server === null) {
              throw new CoraliteError(`Mock server for plugin "${key}" must be an object`)
            }
            if (mock.server.context !== undefined && (typeof mock.server.context !== 'object' || mock.server.context === null)) {
              throw new CoraliteError(`Mock server context for plugin "${key}" must be an object`)
            }
          }
          if (mock.client !== undefined) {
            if (typeof mock.client !== 'object' || mock.client === null) {
              throw new CoraliteError(`Mock client for plugin "${key}" must be an object`)
            }
            if (mock.client.context !== undefined && (typeof mock.client.context !== 'object' || mock.client.context === null)) {
              throw new CoraliteError(`Mock client context for plugin "${key}" must be an object`)
            }
          }
        }
      }
    }
  }

  // Validate assets config
  if (options.assets !== undefined) {
    if (!Array.isArray(options.assets)) {
      throw new CoraliteError('Config property "assets" must be an array')
    }

    const seenDests = new Set()
    options.assets.forEach((asset, index) => {
      if (!asset || typeof asset !== 'object') {
        throw new CoraliteError(`Asset at index ${index} must be an object`)
      }
      if (!asset.dest || typeof asset.dest !== 'string' || asset.dest.trim() === '') {
        throw new CoraliteError(`Asset at index ${index} must have a non-empty string "dest" property`)
      }

      if (seenDests.has(asset.dest)) {
        handleError({
          onErrorCallback: onError,
          data: {
            level: 'WARN',
            type: 'config_duplicate_asset',
            message: `Duplicate asset destination "${asset.dest}" detected in options.assets. Later entry overrides earlier entry.`
          }
        })
      }
      seenDests.add(asset.dest)

      if (!asset.src && !asset.content) {
        if (!asset.pkg || typeof asset.pkg !== 'string' || !asset.path || typeof asset.path !== 'string') {
          throw new CoraliteError(`Asset at index ${index} ("${asset.dest}") must specify either "src", "content", or both "pkg" and "path"`)
        }
      }

      if (asset.inject !== undefined) {
        if (typeof asset.inject !== 'boolean' && (typeof asset.inject !== 'object' || asset.inject === null)) {
          throw new CoraliteError(`Asset at index ${index} ("${asset.dest}") "inject" property must be a boolean or object`)
        }

        const isKnownExtension = asset.dest.endsWith('.js') || asset.dest.endsWith('.mjs') || asset.dest.endsWith('.cjs') || asset.dest.endsWith('.css')
        let injectType
        if (typeof asset.inject === 'object' && asset.inject !== null) {
          injectType = asset.inject.type
        }
        if (!injectType && !isKnownExtension) {
          throw new CoraliteError(`Asset at index ${index} ("${asset.dest}") has an un-inferable file extension. Explicit "inject.type" ('script', 'link', or 'meta') is required.`)
        }

        if (typeof asset.inject === 'object' && asset.inject !== null) {
          const { type, placement, sri, pages, attributes, rel, name, content } = asset.inject
          const httpEquiv = asset.inject['http-equiv']

          if (type !== undefined && !['script', 'link', 'meta'].includes(type)) {
            throw new CoraliteError(`Asset at index ${index} ("${asset.dest}") "inject.type" must be 'script', 'link', or 'meta'`)
          }
          if (placement !== undefined && !['head-start', 'head-end', 'body-start', 'body-end'].includes(placement)) {
            throw new CoraliteError(`Asset at index ${index} ("${asset.dest}") "inject.placement" must be 'head-start', 'head-end', 'body-start', or 'body-end'`)
          }
          if (sri !== undefined && typeof sri !== 'boolean' && !['sha256', 'sha384', 'sha512'].includes(sri)) {
            throw new CoraliteError(`Asset at index ${index} ("${asset.dest}") "inject.sri" must be a boolean or one of 'sha256', 'sha384', 'sha512'`)
          }
          if (pages !== undefined && typeof pages !== 'string' && !Array.isArray(pages)) {
            throw new CoraliteError(`Asset at index ${index} ("${asset.dest}") "inject.pages" must be a string or array of strings`)
          }
          if (attributes !== undefined && (typeof attributes !== 'object' || attributes === null)) {
            throw new CoraliteError(`Asset at index ${index} ("${asset.dest}") "inject.attributes" must be an object`)
          }

          const effectiveType = type || (asset.dest.endsWith('.css') ? 'link' : 'script')
          if (effectiveType === 'link') {
            const hasRel = Boolean(rel || attributes?.rel || asset.dest.endsWith('.css'))
            if (!hasRel) {
              throw new CoraliteError(`Asset at index ${index} ("${asset.dest}") of type 'link' requires "rel" property (or "attributes.rel")`)
            }
          }
          if (effectiveType === 'meta') {
            const hasIdentifier = Boolean(name || httpEquiv || attributes?.name || attributes?.['http-equiv'])
            const hasContent = Boolean(content || attributes?.content)
            if (!hasIdentifier || !hasContent) {
              throw new CoraliteError(`Asset at index ${index} ("${asset.dest}") of type 'meta' requires "name" or "http-equiv", and "content"`)
            }
          }
        }
      }
    })
  }

  // Validate optional plugins property
  if ('plugins' in options && options.plugins !== undefined) {
    if (!Array.isArray(options.plugins)) {
      throw new CoraliteError(
        `Config property "plugins" must be an array, received ${typeof options.plugins}`
      )
    }

    // Validate each plugin in the array
    options.plugins.forEach((plugin, index) => {
      if (typeof plugin !== 'object' || plugin === null) {
        throw new CoraliteError(
          `Plugin at index ${index} must be an object, received ${typeof plugin}`
        )
      }

      if (typeof plugin.name !== 'string' || plugin.name.trim() === '') {
        throw new CoraliteError(
          `Plugin at index ${index} must have a valid "name" property (non-empty string)`
        )
      }
    })
  }

  // Return full config populated with defaults
  return {
    ...options,
    public: options.public ?? 'public',
    baseURL: options.baseURL ?? '/',
    mode: options.mode ?? 'production',
    cleanUrls: options.cleanUrls ?? true,
    viewTransitions: options.viewTransitions ?? true,
    incremental: options.incremental ?? true,
    reactivity: options.reactivity ?? 'signal',
    compilerOptimizations: options.compilerOptimizations ?? 'all',
    reconcile: options.reconcile ?? 'full',
    plugins: options.plugins ?? [],
    assets: options.assets ?? [],
    csp: options.csp ?? { enabled: false },
    testing: options.testing ?? {},
    externalStyles: options.externalStyles ?? [],
    ignoreByAttribute: options.ignoreByAttribute ?? [],
    skipRenderByAttribute: options.skipRenderByAttribute ?? [],
    ignoreTags: options.ignoreTags ?? [],
    preserveTestId: options.preserveTestId ?? false,
    suppressValidationWarnings: options.suppressValidationWarnings ?? false
  }
}
