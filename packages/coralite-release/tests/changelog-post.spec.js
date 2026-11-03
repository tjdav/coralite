import { describe, it } from 'node:test'
import assert from 'node:assert'
import { readFileSync, unlinkSync, existsSync } from 'node:fs'
import path from 'node:path'
import {
  formatChangelogDate,
  convertMarkdownToTimelineHtml,
  parseReleaseNotesToEntry,
  updateChangelogData
} from '../lib/changelog-entry-generator.js'

describe('Changelog entry generator & timeline conversion', () => {
  describe('formatChangelogDate()', () => {
    it('formats ISO date strings into readable timeline format', () => {
      const formatted = formatChangelogDate('2026-11-02T15:49:31Z')
      assert.strictEqual(formatted, 'Nov 2, 2026')
    })

    it('formats Date instances accurately', () => {
      const date = new Date(Date.UTC(2026, 9, 29))
      assert.strictEqual(formatChangelogDate(date), 'Oct 29, 2026')
    })
  })

  describe('convertMarkdownToTimelineHtml()', () => {
    it('converts fenced code blocks to coralite-code-highlight with language attribute', () => {
      const md = '```javascript\nexport const x = 1\n```'
      const html = convertMarkdownToTimelineHtml(md)
      assert.ok(html.includes('<coralite-code-highlight language="javascript">'))
      assert.ok(html.includes('export const x = 1'))
      assert.ok(html.includes('</coralite-code-highlight>'))
    })

    it('converts markdown headings to coralite-heading components', () => {
      const md = '## Overview\n### Features\n#### Refactor'
      const html = convertMarkdownToTimelineHtml(md)
      assert.ok(html.includes('<coralite-heading level="2" text="Overview"></coralite-heading>'))
      assert.ok(html.includes('<coralite-heading level="3" text="Features"></coralite-heading>'))
      assert.ok(html.includes('<coralite-heading level="4" text="Refactor"></coralite-heading>'))
    })

    it('converts bullet points into semantic ul and li tags', () => {
      const md = '- Feature A with `code`\n- Feature B with **bold**'
      const html = convertMarkdownToTimelineHtml(md)
      assert.ok(html.includes('<ul>'))
      assert.ok(html.includes('<li>Feature A with <code>code</code></li>'))
      assert.ok(html.includes('<li>Feature B with <strong>bold</strong></li>'))
      assert.ok(html.includes('</ul>'))
    })

    it('converts inline links and code', () => {
      const md = 'See [documentation](https://coralite.dev) for `config` details.'
      const html = convertMarkdownToTimelineHtml(md)
      assert.ok(html.includes('<a href="https://coralite.dev">documentation</a>'))
      assert.ok(html.includes('<code>config</code>'))
    })
  })

  describe('parseReleaseNotesToEntry()', () => {
    it('extracts title, release overview summary, and body', () => {
      const sampleReleasePost = `# coralite v1.0.0-rc.10

## Release Overview
This release isolates test fixtures and clarifies zero-JS static contracts.

---

### Key Highlights

#### Fixture Isolation
Test fixtures are now excluded from production builds.

\`\`\`javascript
export const attributes = {}
\`\`\`
`
      const parsed = parseReleaseNotesToEntry(sampleReleasePost, '1.0.0-rc.10', 'coralite')
      assert.strictEqual(parsed.title, 'coralite v1.0.0-rc.10')
      assert.strictEqual(parsed.summary, 'This release isolates test fixtures and clarifies zero-JS static contracts.')
      assert.ok(parsed.html.includes('<coralite-heading level="3" text="Key Highlights"></coralite-heading>'))
      assert.ok(parsed.html.includes('<coralite-code-highlight language="javascript">'))
    })

    it('does not include leading duplicate H2 heading in timeline html', () => {
      const sampleWithH2 = `## coralite v1.0.0

## Release Overview
Version 1.0.0 release.

### Features
- Feature 1
`
      const parsed = parseReleaseNotesToEntry(sampleWithH2, '1.0.0', 'coralite')
      assert.strictEqual(parsed.title, 'coralite v1.0.0')
      assert.strictEqual(parsed.summary, 'Version 1.0.0 release.')
      assert.strictEqual(parsed.html.includes('coralite-heading level="2" text="coralite v1.0.0"'), false)
      assert.ok(parsed.html.includes('<coralite-heading level="3" text="Features"></coralite-heading>'))
    })
  })

  describe('updateChangelogData()', () => {
    const tmpJson = path.resolve(process.cwd(), 'website/src/data/test-changelog.tmp.json')

    it('creates and upserts entries idempotently in chronological order', () => {
      try {
        if (existsSync(tmpJson)) {
          unlinkSync(tmpJson)
        }

        // Insert first entry
        updateChangelogData({
          version: '1.0.0-rc.9',
          packageName: 'coralite',
          date: '2026-10-20T10:00:00Z',
          title: 'Coralite v1.0.0-rc.9',
          summary: 'Earlier RC',
          html: '<p>Earlier RC</p>',
          jsonPath: tmpJson
        })

        // Insert newer entry
        updateChangelogData({
          version: '1.0.0-rc.10',
          packageName: 'coralite',
          date: '2026-11-02T10:00:00Z',
          title: 'Coralite v1.0.0-rc.10',
          summary: 'Latest RC',
          html: '<p>Latest RC</p>',
          jsonPath: tmpJson
        })

        let content = JSON.parse(readFileSync(tmpJson, 'utf8'))
        assert.strictEqual(content.length, 2)
        assert.strictEqual(content[0].version, '1.0.0-rc.10')
        assert.strictEqual(content[1].version, '1.0.0-rc.9')

        // Update rc.10 with new summary without creating duplicate
        updateChangelogData({
          version: '1.0.0-rc.10',
          packageName: 'coralite',
          date: '2026-11-02T10:00:00Z',
          title: 'Coralite v1.0.0-rc.10 (Updated)',
          summary: 'Latest RC Updated',
          html: '<p>Updated</p>',
          jsonPath: tmpJson
        })

        content = JSON.parse(readFileSync(tmpJson, 'utf8'))
        assert.strictEqual(content.length, 2)
        assert.strictEqual(content[0].version, '1.0.0-rc.10')
        assert.strictEqual(content[0].title, 'Coralite v1.0.0-rc.10 (Updated)')
      } finally {
        if (existsSync(tmpJson)) {
          unlinkSync(tmpJson)
        }
      }
    })
  })
})
