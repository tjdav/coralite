import { resolve } from 'path'
import {
  statSync,
  copyFileSync,
  mkdirSync,
  readdirSync,
  existsSync,
  rmSync
} from 'fs'

/**
 * Formats the target directory path by trimming whitespace and removing trailing slashes
 * @param {string} targetDir - The target directory path to format
 * @returns {string} The formatted directory path
 */
export function formatTargetDir (targetDir) {
  return targetDir.trim().replace(/\/+$/g, '')
}

/**
 * Copies a file or directory from source to destination.
 * @param {string} src - The source path to copy from.
 * @param {string} dest - The destination path to copy to.
 */
export function copy (src, dest) {
  const stat = statSync(src)
  if (stat.isDirectory()) {
    copyDir(src, dest)
  } else {
    copyFileSync(src, dest)
  }
}

/**
 * Validates if a package name is valid according to npm standards.
 *
 * @param {string} projectName - The name of the project/package to validate
 * @returns {boolean} True if the package name is valid, false otherwise
 */
export function isValidPackageName (projectName) {
  return /^(?:@[a-z\d\-*~][a-z\d\-*._~]*\/)?[a-z\d\-~][a-z\d\-._~]*$/.test(
    projectName
  )
}

/**
 * Converts a project name into a valid package name format.
 *
 * This function sanitizes the input projectName by:
 * 1. Trimming whitespace
 * 2. Converting to lowercase
 * 3. Replacing spaces with hyphens
 * 4. Removing leading dots/underscores
 * 5. Replacing invalid characters with hyphens
 *
 * @param {string} projectName - The original project name to convert
 * @returns {string} A valid package name formatted as a kebab-case string
 */
export function toValidPackageName (projectName) {
  return projectName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/^[._]/, '')
    .replace(/[^a-z\d\-~]+/g, '-')
}

/**
 * Copies a directory and all its contents recursively from source to destination.
 * @param {string} srcDir - The source directory path to copy from
 * @param {string} destDir - The destination directory path to copy to
 */
export function copyDir (srcDir, destDir) {
  mkdirSync(destDir, { recursive: true })
  for (const file of readdirSync(srcDir)) {
    const srcFile = resolve(srcDir, file)
    const destFile = resolve(destDir, file)
    copy(srcFile, destFile)
  }
}

/**
 * Checks if a directory is empty, ignoring the .git directory
 * @param {string} path - The directory path to check
 * @returns {boolean} True if the directory is empty or contains only a .git directory
 */
export function isEmpty (path) {
  try {
    const files = readdirSync(path)
    return files.length === 0 || (files.length === 1 && files[0] === '.git')
  } catch (e) {
    return true
  }
}

/**
 * Empties a directory by removing all files and subdirectories within it.
 * Skips the '.git' directory if present.
 *
 * @param {string} dir - The path to the directory to empty
 */
export function emptyDir (dir) {
  if (!existsSync(dir)) {
    return
  }
  for (const file of readdirSync(dir)) {
    if (file === '.git') {
      continue
    }
    rmSync(resolve(dir, file), {
      recursive: true,
      force: true
    })
  }
}

/**
 * Extracts package information from a user agent string
 * @param {string} userAgent - The user agent string to parse
 * @returns {{name: string, version: string} | undefined} Package information object or undefined if not found
 */
export function extractPackageInfoFromUserAgent (userAgent) {
  if (!userAgent) return undefined
  const pkgSpec = userAgent.split(' ')[0]
  const pkgSpecArr = pkgSpec.split('/')
  return {
    name: pkgSpecArr[0],
    version: pkgSpecArr[1]
  }
}
