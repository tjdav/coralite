import { definePlugin } from '../../../../lib/server/plugin/define.js'

export const enumeratePostsPlugin = definePlugin({
  name: 'enumerate-posts-plugin',
  server: {
    onPageSet ({ page, app }) {
      if (page.file.filename !== '[slug].html') return
      if (!page.file.dirname.includes('plugin-enumerated')) return

      const posts = app.collections?.posts?.list ?? [
        { slug: 'post-1' },
        { slug: 'post-2' }
      ]

      return { paths: posts.map(p => ({ slug: p.slug })) }
    }
  }
})

export default enumeratePostsPlugin
