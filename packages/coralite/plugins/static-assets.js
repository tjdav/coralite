import { definePlugin } from '../lib/server/plugin/define.js'
import { dirname, join, isAbsolute } from 'node:path'
import { cp, mkdir, stat } from 'node:fs/promises'
import { resolvePackageFile } from '../lib/server/utils/package.js'

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
        const projectRoot = context.app.options.projectRoot || process.cwd()
        const outputDir = context.app.options.output || join(projectRoot, 'dist')
        const copyTasks = []

        for (const asset of assets) {
          if (!asset.dest) {
            throw new Error('staticAssetPlugin requires assets to have a dest property.')
          }

          const dest = isAbsolute(asset.dest) ? asset.dest : join(outputDir, asset.dest)
          let src = asset.src

          if (src && !isAbsolute(src)) {
            src = join(projectRoot, src)
          }

          if (!src) {
            if (!asset.pkg || !asset.path) {
              throw new Error('staticAssetPlugin requires assets to have pkg and path state when src is not provided.')
            }

            src = resolvePackageFile(asset.pkg, asset.path, projectRoot)
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
