import * as sass from 'sass'
import fs from 'fs/promises'
import path from 'path'

/**
 * @import {Options} from 'sass'
 */

/**
 * @typedef {Object} BuildSassResult
 * @property {string} input - The input file path
 * @property {string} output - The output file path
 * @property {[number, number]} duration - The build duration as high-resolution time array
 */

/**
 * Compiles SCSS files to CSS with source maps
 * @param {Object} options
 * @param {string} options.input - The directory containing SCSS files to compile
 * @param {string} options.output - The output directory for compiled CSS files
 * @param {Options<'async'>} [options.options] - Sass compile options
 * @param {[number, number]} [options.start]
 * @returns {Promise<BuildSassResult[]>} Resolves when all files are compiled
 */
async function buildSass ({
  input,
  output,
  options = {
    sourceMap: true,
    loadPaths: ['node_modules'],
    silenceDeprecations: [
      'color-functions',
      'import',
      'global-builtin'
    ]
  },
  start
}) {
  try {
    // ensure output directory exists
    await fs.mkdir(output, { recursive: true })

    // read all files from src/scss directory
    const scssFiles = await fs.readdir(input)
    const filteredScssFiles = scssFiles.filter(file => file.endsWith('.scss') && file[0] !== '_')
    const results = []

    for (const file of filteredScssFiles) {
      const filePath = path.join(input, file)
      const outputFile = path.join(output, file.replace('.scss', '.css'))

      const result = await sass.compileAsync(filePath, options)

      results.push({
        input: filePath,
        output: outputFile,
        duration: process.hrtime(start)
      })

      // write the compiled CSS
      await fs.writeFile(outputFile, result.css)

      // write source map if enabled
      if (result.sourceMap) {
        const sourceMapPath = outputFile + '.map'
        await fs.writeFile(sourceMapPath, JSON.stringify(result.sourceMap))
      }
    }

    return results
  } catch (error) {
    throw error
  }
}

export default buildSass
