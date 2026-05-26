/**
 * @import {CoraliteScriptConfig} from '../types/index.js'
 */

/**
 * Defines the Coralite configuration for the project.
 *
 * This function validates and returns the provided configuration object,
 * ensuring it conforms to the expected structure for a Coralite script setup.
 *
 * @param {CoraliteScriptConfig} options - The configuration options for Coralite
 * @returns {CoraliteScriptConfig} The validated configuration object
 *
 * @example
 * ```js
 * import { defineConfig } from 'coralite-scripts'
 *
 * export default defineConfig({
 *   output: './dist',
 *   components: './src/components',
 *   pages: './src/pages',
 *   public: './public',
 *   server: {
 *     port: 3000
 *   },
 *   styles: {
 *     type: 'scss',
 *     input: './src/styles/main.scss'
 *   },
 *   assets: [
 *     { pkg: 'some-package', path: 'dist/asset.js', dest: 'assets/asset.js' }
 *   ]
 * })
 * ```
 */
export function defineConfig (options) {
  // Validate required properties for CoraliteConfig
  if (!options || typeof options !== 'object') {
    throw new Error('Configuration must be a valid object')
  }

  if (!options.output || typeof options.output !== 'string') {
    throw new Error('Configuration must contain a valid "output" property')
  }

  if (!options.components || typeof options.components !== 'string') {
    throw new Error('Configuration must contain a valid "components" property')
  }

  if (!options.pages || typeof options.pages !== 'string') {
    throw new Error('Configuration must contain a valid "pages" property')
  }

  // Validate optional server configuration
  if (options.server && typeof options.server !== 'object') {
    throw new Error('Configuration "server" must be an object')
  }

  if (options.server?.port && (typeof options.server.port !== 'number' || options.server.port <= 0)) {
    throw new Error('Configuration "server.port" must be a positive number')
  }

  // Validate styles configuration
  if (options.styles) {
    if (typeof options.styles !== 'object') {
      throw new Error('Configuration "styles" must be an object')
    }

    if (options.styles.input) {
      if (typeof options.styles.input === 'string') {
        throw new Error('Coralite Config Error: The "styles" configuration has been upgraded. "input" must now be an array, and "type" has been replaced by the "processors" object. Please update your coralite.config.js.')
      }

      if (!Array.isArray(options.styles.input)) {
        throw new Error('Configuration "styles.input" must be an array of strings')
      }

      const outputs = new Set()
      for (const input of options.styles.input) {
        if (typeof input !== 'string') {
          throw new Error('Configuration "styles.input" must be an array of strings')
        }

        const ext = input.split('.').pop()
        const filename = input.split('/').pop().replace(`.${ext}`, '.css')

        if (outputs.has(filename)) {
          throw new Error(`Coralite Build Error: Filename collision detected in styles.input. Multiple inputs will output to "${filename}". Please rename one of the files.`)
        }
        outputs.add(filename)
      }
    }

    if (options.styles.type) {
      throw new Error('Coralite Config Error: The "styles" configuration has been upgraded. "input" must now be an array, and "type" has been replaced by the "processors" object. Please update your coralite.config.js.')
    }

    if (options.styles.processors && typeof options.styles.processors !== 'object') {
      throw new Error('Configuration "styles.processors" must be an object')
    }
  }

  // Validate assets path
  if (!options.public || typeof options.public !== 'string') {
    throw new Error('Configuration must contain a valid "public" property')
  }

  if (options.ignoreByAttribute) {
    if (!Array.isArray(options.ignoreByAttribute)) {
      throw new Error('Configuration "ignoreByAttribute" must be an array')
    }

    for (let i = 0; i < options.ignoreByAttribute.length; i++) {
      const item = options.ignoreByAttribute[i]
      if (typeof item === 'string') {
        continue
      }
      if (!item || typeof item !== 'object') {
        throw new Error('Configuration "ignoreByAttribute" items must be strings or objects')
      }
      if (typeof item.name !== 'string') {
        throw new Error('Configuration "ignoreByAttribute" items must have a string "name" property')
      }
      if (typeof item.value !== 'string') {
        throw new Error('Configuration "ignoreByAttribute" items must have a string "value" property')
      }
    }
  }

  if (options.skipRenderByAttribute) {
    if (!Array.isArray(options.skipRenderByAttribute)) {
      throw new Error('Configuration "skipRenderByAttribute" must be an array')
    }

    for (let i = 0; i < options.skipRenderByAttribute.length; i++) {
      const item = options.skipRenderByAttribute[i]
      if (typeof item === 'string') {
        continue
      }
      if (!item || typeof item !== 'object') {
        throw new Error('Configuration "skipRenderByAttribute" items must be strings or objects')
      }
      if (typeof item.name !== 'string') {
        throw new Error('Configuration "skipRenderByAttribute" items must have a string "name" property')
      }
      if (typeof item.value !== 'string') {
        throw new Error('Configuration "skipRenderByAttribute" items must have a string "value" property')
      }
    }
  }

  if (options.assets) {
    if (!Array.isArray(options.assets)) {
      throw new Error('Configuration "assets" must be an array')
    }
  }

  return options
}
