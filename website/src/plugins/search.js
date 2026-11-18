import { definePlugin } from 'coralite'

const searchIndex = []
const INDEXED_PREFIXES = ['/docs/', '/reference/', '/learn/', '/blog/']

function decodeEntities (value) {
  return String(value)
    .replace(/&#(\d+);/g, (m, code) => String.fromCharCode(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function extractText (node) {
  let text = ''
  if (node.type === 'text') {
    text += node.data + ' '
    return text
  }
  if (node.children) {
    for (const child of node.children) {
      if (child.type === 'tag' && (child.name === 'script' || child.name === 'style')) {
        continue
      }
      text += extractText(child)
    }
  }
  return text
}

function findBody (node) {
  if (node.type === 'tag' && node.name === 'body') {
    return node
  }
  if (node.children) {
    for (const child of node.children) {
      const found = findBody(child)
      if (found) {
        return found
      }
    }
  }
  return null
}

export default definePlugin({
  name: 'search-plugin',
  server: {
    onPageSet: async ({ elements, page, data }) => {
      if (!data.path.pathname.endsWith('.html')) {
        return
      }

      const url = page.url.pathname
        .replace(/\/index\.html$/, '/')
        .replace(/\.html$/, '')
      if (!INDEXED_PREFIXES.some(prefix => url.startsWith(prefix))) {
        return
      }

      if (url === '/404' || url.startsWith('/docs/reference/plugins/index')) {
        return
      }

      const title = decodeEntities((page.meta.title || '').replace(/\s*[—|]\s*Coralite.*$/, ''))
      const description = decodeEntities(page.meta.description || '')

      const body = findBody(elements.root)
      let content = body ? extractText(body) : ''
      content = content.replace(/\s+/g, ' ').trim().slice(0, 2000)

      searchIndex.push({
        url,
        title,
        description,
        content,
        kind: url.startsWith('/blog/') ? 'blog' : url.startsWith('/learn/') ? 'learn' : 'docs'
      })
    },
    async onAfterBuild ({ app }) {
      try {
        const entries = Array.from(new Map(searchIndex.map(item => [item.url, item])).values())
        entries.sort((a, b) => a.url.localeCompare(b.url))
        await app.writeFile('search-index.json', JSON.stringify(entries, null, 2))
      } catch (err) {
        console.error('Failed to write search index', err)
      }
    }
  }
})
