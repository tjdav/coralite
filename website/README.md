# coralite-website

A Coralite project.

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

Validate project files:

```bash
pnpm check
```

Auto-fix validation issues:

```bash
pnpm fix
```

## Deploying

The build produces a static site in `dist/`. Deploy `dist/` to any static host.

- Build command: `pnpm build`
- Output directory: `dist`
- URLs are clean by default (`/about`, not `/about.html`). Configure your host to serve directory indexes if needed.

Works out of the box on Netlify, Vercel, Cloudflare Pages, and GitHub Pages.
