import { defineConfig } from 'coralite-scripts'
import aggregation from './src/plugins/aggregation.js'
import searchPlugin from './src/plugins/search-plugin.js'
import postcssImport from 'postcss-import'
import autoprefixer from 'autoprefixer'

export default defineConfig({
  public: 'public',
  output: 'dist',
  pages: 'src/pages',
  components: 'src/components',
  styles: {
    input: ['src/css/styles.css'],
    processors: {
      postcss: {
        plugins: [
          postcssImport(),
          autoprefixer()
        ]
      }
    }
  },
  mode: 'development',
  plugins: [
    aggregation([
      {
        name: 'blog-posts',
        path: ['blog'],
        page: 'blog.html',
        component: 'coralite-post',
        limit: 15,
        sort (a, b) {
          let dateA = 0
          let dateB = 0

          if (a && a.page && a.page.meta) {
            dateA = a.page.meta.published_time
          }

          if (b && b.page && b.page.meta) {
            dateB = b.page.meta.published_time
          }

          return new Date(dateB).getTime() - new Date(dateA).getTime()
        },
        pagination: {
          maxVisible: 3
        }
      },
      {
        name: 'related-posts',
        path: ['blog'],
        component: 'coralite-related-post',
        limit: 3,
        filter (state, context) {
          if (!context || !context.page) {
            return true
          }

          return state.page.url.pathname !== context.page.url.pathname
        },
        sort (a, b) {
          let dateA = 0
          let dateB = 0

          if (a && a.page && a.page.meta) {
            dateA = a.page.meta.published_time
          }

          if (b && b.page && b.page.meta) {
            dateB = b.page.meta.published_time
          }

          return new Date(dateB).getTime() - new Date(dateA).getTime()
        }
      }
    ]),
    searchPlugin
  ]
})
