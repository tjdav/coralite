import { definePlugin } from 'coralite'
import { join, relative } from 'node:path'
import { writeFile, mkdir, stat } from 'node:fs/promises'


/**
 *
 */
export default () => {
  const pages = new Map()

  return definePlugin({
    name: 'sitemap-plugin',
    server: {
      onBeforeBuild: () => {
        pages.clear()
      },
      onPageSet: async ({ page, data, app }) => {
        if (app.options.mode === 'development') {
          return
        }

        // Exclude virtual pages and ensure we only process HTML files
        if (data.virtual || !data.path.pathname.endsWith('.html')) {
          return
        }

        let pathname
        if (data.virtual) {
          // For virtual pages, we remove the 'src/pages/' prefix if it exists
          pathname = data.path.pathname.replace(/^src\/pages\//, '')
          pathname = pathname.startsWith('/') ? pathname : `/${pathname}`
        } else {
          // For physical pages, calculate path relative to the pages source directory
          const pagesDir = join(app.options.projectRoot || process.cwd(), app.options.pages)
          pathname = '/' + relative(pagesDir, data.path.pathname).split('\\').join('/')
        }

        // Exclude 404 page
        if (pathname === '/404.html') {
          return
        }

        let lastmod = page.meta.published_time || page.meta.updated_time

        if (!lastmod && !data.virtual) {
          try {
            const stats = await stat(data.path.pathname)
            lastmod = stats.mtime.toISOString()
          } catch {
            // Fallback to current date if stat fails
            lastmod = new Date().toISOString()
          }
        } else if (!lastmod) {
          lastmod = new Date().toISOString()
        }

        pages.set(pathname, {
          url: `https://coralite.dev${pathname}`,
          lastmod,
          changefreq: page.meta.changefreq || 'weekly',
          priority: page.meta.priority || '0.5'
        })
      },
      async onAfterBuild ({ app }) {
        try {
          await mkdir(app.options.output, { recursive: true })

          const dest = join(app.options.output, 'sitemap.xml')

          let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
          xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

          for (const page of pages.values()) {
            xml += '  <url>\n'
            xml += `    <loc>${page.url}</loc>\n`
            xml += `    <lastmod>${page.lastmod}</lastmod>\n`
            xml += `    <changefreq>${page.changefreq}</changefreq>\n`
            xml += `    <priority>${page.priority}</priority>\n`
            xml += '  </url>\n'
          }

          xml += '</urlset>'

          await writeFile(dest, xml)
        } catch (err) {
          console.error('Failed to write sitemap.xml', err)
        }
      }
    }
  })
}
