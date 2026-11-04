import { createRequire } from 'node:module'
import { dirname, join, parse, isAbsolute } from 'node:path'
import { existsSync } from 'node:fs'

/**
 * Finds the nearest package.json starting from a given directory.
 *
 * @param {string} startDir - The directory to start searching from.
 * @returns {string} The path to the directory containing package.json.
 * @throws {Error} If package.json is not found up to the root.
 */
export function findPackageRoot (startDir) {
  let currentDir = startDir
  const rootDir = parse(currentDir).root

  while (currentDir !== rootDir) {
    if (existsSync(join(currentDir, 'package.json'))) {
      return currentDir
    }
    currentDir = dirname(currentDir)
  }

  throw new Error('package.json not found')
}

/**
 * Resolves a package-relative file path from a project or source directory.
 *
 * @param {string} pkg - The package name.
 * @param {string} filePath - The path inside the package.
 * @param {string} fromDir - The directory used to resolve the package.
 * @returns {string} The absolute resolved file path.
 */
export function resolvePackageFile (pkg, filePath, fromDir) {
  const require = createRequire(join(fromDir, 'package.json'))
  let pkgPath

  try {
    pkgPath = dirname(require.resolve(`${pkg}/package.json`))
  } catch {
    try {
      const resolvedPath = require.resolve(pkg)
      pkgPath = findPackageRoot(dirname(resolvedPath))
    } catch {
      throw new Error(`Could not resolve package.json for package: ${pkg}`)
    }
  }

  return join(pkgPath, filePath)
}

/**
 * Splits a bare package specifier into its package name and subpath.
 *
 * @param {string} specifier - Bare package specifier.
 * @returns {{ pkg: string, subpath: string }} Package name and subpath.
 */
function splitPackageSpecifier (specifier) {
  const parts = specifier.split('/')
  const pkg = specifier.startsWith('@')
    ? parts.slice(0, 2).join('/')
    : parts[0]
  const subpath = specifier.slice(pkg.length + 1)
  return {
    pkg,
    subpath
  }
}

/**
 * Resolves a file specifier relative to a source file, supporting packages
 * whose `exports` map does not expose the requested file.
 *
 * @param {string} specifier - Bare, relative, or absolute specifier.
 * @param {string} fromFile - The declaring component or page file.
 * @returns {string} The absolute resolved file path.
 */
export function resolveFileSpecifier (specifier, fromFile) {
  if (isAbsolute(specifier)) {
    return specifier
  }

  if (specifier.startsWith('.')) {
    return join(dirname(fromFile), specifier)
  }

  const require = createRequire(fromFile)

  try {
    return require.resolve(specifier)
  } catch (error) {
    const { pkg, subpath } = splitPackageSpecifier(specifier)
    if (!pkg || !subpath) {
      throw error
    }

    try {
      const pkgRoot = resolvePackageFile(pkg, '', dirname(fromFile))
      const candidate = join(pkgRoot, subpath)
      if (existsSync(candidate)) {
        return candidate
      }
    } catch {
      /* fall through to the original resolution error */
    }

    throw error
  }
}

export default {}
