import { definePlugin } from 'coralite'
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'

let searchIndex = []

function extractText (node) {
  let text = ''
  if (node.type === 'text') {
    text += node.data + ' '
  } else if (node.children) {
    for (const child of node.children) {
      if (node.type === 'tag' && (node.name === 'script' || node.name === 'style')) continue
      text += extractText(child)
    }
  }
  return text
}

export default definePlugin({
  name: 'search-plugin',
  onPageSet: async ({ elements, values, data }) => {
    // Only index HTML pages
    if (!data.path.pathname.endsWith('.html')){
      return
    }

    const title = values.title || ''
    const description = values.description || ''

    // Extract full text from body
    let bodyNode = null
    const findBody = (node) => {
      if (node.type === 'tag' && node.name === 'body') {
        bodyNode = node
        return
      }
      if (node.children) {
        for (const child of node.children) {
          findBody(child)
          if (bodyNode) return
        }
      }
    }

    findBody(elements.root)

    let content = ''
    if (bodyNode) {
      content = extractText(bodyNode)
    }

    // Clean up text
    content = content.replace(/\s+/g, ' ').trim()

    searchIndex.push({
      url: values.$urlPathname,
      title,
      description,
      content
    })
  },
  onAfterBuild: async () => {
    // Write index to dist
    const dest = join(process.cwd(), 'dist', 'search-index.json')
    try {
      await writeFile(dest, JSON.stringify(searchIndex))
    } catch (err) {
      console.error('Failed to write search index', err)
    }
  }
})
