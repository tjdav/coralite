import { definePlugin } from '../lib/plugin.js'
import { createRequire } from 'node:module'
import { dirname, join, parse } from 'node:path'
import { existsSync } from 'node:fs'
import { cp, mkdir, stat } from 'node:fs/promises'

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
 * @import { CoraliteStaticAsset } from '../types/index.js'
 */

/**
 * Coralite plugin to copy static assets during build
 * @param {CoraliteStaticAsset[]} assets - Static assets to copy during build.
 */
export const staticAssetPlugin = (assets = []) => {
  const inFlight = new Map()

  return definePlugin({
    name: 'static-asset-plugin',
    server: {
      onBeforeBuild: async function (context) {
        const outputDir = context.app.options.output || join(process.cwd(), 'dist')
        const copyTasks = []

        for (const asset of assets) {
          if (!asset.dest) {
            throw new Error('staticAssetPlugin requires assets to have a dest property.')
          }

          const dest = join(outputDir, asset.dest)
          let src = asset.src

          if (!src) {
            if (!asset.pkg || !asset.path) {
              throw new Error('staticAssetPlugin requires assets to have pkg and path state when src is not provided.')
            }

            const require = createRequire(join(process.cwd(), 'package.json'))
            let pkgPath

            try {
              pkgPath = dirname(require.resolve(`${asset.pkg}/package.json`))
            } catch {
              try {
                const resolvedPath = require.resolve(asset.pkg)
                pkgPath = findPackageRoot(dirname(resolvedPath))
              } catch {
                throw new Error(`staticAssetPlugin could not resolve package.json for package: ${asset.pkg}`)
              }
            }

            src = join(pkgPath, asset.path)
          }

          if (inFlight.has(dest)) {
            const active = inFlight.get(dest)
            if (active.src !== src) {
              console.warn(`[staticAssetPlugin] Destination collision: Both "${src}" and "${active.src}" are targeting "${asset.dest}". Only the first one will be processed.`)
            }
            copyTasks.push(active.promise)
            continue
          }

          const performCopy = (async () => {
            try {
              const [srcStat, destStat] = await Promise.all([
                stat(src).catch(() => null),
                stat(dest).catch(() => null)
              ])

              if (!srcStat) {
                console.warn(`[staticAssetPlugin] Source file not found: ${src}`)
                return
              }

              // Only optimize for individual files; directories must always be copied to capture deep changes
              if (srcStat.isFile() && destStat) {
                if (Math.floor(srcStat.mtimeMs) === Math.floor(destStat.mtimeMs) && srcStat.size === destStat.size) {
                  return
                }
              }

              await mkdir(dirname(dest), { recursive: true })
              await cp(src, dest, {
                recursive: true,
                preserveTimestamps: true
              })
            } finally {
              inFlight.delete(dest)
            }
          })()

          inFlight.set(dest, {
            promise: performCopy,
            src
          })
          copyTasks.push(performCopy)
        }

        await Promise.all(copyTasks)
      }
    }
  })
}
