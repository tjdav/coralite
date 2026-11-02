import { dirname, extname, join } from 'node:path'
import { readdir, readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import pLimit from 'p-limit'
import picomatch from 'picomatch'
import CoraliteCollection from '../collection.js'
import { CoraliteError } from '../../shared/errors.js'

/**
 * Default patterns excluded from page and component discovery in production mode
 */
export const DEFAULT_TEST_EXCLUSIONS = [
  '**/__test__/**',
  '**/__tests__/**',
  '**/*.test.html',
  '**/*.spec.html',
  '**/*.fixture.html',
  '__test__',
  '__tests__'
]

export const DEFAULT_PAGE_EXCLUSIONS = DEFAULT_TEST_EXCLUSIONS

/**
 * Checks whether a directory entry matches any exclusion rule.
 *
 * @param {import('node:fs').Dirent} entry - The directory entry
 * @param {string} relativePath - Path relative to root search directory
 * @param {string} pathname - Absolute or full path
 * @param {string[]} exclude - List of exclusion patterns
 * @param {Array<(path: string) => boolean>} [globMatchers] - Precompiled picomatch matchers
 * @returns {boolean} Whether the path is excluded
 */
function isPathExcluded (entry, relativePath, pathname, exclude, globMatchers = []) {
  if (!exclude || exclude.length === 0) {
    return false
  }

  if (exclude.includes(entry.name) || exclude.includes(relativePath) || exclude.includes(pathname)) {
    return true
  }

  for (let j = 0; j < exclude.length; j++) {
    const excludePath = exclude[j]
    const excludeDir = excludePath.endsWith('/') ? excludePath.slice(0, -1) : excludePath
    if (relativePath === excludeDir || relativePath.startsWith(excludeDir + '/')) {
      return true
    }
  }

  for (let j = 0; j < globMatchers.length; j++) {
    const isMatch = globMatchers[j]
    if (isMatch(relativePath) || isMatch(entry.name) || isMatch(pathname)) {
      return true
    }
  }

  return false
}

/**
 * @import {
 *  CoraliteCollectionEventSet,
 *  CoraliteCollectionEventUpdate,
 *  CoraliteCollectionEventDelete } from '../../../types/index.js'
 * @import { LimitFunction } from 'p-limit'
 */

/**
 * Get HTML
 * @param {Object} options - Options for searching HTML files
 * @param {string} options.path - Path to the directory containing HTML files
 * @param {'page' | 'component'} options.type - Document types
 * @param {boolean} [options.recursive=false] - Whether to search recursively in subdirectories
 * @param {string[]} [options.exclude=[]] - Files or directories to exclude from search
 * @param {CoraliteCollectionEventSet} [options.onFileSet] - The callback triggered when a file is set in the collection.
 * @param {CoraliteCollectionEventUpdate} [options.onFileUpdate] - The callback triggered when a file is updated in the collection.
 * @param {CoraliteCollectionEventDelete} [options.onFileDelete] - The callback triggered when a file is deleted from the collection.
 * @param {CoraliteCollection} [options.collection] - Optional collection instance to populate
 * @param {LimitFunction} [options.limit] - Optional concurrency limiter
 * @param {boolean} [options.discoverOnly=false] - Whether to skip reading file content and only discover paths
 * @param {string} [options.rootPath] - Optional root path to calculate relative paths for exclusions
 * @param {Array<(path: string) => boolean>} [options.globMatchers] - Optional precompiled picomatch matchers
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
  discoverOnly = false,
  onFileSet,
  onFileUpdate,
  onFileDelete,
  collection,
  limit,
  rootPath = path,
  globMatchers = null
}) {
  const resultCollection = collection || new CoraliteCollection({
    rootDir: path,
    onSet: onFileSet,
    onUpdate: onFileUpdate,
    onDelete: onFileDelete
  })

  const taskLimit = limit || pLimit(availableParallelism())
  const compiledMatchers = globMatchers || exclude
    .filter(p => typeof p === 'string' && (p.includes('*') || p.includes('?')))
    .map(p => picomatch(p, { dot: true }))

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
    const relativePath = pathname.replace(rootPath + '/', '')

    if (isPathExcluded(entry, relativePath, pathname, exclude, compiledMatchers)) {
      continue
    }

    if (entry.isDirectory() && recursive) {
      tasks.push(getHtmlFiles({
        path: pathname,
        type,
        recursive,
        exclude,
        discoverOnly,
        onFileSet,
        onFileUpdate,
        onFileDelete,
        collection: resultCollection,
        limit: taskLimit,
        rootPath,
        globMatchers: compiledMatchers
      }))
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === '.html') {
      tasks.push(taskLimit(async () => {
        const content = discoverOnly ? undefined : await readFile(pathname, { encoding: 'utf8' })

        await resultCollection.setItem({
          type,
          content,
          virtual: false,
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

  return resultCollection
}

/**
 * Generator that yields HTML files found in a directory.
 * Useful for lazy discovery and memory-efficient processing of many files.
 *
 * @param {Object} options - Options for searching HTML files
 * @param {string} options.path - Path to the directory containing HTML files
 * @param {'page' | 'component'} options.type - Document types
 * @param {boolean} [options.recursive=false] - Whether to search recursively
 * @param {string[]} [options.exclude=[]] - Files or directories to exclude
 * @param {boolean} [options.discoverOnly=false] - Whether to skip reading file content
 * @param {string} [options.rootPath] - Optional root path to calculate relative paths for exclusions
 * @param {Array<(path: string) => boolean>} [options.globMatchers] - Optional precompiled picomatch matchers
 * @yields {Promise<{ type: 'page' | 'component', content: string | undefined, path: { pathname: string, filename: string, dirname: string } }>}
 */
export async function* discoverHtmlFiles ({
  path,
  type,
  recursive = false,
  exclude = [],
  discoverOnly = false,
  rootPath = path,
  globMatchers = null
}) {
  const compiledMatchers = globMatchers || exclude
    .filter(p => typeof p === 'string' && (p.includes('*') || p.includes('?')))
    .map(p => picomatch(p, { dot: true }))

  const entries = await readdir(path, { withFileTypes: true })

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]

    if (entry.name.startsWith('.')) {
      continue
    }

    const pathname = join(entry.parentPath, entry.name)
    const relativePath = pathname.replace(rootPath + '/', '')

    if (isPathExcluded(entry, relativePath, pathname, exclude, compiledMatchers)) {
      continue
    }

    if (entry.isDirectory() && recursive) {
      yield* discoverHtmlFiles({
        path: pathname,
        type,
        recursive,
        exclude,
        discoverOnly,
        rootPath,
        globMatchers: compiledMatchers
      })
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === '.html') {
      const content = discoverOnly ? undefined : await readFile(pathname, { encoding: 'utf8' })

      yield {
        type,
        content,
        virtual: false,
        path: {
          pathname: pathname,
          filename: entry.name,
          dirname: dirname(pathname)
        }
      }
    }
  }
}

/**
 * Reads an HTML file synchronously and returns its content as a string.
 * @deprecated Note: This function blocks the Node.js event loop during synchronous file I/O.
 * Prefer using the asynchronous {@link getHtmlFile} for non-blocking performance where possible.
 * @param {string} pathname - The path to the HTML file.
 * @throws {Error} If the file cannot be read.
 */
export function getHtmlFileSync (pathname) {
  try {
    const extension = extname(pathname).toLowerCase()

    if (extension === '.html') {
      return readFileSync(pathname, 'utf8')
    }

    throw new CoraliteError('Unexpected filename extension "' + extension +'"', {
      filePath: pathname
    })
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

    throw new CoraliteError('Unexpected filename extension "' + extension +'"', {
      filePath: pathname
    })
  } catch (err) {
    throw err
  }
}
