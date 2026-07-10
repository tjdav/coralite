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
 * @property {CustomFile[]} [customFiles=[]] - List of custom static files from the public directory to include in the sitemap.
 */

/**
 * Sitemap plugin for Coralite.
 * Generates a sitemap.xml file in the build output directory.
 *
 * @param {SitemapPluginOptions} [options={}] - Options for the sitemap plugin.
 */
export default (options = {}) => {
  return definePlugin({
    name: 'sitemap-plugin',
    server: {
      async onAfterBuild ({ app }) {
        if (app.options.mode === 'development') {
          return
        }

        const pages = new Map()
        const pagesDir = join(app.options.projectRoot || process.cwd(), app.options.pages)

        // Iterate over all discovered pages in the collection
        for (const item of app.pages.list) {
          // Exclude virtual pages and ensure we only process HTML files
          if (item.virtual || !item.path.pathname.endsWith('.html')) {
            continue
          }

          // Calculate path relative to the pages source directory
          const pathname = '/' + relative(pagesDir, item.path.pathname).split('\\').join('/')

          // Exclude 404 page
          if (pathname === '/404.html') {
            continue
          }

          const pageMeta = item.state?.page?.meta || {}
          let lastmod = pageMeta.published_time || pageMeta.updated_time

          if (!lastmod) {
            try {
              const stats = await stat(item.path.pathname)
              lastmod = stats.mtime.toISOString()
            } catch {
              // Fallback to current date if stat fails
              lastmod = new Date().toISOString()
            }
          }

          pages.set(pathname, {
            url: `https://coralite.dev${pathname}`,
            lastmod,
            changefreq: pageMeta.changefreq || 'weekly',
            priority: pageMeta.priority || '0.5'
          })
        }

        // Include any custom files specified in options
        const { customFiles = [] } = options
        const publicDir = join(app.options.projectRoot || process.cwd(), 'public')

        for (const custom of customFiles) {
          if (!custom.file) {
            continue
          }
          const fileName = custom.file
          const pathname = fileName.startsWith('/') ? fileName : `/${fileName}`
          const filePath = join(publicDir, fileName)

          try {
            const stats = await stat(filePath)
            pages.set(pathname, {
              url: `https://coralite.dev${pathname}`,
              lastmod: stats.mtime.toISOString(),
              changefreq: custom.changefreq || 'weekly',
              priority: custom.priority || '0.5'
            })
          } catch {
            // Ignore if file doesn't exist
          }
        }

        try {
          let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
          xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

          // Sort pages by pathname for consistent output
          const sortedPathnames = Array.from(pages.keys()).sort()

          for (const pathname of sortedPathnames) {
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
