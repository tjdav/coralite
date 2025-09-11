import postcss from 'postcss'
import fs from 'fs/promises'
import path from 'path'

/**
 * @typedef {Object} BuildCssResult
 * @property {string} input - The input file path
 * @property {string} output - The output file path
 * @property {[number, number]} duration - The build duration as high-resolution time array
 */

/**
 * Compiles SCSS files to CSS with source maps
 * @param {Object} options
 * @param {string} options.input - The directory containing SCSS files to compile
 * @param {string} options.output - The output directory for compiled CSS files
 * @param {import('postcss').AcceptedPlugin[]} [options.plugins=[]] - postcss plugins
 * @param {[number, number]} [options.start]
 * @returns {Promise<BuildCssResult[]>} Resolves when all files are compiled
 */
async function buildCSS ({
  input,
  output,
  plugins = [],
  start
}) {
  try {
    // ensure output directory exists
    await fs.mkdir(output, { recursive: true })

    // read all files from src/scss directory
    const cssFiles = await fs.readdir(input)
    const filteredCssFiles = cssFiles.filter(file => file.endsWith('.css'))
    const results = []

    for (const file of filteredCssFiles) {
      const filePath = path.join(input, file)
      const outputFile = path.join(output, file)
      const css = await fs.readFile(filePath)

      const result = await postcss(plugins).process(css, {
        from: filePath,
        to: outputFile
      })

      await fs.writeFile(outputFile, result.css)

      if ( result.map ) {
        await fs.writeFile(outputFile + '.map', result.map.toString())
      }

      results.push({
        input: filePath,
        output: outputFile,
        duration: process.hrtime(start)
      })
    }

    return results
  } catch (error) {
    throw error
  }
}

export default buildCSS
