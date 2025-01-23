import { extname, join } from 'node:path'
import { readdir, readFile } from 'node:fs/promises'

/**
 * @import { HTMLData } from '#types'
 */

/**
 * Get HTML
 * @param {Object} options - Options for searching HTML files
 * @param {string} options.path - Path to the directory containing HTML files
 * @param {boolean} [options.recursive=false] - Whether to search recursively in subdirectories
 * @param {string[]} [options.exclude=[]] - Files or directories to exclude from search
 * @returns {Promise<HTMLData[]>} Array of HTML file data including parent path, name, and content
 *
 * @example
 * // Example usage:
 * const htmlFiles = await getHTML({
 *  path: 'src',
 *  recursive: true,
 *  exclude: ['index.html', 'subdir/file2.html']
 * })
 */
export default function getHTML ({ path, recursive = false, exclude = [] }) {
  return new Promise((resolve, reject) => {
    const html = []

    readdir(path, {
      recursive,
      withFileTypes: true
    })
      .then(files => {
        const promises = []
        for (let i = 0; i < files.length; i++) {
          const file = files[i]

          if (file.isFile()
            && extname(file.name).toLowerCase() === '.html'
            && !exclude.includes(file.name)
          ) {
            const parentPath = file.parentPath || file.path

            html.push({
              parentPath,
              name: file.name
            })

            promises.push(readFile(join(parentPath, file.name), { encoding: 'utf8' }))
          }
        }

        Promise.all(promises)
          .then(results => {
            for (let i = 0; i < results.length; i++) {
              html[i].content = results[i]
            }

            resolve(html)
          })
          .catch(error => reject(error))
      })
      .catch(error => reject(error))
  })
}
