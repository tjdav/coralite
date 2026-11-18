import { test, expect } from '../fixtures.js'

const lessonHrefs = [
  '/learn/01-the-document',
  '/learn/02-semantic-tags',
  '/learn/03-attributes-data',
  '/learn/04-structuring-a-page',
  '/learn/05-native-css-scoping',
  '/learn/06-cascade-layers',
  '/learn/07-theming-with-variables',
  '/learn/08-the-client-runtime',
  '/learn/09-refs-and-event-listeners',
  '/learn/10-reactive-state',
  '/learn/11-server-side-rendering',
  '/learn/13-building-for-production'
]

test('learn hub exposes every module and lesson without gating', async ({ page }) => {
  await page.goto('/learn')
  await page.waitForLoadState('networkidle')

  await expect(page.locator('.module-card')).toHaveCount(4)
  await expect(page.locator('.lesson-list a')).toHaveCount(lessonHrefs.length)

  const hrefs = await page.locator('.lesson-list a').evaluateAll(links => links.map(link => link.getAttribute('href'))
  )
  for (const href of lessonHrefs) {
    expect(hrefs).toContain(href)
  }

  await expect(page.locator('.global-progress')).toHaveCount(0)
  await expect(page.getByText('Locked')).toHaveCount(0)
  await expect(page.getByText('In Progress')).toHaveCount(0)
  await expect(page.getByText('Complete Module')).toHaveCount(0)

  const starts = page.locator('.module-card ui-link')
  await expect(starts).toHaveCount(4)
  await expect(starts.nth(0)).toHaveAttribute('href', '/learn/01-the-document')
  await expect(starts.nth(1)).toHaveAttribute('href', '/learn/05-native-css-scoping')
  await expect(starts.nth(2)).toHaveAttribute('href', '/learn/08-the-client-runtime')
  await expect(starts.nth(3)).toHaveAttribute('href', '/learn/11-server-side-rendering')
  await expect(starts.nth(0)).toHaveText('Start Module 1')
  await expect(starts.nth(3)).toHaveText('Start Module 4')
})

test('lesson sidebars list the whole curriculum with every module open', async ({ page }) => {
  for (const path of ['/learn/01-the-document', '/learn/05-native-css-scoping', '/learn/13-building-for-production']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')

    const sidebar = page.locator('aside.sidebar-wrapper')
    await expect(sidebar.locator('ui-accordion')).toHaveCount(4)
    await expect(sidebar.locator('ui-accordion details[open]')).toHaveCount(4)
    await expect(sidebar.locator('ui-nav-link')).toHaveCount(lessonHrefs.length)
    await expect(sidebar.locator('.progress-widget')).toHaveCount(0)

    const hrefs = await sidebar.locator('ui-nav-link').evaluateAll(links => links.map(link => link.getAttribute('href'))
    )
    for (const href of lessonHrefs) {
      expect(hrefs).toContain(href)
    }
  }
})

test('lesson links navigate across modules', async ({ page }) => {
  await page.goto('/learn/01-the-document')
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => {
    window.__sameDocument = true
  })

  await page.click('aside.sidebar-wrapper ui-nav-link a[href="/learn/10-reactive-state"]')

  await expect(page).toHaveURL(/\/learn\/10-reactive-state$/)
  expect(await page.evaluate(() => window.__sameDocument)).toBe(true)
})
