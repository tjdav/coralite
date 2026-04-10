import { dirname, extname, join } from 'node:path'
import { readdir, readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import pLimit from 'p-limit'
import CoraliteCollection from './collection.js'

/**
 * @import {
 *  CoraliteCollectionEventSet,
 *  CoraliteCollectionEventUpdate,
 *  CoraliteCollectionEventDelete } from '../types/index.js'
 */

/**
 * Get HTML
 * @param {Object} options - Options for searching HTML files
 * @param {string} options.path - Path to the directory containing HTML files
 * @param {'page' | 'component'} options.type - Document types
 * @param {boolean} [options.recursive=false] - Whether to search recursively in subdirectories
 * @param {string[]} [options.exclude=[]] - Files or directories to exclude from search
 * @param {CoraliteCollectionEventSet} [options.onFileSet]
 * @param {CoraliteCollectionEventUpdate} [options.onFileUpdate]
 * @param {CoraliteCollectionEventDelete} [options.onFileDelete]
 * @param {CoraliteCollection} [options.collection] - Optional collection instance to populate
 * @param {import('p-limit').LimitFunction} [options.limit] - Optional concurrency limiter
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
  onFileDelete,
  collection,
  limit
}) {
  try {
    if (!collection) {
      collection = new CoraliteCollection({
        rootDir: path,
        onSet: onFileSet,
        onUpdate: onFileUpdate,
        onDelete: onFileDelete
      })
    }

    if (!limit) {
      limit = pLimit(availableParallelism())
    }

    const entries = await readdir(path, { withFileTypes: true })
    const tasks = []

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]

      // Skip hidden files/directories starting with dot
      if (entry.name.startsWith('.')) {
        continue
      }

      const pathname = join(entry.parentPath, entry.name)

      // Calculate relative path from root for exclusion checking
      const relativePath = pathname.replace(path + '/', '')

      // Check if entry should be excluded by: name, relative path, or full path
      const shouldExclude = exclude.includes(entry.name) ||
                           exclude.includes(relativePath) ||
                           exclude.includes(pathname) ||
                           exclude.some(excludePath => {
                             // Handle directory-based exclusions
                             const excludeDir = excludePath.endsWith('/') ? excludePath.slice(0, -1) : excludePath
                             return relativePath.startsWith(excludeDir + '/')
                           })

      if (shouldExclude) {
        continue
      }

      if (entry.isDirectory() && recursive) {
        tasks.push(getHtmlFiles({
          path: pathname,
          type,
          recursive,
          exclude,
          onFileSet,
          onFileUpdate,
          onFileDelete,
          collection,
          limit
        }))
      } else if (entry.isFile() && extname(entry.name).toLowerCase() === '.html') {
        tasks.push(limit(async () => {
          const content = await readFile(pathname, { encoding: 'utf8' })

          await collection.setItem({
            type,
            content,
            path: {
              pathname: pathname,
              filename: entry.name,
              dirname: dirname(pathname)
            }
          })
        }))
      }
    }

    await Promise.all(tasks)

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
export function getHtmlFileSync (pathname) {
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

/**
 * Reads an HTML file and returns its content as a string.
 * @param {string} pathname - The path to the HTML file.
 * @throws {Error} If the file cannot be read.
 */
export async function getHtmlFile (pathname) {
  try {
    const extension = extname(pathname).toLowerCase()

    if (extension === '.html') {
      return await readFile(pathname, 'utf8')
    }

    throw new Error('Unexpected filename extension "' + extension +'"')
  } catch (err) {
    throw err
  }
}
