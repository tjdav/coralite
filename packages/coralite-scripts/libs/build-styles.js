import * as sass from 'sass'
import postcss from 'postcss'
import fs from 'fs/promises'
import path from 'path'

/**
 * @typedef {Object} BuildStylesResult
 * @property {string} input - The input file path
 * @property {string} output - The output file name
 * @property {[number, number]} duration - The build duration as high-resolution time array
 */

/**
 * Compiles SCSS and CSS files with optional PostCSS processing
 * @param {Object} options
 * @param {string[]} options.input - Array of input file paths
 * @param {string} options.output - Output directory for compiled CSS files
 * @param {Object} [options.processors] - Processor configurations
 * @param {import('sass').Options<'async'>} [options.processors.scss] - Sass options
 * @param {Object} [options.processors.postcss] - PostCSS options
 * @param {import('postcss').AcceptedPlugin[]} [options.processors.postcss.plugins] - PostCSS plugins
 * @returns {Promise<BuildStylesResult[]>}
 */
async function buildStyles ({
  input,
  output,
  processors = {}
}) {
  const scssOptions = {
    sourceMap: true,
    loadPaths: ['node_modules'],
    silenceDeprecations: [
      'color-functions',
      'import',
      'global-builtin',
      'elseif'
    ],
    ...processors.scss
  }

  const postcssPlugins = processors.postcss?.plugins || []

  const results = await Promise.all(input.map(async (filePath) => {
    const fileStart = process.hrtime()
    const ext = path.extname(filePath)
    const fileName = path.basename(filePath, ext) + '.css'
    const outputFile = path.join(output, fileName)

    let css
    let map

    if (ext === '.scss' || ext === '.sass') {
      const result = await sass.compileAsync(filePath, scssOptions)
      css = result.css
      map = result.sourceMap
    } else if (ext === '.css') {
      css = await fs.readFile(filePath, 'utf-8')
    } else {
      return null
    }

    if (postcssPlugins.length > 0) {
      const postcssOptions = {
        from: filePath,
        to: outputFile,
        map: map ? { prev: map } : true
      }
      const result = await postcss(postcssPlugins).process(css, postcssOptions)
      css = result.css
      map = result.map
    }

    const duration = process.hrtime(fileStart)

    await fs.mkdir(output, { recursive: true })
    await fs.writeFile(outputFile, css)

    if (map) {
      const mapPath = outputFile + '.map'
      await fs.writeFile(mapPath, typeof map === 'string' ? map : JSON.stringify(map))
    }

    return {
      input: filePath,
      output: fileName,
      duration
    }
  }))

  return results.filter(Boolean)
}

export default buildStyles
