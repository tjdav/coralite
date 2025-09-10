import { dirname, extname, join } from 'node:path'
import { readdirSync, readFileSync } from 'node:fs'
import CoraliteCollection from './collection.js'

/**
 * @import { HTMLData,
 *  CoraliteCollectionEventSet,
 *  CoraliteCollectionEventUpdate,
 *  CoraliteCollectionEventDelete } from '#types'
 */

/**
 * Get HTML
 * @param {Object} options - Options for searching HTML files
 * @param {string} options.path - Path to the directory containing HTML files
 * @param {'page' | 'template'} options.type - Document types
 * @param {boolean} [options.recursive=false] - Whether to search recursively in subdirectories
 * @param {string[]} [options.exclude=[]] - Files or directories to exclude from search
 * @param {CoraliteCollectionEventSet} [options.onFileSet]
 * @param {CoraliteCollectionEventUpdate} [options.onFileUpdate]
 * @param {CoraliteCollectionEventDelete} [options.onFileDelete]
 * @returns {Promise<CoraliteCollection>} Array of HTML file data including parent path, name, and content
 *
 * @example
 * // example usage:
 * const htmlFiles = await getHtmlFiles({
 *   path: 'src',
 *   recursive: true,
 *   exclude: ['index.html', 'subdir/file2.html']
 * })
 */
export async function getHtmlFiles ({
  path,
  type,
  recursive = false,
  exclude = [],
  onFileSet,
  onFileUpdate,
  onFileDelete
}) {
  try {
    const collection = new CoraliteCollection({
      rootDir: path,
      onSet: onFileSet,
      onUpdate: onFileUpdate,
      onDelete: onFileDelete
    })

    const files = readdirSync(path, {
      recursive,
      withFileTypes: true
    })

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      if (file.isFile()
        && extname(file.name).toLowerCase() === '.html'
        && !exclude.includes(file.name)
      ) {
        const pathname = join(file.parentPath, file.name)
        const name = file.name
        const content = readFileSync(pathname, { encoding: 'utf8' })

        await collection.setItem({
          type,
          content,
          path: {
            pathname: pathname,
            filename: name,
            dirname: dirname(pathname)
          }
        })
      }
    }

    return collection
  } catch (error) {
    throw error
  }
}

/**
 * Reads an HTML file and returns its content as a string.
 * @param {string} pathname - The path to the HTML file.
 * @throws {Error} If the file cannot be read.
 */
export function getHtmlFile (pathname) {
  try {
    const extension = extname(pathname).toLowerCase()

    if (extension === '.html') {
      return readFileSync(pathname, 'utf8')
    }

    throw new Error('Unexpected filename extension "' + extension +'"')
  } catch (err) {
    throw err
  }
}
