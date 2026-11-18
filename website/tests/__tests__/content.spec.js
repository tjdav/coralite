import { test, expect } from '../fixtures.js'

const pages = [
  {
    name: 'docs-hub',
    url: '/docs/'
  },
  {
    name: 'docs-guide',
    url: '/docs/guide/getting-started/'
  },
  {
    name: 'docs-reference',
    url: '/docs/reference/config/'
  },
  {
    name: 'blog-hub',
    url: '/blog/'
  },
  {
    name: 'blog-release',
    url: '/blog/coralite-v0-43-1/'
  }
]

for (const entry of pages) {
  test(`${entry.name} visual test`, async ({ page }) => {
    await page.goto(entry.url)

    await page.waitForLoadState('networkidle')

    await expect(page).toHaveScreenshot(`${entry.name}.png`, {
      fullPage: true
    })
  })
}

test('changelog visual test', async ({ page }) => {
  await page.goto('/changelog/')

  await page.waitForLoadState('networkidle')

  await expect(page).toHaveScreenshot('changelog.png')
})
