import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect } from '../fixtures.js'

const DIST = join(process.cwd(), 'dist')
const OG_DIR = join(DIST, 'images', 'og', 'blog')

test.describe('open graph images', () => {
  test.skip(!existsSync(DIST), 'Run pnpm website:build before this suite')

  test('every blog post points at a generated 1200x630 PNG', () => {
    const slugs = readdirSync(join(DIST, 'blog'), { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)

    expect(slugs.length).toBeGreaterThan(100)

    for (const slug of slugs) {
      const html = readFileSync(join(DIST, 'blog', slug, 'index.html'), 'utf8')
      const match = html.match(/<meta property="og:image" content="([^"]+)"/)

      expect(match, `${slug} has no og:image`).toBeTruthy()
      expect(match[1]).toBe(`https://coralite.dev/images/og/blog/${slug}.png`)

      const file = join(OG_DIR, `${slug}.png`)
      expect(existsSync(file), `${slug} has no generated image`).toBe(true)

      const buffer = readFileSync(file)
      expect(buffer.subarray(1, 4).toString('ascii')).toBe('PNG')
      expect(buffer.readUInt32BE(16)).toBe(1200)
      expect(buffer.readUInt32BE(20)).toBe(630)
    }
  })

  test('pages outside the blog keep the shared social image', () => {
    const home = readFileSync(join(DIST, 'index.html'), 'utf8')
    expect(home).toContain('content="https://coralite.dev/images/social.png"')
  })
})
