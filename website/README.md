# Coralite Website

This package builds the public `coralite.dev` documentation and the
machine-readable LLM references.

## Development

Start the development server:

```bash
pnpm dev
```

> **Note:** `coralite dev` compiles pages in memory and serves compiled assets
> from `.coralite/`; `coralite build` writes `dist/`. Both also share the
> incremental cache at `.coralite/manifest.json`. Running a production build
> while the dev server is active can leave dev referencing an asset hash that is
> no longer present (the browser then gets `404 text/plain`, which blocks module
> loading). If that happens, stop the dev server, delete `.coralite/` and
> `dist/`, and start `pnpm dev` again.

Build for production:

```bash
pnpm build
```

Validate, auto-fix, and test:

```bash
pnpm check            # validate components, pages, and plugins
pnpm fix              # auto-fix safe validation diagnostics
pnpm test:visual      # Playwright suite (starts its own dev server)
pnpm check:redirects  # audit legacy URLs against the live sitemap fixture
pnpm lint:css         # stylelint over src/css
```

From the monorepo root, the same tasks are available as `pnpm website:dev`,
`pnpm website:build`, `pnpm website:check`, `pnpm website:test`, and
`pnpm website:lint:css`.

## Stylesheets

`src/css/styles.css` is the single `styles.input` entry. It imports `fonts`,
`main`, and the per-section partials in link order; `postcss-import` inlines
them and `autoprefixer` runs at build time. Pages therefore load one project
stylesheet (plus the component-style bundle) instead of one request per
partial. Add a new partial by importing it from `styles.css` and keep
`pnpm lint:css` green.

## Changelog data

`src/data/changelog.json` is the source of truth for the changelog page. The
changelog plugin renders every entry at build time and converts legacy
`coralite-heading` / `coralite-code-highlight` markup into the site's heading
and `code-block` components. Release tooling writes this file, so never edit
the rendered page by hand.

## Canonical Sources

Keep the detailed contract in one place. Other pages should summarize or link
to the canonical owner instead of repeating the full rules.

| Topic | Canonical source | Mirrors / summaries |
|---|---|---|
| Imperative components | `src/pages/docs/reference/imperative-components.html` | JavaScript guide, plugin guide, E2E guide, plugin reference, `AGENTS.md`, `packages/coralite/AGENT.md`, `packages/coralite/README.md`, `public/llms.txt`, `public/llms/plugins.md` |
| DOM refs | `src/pages/docs/guide/dom-refs.html` | Imperative-components reference links here for the full ref model |
| Styling | `src/pages/docs/guide/styling.html` | Imperative-components reference links here for scoped styles and host styling |
| Runtime DOM types | `src/pages/docs/reference/types.html` | Imperative-components reference links here for runtime type signatures |

`public/llms-full.txt` is an intentionally complete standalone LLM reference.
It mirrors canonical details instead of linking, so it must be updated when a
canonical contract changes.

## Sync Checklist

1. Update the canonical page first.
2. Update `public/llms-full.txt` if the contract changed.
3. Update summaries only when the high-level rule changed.
4. Run `pnpm website:build` from the repository root.
5. Run `pnpm website:test` and confirm canonical anchors and summary links still resolve.

## Deploying

The build produces a static site in `dist/`. Deploy `dist/` to any static host.

- Build command: `pnpm build`
- Output directory: `dist`
- URLs are clean and trailing-slash (`/docs/guide/getting-started/`). Each page
  is built as a directory index; statichost.eu 308s the slashless form to the
  slash URL. Canonical tags, the sitemap and every redirect target use the
  slash form, so no canonical or redirect points at a URL that redirects.
- `/index.html` is force-redirected to `/` (`301!`) because the file exists in
  the output and static files win over redirects by default.
- `public/_redirects` maps every legacy `.html` URL to its clean target. The
  host must honour it (Netlify and Cloudflare Pages do).

Works out of the box on Netlify, Vercel, Cloudflare Pages, and GitHub Pages,
provided the host supports the URL rules above.

### Cutover runbook

1. Deploy `dist/` to a preview URL.
2. Sign off these routes: `/`, `/why/`, `/compare/`,
   `/docs/guide/getting-started/`, `/reference/client/`, `/learn/`, `/blog/`,
   `/blog/coralite-v0-43-1/`, `/changelog/`, `/404`.
3. Confirm the legacy redirects return `301` to their targets —
   `/blog/page/2.html` … `/blog/page/7.html` → `/blog/`, `/docs/guide.html` →
   `/docs/guide/`, `/docs/reference.html` → `/docs/reference/`,
   `/docs/reference/plugins.html` → `/docs/reference/plugins/`.
4. Run `pnpm website:test` with `BASE_URL` set to the preview to exercise
   `tests/__tests__/routing.spec.js` against the host.
5. Switch production, re-fetch `sitemap.xml`, and archive
   `tjdav/coralite-website` with a pointer to this package.
6. Rollback: redeploy the previous build from the `website-pre-migration` tag.
