# {{ name }}

A Coralite project.

## Development

Start the development server:

```bash
pnpm start
```

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
