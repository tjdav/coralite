import { extname, join } from 'node:path'
import { readdir, readFile } from 'node:fs/promises'

/**
 * @typedef {Object} HTMLData
 * @property {string} parentPath - The path to the parent directory of the file.
 * @property {string} name - The file name.
 * @property {string} content - HTML string
 */

/**
 * Get HTML
 * @param {Object} options - html directory
 * @param {string} options.path - html directory
 * @param {boolean} [options.recursive] - If true, reads the contents of a directory recursively. In recursive mode, it will list all files, sub files and directories. Default: false.
 * @param {string[]} [options.exclude = []] - Exclude file by name
 * @returns {Promise<HTMLData[]>}
 */
export default function getHTML ({ path, recursive, exclude = [] }) {
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
            html.push({
              parentPath: file.parentPath,
              name: file.name
            })
            promises.push(readFile(join(file.parentPath, file.name), { encoding: 'utf8' }))
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
