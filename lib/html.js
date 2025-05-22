import { extname, join } from 'node:path'
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
 * @template T
 * @param {Object} options - Options for searching HTML files
 * @param {string} options.path - Path to the directory containing HTML files
 * @param {boolean} [options.recursive=false] - Whether to search recursively in subdirectories
 * @param {string[]} [options.exclude=[]] - Files or directories to exclude from search
 * @param {CoraliteCollectionEventSet} [options.onFileSet]
 * @param {CoraliteCollectionEventUpdate} [options.onFileUpdate]
 * @param {CoraliteCollectionEventDelete} [options.onFileDelete]
 * @returns {CoraliteCollection} Array of HTML file data including parent path, name, and content
 *
 * @example
 * // Example usage:
 * const htmlFiles = await getHtmlFiles({
 *   path: 'src',
 *   recursive: true,
 *   exclude: ['index.html', 'subdir/file2.html']
 * })
 */
export function getHtmlFiles ({
  path,
  recursive = false,
  exclude = [],
  onFileSet,
  onFileUpdate,
  onFileDelete
}) {
  try {
    const collection = new CoraliteCollection({
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
        const parentPath = file.parentPath || file.path
        const dirname = parentPath.replace(path, '')
        const name = file.name
        const content = readFileSync(join(parentPath, file.name), { encoding: 'utf8' })

        collection.setItem({
          content,
          path: {
            pathname: join(dirname, name),
            filename: name,
            dirname,
            page: parentPath,
            pageName: join(parentPath, name)
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
