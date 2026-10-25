# Coralite Plugin Scripts

Requires Node.js v20.19.0 or higher (Node.js v24 LTS recommended).

This package provides a lightweight script toolset for building and releasing Coralite plugins.

## Installation

Install as a development dependency:

```bash
npm install --save-dev coralite-plugin-scripts
```

## Features

- **Release Management** - Automates version bumping, changelog generation, and git tagging for plugin projects.
- **Unified Build Workflow** - Integrated scripts to ensure your plugin is correctly compiled and packaged for the Coralite ecosystem.

## Usage

Add a release script to your plugin's `package.json`:

```json
{
  "scripts": {
    "release": "coralite-plugin-scripts release"
  }
}
```

Then run the release process:

```bash
npm run release
```
