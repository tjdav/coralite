import Coralite from 'coralite'

/**
 * @import { CoralitePluginInstance } from 'coralite/types'
 */

/**
 * Builds HTML files from Coralite templates and pages.
 *
 * @param {Object} options
 * @param {string} options.pages - Path to pages directory
 * @param {string} options.templates - Path to templates directory
 * @param {string} options.output - Output path for HTML files
 * @param {string} options.output - Output path for HTML files
 * @param {CoralitePluginInstance[]} [options.plugins=[]] - List of Coralite plugins.
 */
export default async function html ({
  pages,
  templates,
  output,
  plugins
}) {
  const coralite = new Coralite({
    templates,
    pages,
    plugins
  })
  await coralite.initialise()

  return {
    /**
     * Compiles the specified HTML pages using coralite and saves the output to the configured output path.
     * @param {string | string[]} [paths] - Path to a single page or array of page paths relative to the pages directory. If omitted, compiles all pages.
     */
    async compile (paths) {
      let relativePathPages

      if (Array.isArray(paths)) {
        relativePathPages = []

        for (let i = 0; i < paths.length; i++) {
          const path = paths[i]

          relativePathPages.push(path.replace(pages + '/', ''))
        }
      } else if (paths) {
        relativePathPages = paths.replace(pages + '/', '')
      }

      if (relativePathPages && relativePathPages[0] === '/') {
        relativePathPages = relativePathPages.slice(1)
      }

      const document = await coralite.compile(relativePathPages)

      await coralite.save(document, output)
    }
  }
}

