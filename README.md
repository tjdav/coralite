# Coralite

coralite is a static site generator library built around the emerging [HTML modules proposal](https://github.com/WICG/webcomponents/blob/gh-pages/proposals/html-modules-explainer.md).

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

Replace `[options]` with the desired flags and arguments.

## Required Options

To generate a website using Coralite, you must provide three essential options:

- **-c or --components**: The path to your components directory containing reusable UI elements (e.g., `-c ./src/components`).
- **-p or --pages**: The path to your pages directory where static HTML files reside (e.g., `-p ./src/pages`).
- **--output or -o**: The output directory for the generated site (e.g., `--output ./dist`).

Here's an example of how these options might look:

```bash
coralite --components ./src/components --pages ./src/pages --output ./dist
```

## Optional Options

### -d or --dry

Run the CLI in dry-run mode to preview the actions that would be performed without actually generating the website. This is useful for debugging or when you want to check potential issues before committing changes:

```bash
coralite --components ./src/components --pages ./src/pages --output ./dist --dry
```
