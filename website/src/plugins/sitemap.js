import { definePlugin } from 'coralite'
import { join, relative } from 'node:path'
import { stat } from 'node:fs/promises'

/**
 * @typedef {Object} CustomFile
 * @property {string} file - Path to the file relative to the public directory (e.g. 'llms.txt').
 * @property {string} [changefreq='weekly'] - How frequently the page is likely to change.
 * @property {string|number} [priority='0.5'] - The priority of this URL relative to other URLs on your site.
 */

/**
 * @typedef {Object} SitemapPluginOptions
 * @property {string} [origin='https://coralite.dev'] - Canonical origin for generated URLs.
 * @property {CustomFile[]} [customFiles=[]] - Static files from the public directory to include.
 */

/**
 * Sitemap plugin for Coralite.
 * Generates sitemap.xml in the build output directory using the site's clean URLs.
 *
 * @param {SitemapPluginOptions} [options={}] - Canonical origin and extra public files to list.
 */
export default (options = {}) => {
  const origin = options.origin || 'https://coralite.dev'

  return definePlugin({
    name: 'sitemap-plugin',
    server: {
      async onAfterBuild ({ app }) {
        if (app.options.mode === 'development') {
          return
        }

        const pages = new Map()
        const pagesDir = join(app.options.projectRoot || process.cwd(), app.options.pages)

        for (const item of app.pages.list) {
          if (item.virtual || !item.path.pathname.endsWith('.html')) {
            continue
          }

          let pathname = '/' + relative(pagesDir, item.path.pathname).split('\\').join('/')

          if (pathname.includes('/__tests__/')) {
            continue
          }

          if (pathname === '/404.html') {
            continue
          }

          // Convert file paths to the clean URLs produced by the build
          pathname = pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '')

          const pageMeta = item.state?.page?.meta || {}

          if (typeof pageMeta.robots === 'string' && pageMeta.robots.includes('noindex')) {
            continue
          }

          let lastmod = pageMeta.published_time || pageMeta.updated_time

          if (!lastmod) {
            try {
              const stats = await stat(item.path.pathname)
              lastmod = stats.mtime.toISOString()
            } catch {
              lastmod = new Date().toISOString()
            }
          }

          pages.set(pathname, {
            url: `${origin}${pathname}`,
            lastmod,
            changefreq: pageMeta.changefreq || 'weekly',
            priority: pageMeta.priority || '0.5'
          })
        }

        const { customFiles = [] } = options
        const publicDir = join(app.options.projectRoot || process.cwd(), 'public')

        for (const custom of customFiles) {
          if (!custom.file) {
            continue
          }
          const pathname = custom.file.startsWith('/') ? custom.file : `/${custom.file}`
          try {
            const stats = await stat(join(publicDir, custom.file))
            pages.set(pathname, {
              url: `${origin}${pathname}`,
              lastmod: stats.mtime.toISOString(),
              changefreq: custom.changefreq || 'weekly',
              priority: custom.priority || '0.5'
            })
          } catch {
            // Ignore missing custom files
          }
        }

        try {
          let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
          xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

          for (const pathname of Array.from(pages.keys()).sort()) {
            const page = pages.get(pathname)
            xml += '  <url>\n'
            xml += `    <loc>${page.url}</loc>\n`
            xml += `    <lastmod>${page.lastmod}</lastmod>\n`
            xml += `    <changefreq>${page.changefreq}</changefreq>\n`
            xml += `    <priority>${page.priority}</priority>\n`
            xml += '  </url>\n'
          }

          xml += '</urlset>'

          await app.writeFile('sitemap.xml', xml)
        } catch (err) {
          console.error('Failed to write sitemap.xml', err)
        }
      }
    }
  })
}
