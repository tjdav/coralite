import { createPlugin } from '../lib/plugin.js'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import { cp, mkdir } from 'node:fs/promises'

/**
 * Coralite plugin to copy static assets during build
 * @param {import('../types/index.js').CoraliteStaticAsset[]} assets - Static assets to copy during build.
 */
export const staticAssetPlugin = (assets = []) => {
  return createPlugin({
    name: 'static-asset-plugin',
    onBeforeBuild: async function () {
      const outputDir = this.options.output || join(process.cwd(), 'dist')

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
          throw new Error('staticAssetPlugin requires assets to have pkg and path properties when src is not provided.')
        }

        const require = createRequire(import.meta.url)
        let pkgPath

        try {
          pkgPath = dirname(require.resolve(`${asset.pkg}/package.json`))
        } catch (e) {
          pkgPath = dirname(require.resolve(asset.pkg))

          while (pkgPath !== '/' && !existsSync(join(pkgPath, 'package.json'))) {
            pkgPath = dirname(pkgPath)
          }

          if (pkgPath === '/') {
            throw new Error(`staticAssetPlugin could not resolve package.json for package: ${asset.pkg}`)
          }
        }

        const src = join(pkgPath, asset.path)

        await mkdir(dirname(dest), { recursive: true })
        await cp(src, dest, { recursive: true })
      }
    }
  })
}
