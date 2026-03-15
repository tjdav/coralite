import { createPlugin } from '../lib/plugin.js'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { cp, mkdir } from 'node:fs/promises'

export const staticAssetPlugin = (assets = []) => {
  return createPlugin({
    name: 'static-asset-plugin',
    onBeforeBuild: async function () {
      const outputDir = this.options.output || join(process.cwd(), 'dist')

      for (const asset of assets) {
        if (!asset.pkg || !asset.path || !asset.dest) {
          throw new Error('staticAssetPlugin requires assets to have pkg, path, and dest properties.')
        }

        const require = createRequire(import.meta.url)
        const pkgPath = dirname(require.resolve(`${asset.pkg}/package.json`))

        const src = join(pkgPath, asset.path)
        const dest = join(outputDir, asset.dest)

        await mkdir(dirname(dest), { recursive: true })
        await cp(src, dest, { recursive: true })
      }
    }
  })
}
