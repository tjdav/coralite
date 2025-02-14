import { readFile } from 'node:fs/promises'

/**
 * @typedef {Object} PackageJson
 * @property {string} name
 * @property {string} description
 * @property {string} version
 */

/**
 * Get package.json
 * @return {Promise<PackageJson>}
 */
export async function getPkg () {
  try {
    const pkgPath = await readFile(new URL('../package.json', import.meta.url), { encoding: 'utf8' })

    return JSON.parse(pkgPath)
  } catch (err) {
    console.error(err.message)
  }
}
