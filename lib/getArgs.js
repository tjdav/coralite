/**
 * @typedef {Object} SimpleTemplatePath
 * @property {string} templates - location of templates
 * @property {string} pages - location of pages
 * @property {string} output - location for compiled pages
 */

/**
 * Get cli arguments
 * @returns {SimpleTemplatePath}
 */
function getArgs () {
  let templates, pages, output

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i]

    if (arg.startsWith('--help')) {
      // give help commands
    } else if (arg.startsWith('--templates=')) {
      templates = arg.substring(11)
    } else if (arg.startsWith('--pages=')) {
      pages = arg.substring(6)
    } else if (arg.startsWith('--website=')) {
      output = arg.substring(8)
    }
  }


  if (!templates) {
    throw new Error('Could not find "templates" option')
  }

  if (!pages) {
    throw new Error('Could not find "pages" option')
  }

  if (!output) {
    throw new Error('Could not find "output" option')
  }

  return {
    templates,
    pages,
    output
  }
}

export default getArgs
