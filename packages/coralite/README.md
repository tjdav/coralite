# Coralite

coralite is a static site generator library built around the emerging [HTML modules proposal](https://github.com/WICG/webcomponents/blob/gh-pages/proposals/html-modules-explainer.md).

<p style="text-align:center;">
  <a href="https://youtu.be/wUWwH9QZUTs" target="_blank">
    <img src="https://codeberg.org/tjdavid/coralite/media/branch/main/packages/coralite/docs/images/intro.gif" alt="How to build a website using Coralite" style="max-width: 100%; width: auto;filter: drop-shadow(rgba(0,0,0,0.2) 0px 0px 0.75rem)">
  </a>
  <div>Watch the full video on <a href="https://youtu.be/wUWwH9QZUTs" target="_blank">how to build a website using Coralite.</a></div>
</p>

- Getting started
  - [Basic templating](https://codeberg.org/tjdavid/coralite/src/branch/main/packages/coralite/docs/basic-templating.md)
- Reference
  - [Coralite CLI](https://codeberg.org/tjdavid/coralite/src/branch/main/packages/coralite/docs/coralite-cli.md)
  - [Coralite](https://codeberg.org/tjdavid/coralite/src/branch/main/packages/coralite/docs/coralite.md)
  - [Javascript](https://codeberg.org/tjdavid/coralite/src/branch/main/packages/coralite/docs/javascript.md)
  - [Types](https://codeberg.org/tjdavid/coralite/src/branch/main/packages/coralite/docs/types.md)

## Installation

Before using the Coralite CLI, ensure that it's installed on your system. You can install it globally using **npm**:

```bash
npm install -g coralite
# or
yarn global add coralite
# or
pnpm add -g coralite
```

You can also install coralite as a development dependency:

```bash
npm install --save-dev coralite
# or
yarn add -D coralite
# or
pnpm add -D coralite
```

## Basic Syntax

Coralite is executed using the following command:

```bash
coralite [options]
```

For more information about the 

Replace `[options]` with the desired flags and arguments.

## Required Options

To generate a website using Coralite, you must provide three essential options:

- **-t or --templates**: The path to your templates directory containing reusable UI elements (e.g., `-t src/templates`).
- **-p or --pages**: The path to your pages directory where static HTML files reside (e.g., `-p src/pages`).
- **--output or -o**: The output directory for the generated site (e.g., `--output dist`).

Here's an example of how these options might look:

```bash
coralite --templates path/to/templates --pages path/to/pages --output dist
```

## Optional Options

### -d or --dry-run

Run the CLI in dry-run mode to preview the actions that would be performed without actually generating the website. This is useful for debugging or when you want to check potential issues before committing changes:

```bash
coralite --templates path/to/templates --pages path/to/pages --output dist --dry-run
```
