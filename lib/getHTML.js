import { extname } from 'node:path'
import { readdir, readFile } from 'node:fs/promises'

/**
 * @typedef {Object} HTMLData
 * @property {string} parentPath - The path to the parent directory of the file.
 * @property {string} name - The file name.
 * @property {string} data - HTML string
 */

/**
 * Get HTML
 * @param {string} path - html directory
 * @returns {Promise<HTMLData[]>}
 */
export default function getHTML (path) {
  return new Promise((resolve, reject) => {
    const html = []
    
    readdir(path, {
      recursive: true,
      withFileTypes: true
    })
      .then(files => {
        const promises = []
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          
          if (file.isFile() && extname(file.name).toLowerCase() === '.html') {
            html.push({
              parentPath: file.parentPath,
              name: file.name
            })
            promises.push(readFile(file.name, { encoding: 'utf8' }))
          }
        }

        Promise.all(promises)
          .then(results => {
            for (let i = 0; i < results.length; i++) {
              html[i].data = results[i]
            }

            resolve(html)
          })
          .catch(error =>  reject(error))
      })
      .catch(error =>  reject(error))
  })
}
