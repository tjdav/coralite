import sass from 'sass'
import fs from 'fs/promises'
import path from 'path'

/**
 * @import {Options} from 'sass'
 */

/**
 * Compiles SCSS files to CSS with source maps
 * @param {Object} options
 * @param {string} options.input - The directory containing SCSS files to compile
 * @param {string} options.output - The output directory for compiled CSS files
 * @param {Options<'async'>} [options.options] - Sass compile options
 * @returns {Promise<void>} Resolves when all files are compiled
 */
export default async function buildSass ({
  input,
  output,
  options = {
    sourceMap: true,
    loadPaths: ['node_modules'],
    silenceDeprecations: [
      'color-functions',
      'mixed-decls',
      'import',
      'global-builtin'
    ]
  }
}) {
  try {
    // ensure output directory exists
    await fs.mkdir(output, { recursive: true })

    // read all files from src/scss directory
    const scssFiles = await fs.readdir(input)
    const filteredScssFiles = scssFiles.filter(file => file.endsWith('.scss') && file[0] !== '_')

    for (const file of filteredScssFiles) {
      const filePath = path.join(input, file)
      const outputFile = path.join(output, file.replace('.scss', '.css'))

      const result = await sass.compileAsync(filePath, options)

      // write the compiled CSS
      await fs.writeFile(outputFile, result.css)

      // write source map if enabled
      if (result.sourceMap) {
        const sourceMapPath = outputFile + '.map'
        await fs.writeFile(sourceMapPath, JSON.stringify(result.sourceMap))
      }
    }
  } catch (error) {
    throw error
  }
}
