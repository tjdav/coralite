# Coralite

coralite is a static site generator library built around the emerging [HTML modules proposal](https://github.com/WICG/webcomponents/blob/gh-pages/proposals/html-modules-explainer.md).

<p style="text-align:center;">
  <a href="https://youtu.be/wUWwH9QZUTs" target="_blank">
    <img src="https://codeberg.org/tjdavid/coralite/media/branch/main/packages/coralite/docs/images/intro.gif" alt="How to build a website using Coralite" style="max-width: 100%; width: auto;filter: drop-shadow(rgba(0,0,0,0.2) 0px 0px 0.75rem)">
  </a>
  <div>Watch the full video on <a href="https://youtu.be/wUWwH9QZUTs" target="_blank">how to build a website using Coralite.</a></div>
</p>

- Getting started
  - [Installation](https://coralite.dev/docs/guide/installation.html)
  - [Basic templating](https://coralite.dev/docs/guide/getting-started.html)
- Reference
  - [Coralite CLI](https://coralite.dev/docs/reference/cli.html)
  - [Coralite](https://coralite.dev/docs/reference/coralite.html)
  - [Plugin system](https://coralite.dev/docs/reference/plugins/index.html)
    - [Create plugin](https://coralite.dev/docs/reference/plugins/create-plugin.html)
      - The `createPlugin` function is the entry point for extending Coralite's functionality.
    - [Define component](https://coralite.dev/docs/reference/plugins/define-component.html)
      - The `defineComponent` plugin is Coralite's core built-in plugin that enables dynamic template functionality.
    - [Ref](https://coralite.dev/docs/reference/plugins/refs-plugin.html)
      - The `refs` plugin is a built-in Coralite helper that provides runtime DOM element access.
    - [Metadata](https://coralite.dev/docs/reference/plugins/metadata.html)
      - The `metadata` plugin is a built-in Coralite tool that extracts metadata from <meta> tags in your page's <head> and makes them available as template variables. 
  - [Types](https://coralite.dev/docs/reference/types.html)

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
