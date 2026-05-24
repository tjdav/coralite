import { definePlugin } from '../lib/plugin.js'
import { createRequire } from 'node:module'
import { dirname, join, parse } from 'node:path'
import { existsSync } from 'node:fs'
import { cp, mkdir } from 'node:fs/promises'

/**
 * Finds the nearest package.json starting from a given directory.
 * @param {string} startDir - The directory to start searching from.
 * @returns {string} The path to the directory containing package.json.
 * @throws {Error} If package.json is not found up to the root.
 */
function findPackageRoot (startDir) {
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
 * Coralite plugin to copy static assets during build
 * @param {import('../types/index.js').CoraliteStaticAsset[]} assets - Static assets to copy during build.
 */
export const staticAssetPlugin = (assets = []) => {
  return definePlugin({
    name: 'static-asset-plugin',
    server: {
      onBeforeBuild: async function (context) {
        const outputDir = context.app.options.output || join(process.cwd(), 'dist')

        for (const asset of assets) {
          if (!asset.dest) {
            throw new Error('staticAssetPlugin requires assets to have a dest property.')
          }

          const dest = join(outputDir, asset.dest)

          if (asset.src) {
            await mkdir(dirname(dest), { recursive: true })
            await cp(asset.src, dest, { recursive: true })
            continue
          }

          if (!asset.pkg || !asset.path) {
            throw new Error('staticAssetPlugin requires assets to have pkg and path state when src is not provided.')
          }

          const require = createRequire(join(process.cwd(), 'package.json'))
          let pkgPath

          try {
            pkgPath = dirname(require.resolve(`${asset.pkg}/package.json`))
          } catch (e) {
            try {
              const resolvedPath = require.resolve(asset.pkg)
              pkgPath = findPackageRoot(dirname(resolvedPath))
            } catch (resolutionError) {
              throw new Error(`staticAssetPlugin could not resolve package.json for package: ${asset.pkg}`)
            }
          }

          const src = join(pkgPath, asset.path)

          await mkdir(dirname(dest), { recursive: true })
          await cp(src, dest, { recursive: true })
        }
      }
    }
  })
}
