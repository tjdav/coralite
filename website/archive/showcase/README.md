# Archived: Showcase page

**Status:** archived on 2026-11-17.

The showcase page is not built, linked in navigation, indexed by search, or
included in the sitemap while it lives here. It is kept so it can be restored
once there are more websites/apps to feature.

## Why

There is currently a single entry (EuroLoom). The page will come back when the
showcase has enough projects to be worth a dedicated route.

## Contents

```
archive/showcase/
  index.html        the page (was src/pages/showcase/index.html)
  showcase.css      scoped page styles (was src/css/showcase.css)
  images/euroloom/  logo + screenshot (was public/images/showcase/euroloom/)
```

While archived, `/showcase`, `/showcase/`, and `/showcase.html` temporarily
redirect to `/` with a `302` in `public/_redirects`.

## Restore checklist

1. Move the page back:
   ```bash
   git mv archive/showcase/index.html src/pages/showcase/index.html
   ```
2. Move the stylesheet back and register it:
   ```bash
   git mv archive/showcase/showcase.css src/css/showcase.css
   ```
   Add `'src/css/showcase.css'` to `styles.input` in `coralite.config.js`
   (before `code-theme.css`).
3. Move the images back:
   ```bash
   git mv archive/showcase/images public/images/showcase
   ```
   This restores `public/images/showcase/euroloom/*`, which the page references.
4. Re-add navigation links:
   - `src/components/site-header.html`: `<a href="/showcase/">Showcase</a>`
   - `src/components/site-footer.html` (Explore column):
     `<a href="/showcase/">Showcase</a>`
   - `src/components/site-mobile-nav.html`:
     `<ui-nav-link href="/showcase/">Showcase</ui-nav-link>`
5. Remove the three `/showcase* → /` `302` rules from `public/_redirects`.
6. Restore test coverage:
   - Add `{ name: 'showcase', url: '/showcase/' }` to `pages` in
     `tests/__tests__/content.spec.js`.
   - Run `npx playwright test tests/__tests__/content.spec.js --update-snapshots`
     to create `showcase-chromium-linux.png`.
7. Verify:
   ```bash
   pnpm check
   pnpm build --clean
   npx playwright test --update-snapshots
   npx playwright test
   ```
8. Delete this archive directory.
