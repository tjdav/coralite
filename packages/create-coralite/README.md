# Create Coralite Scaffolding

The `create-coralite` package is a command-line interface (CLI) tool designed to scaffold new projects using the Coralite static-site-generator (SSG).

> **Note**: This guide assumes familiarity with basic terminal operations, Node.js (v22.12.0 or higher), and package managers such as `npm`, `yarn`, or `pnpm`.

---

## Installation & Usage

### Install via Package Manager

To initialize a new Coralite project:

```bash
npm create coralite@latest
```

Alternatively, use other package managers:

```bash
yarn create coralite
```

```bash
pnpm create coralite
```

> **Note**: The `create-coralite` CLI is registered as both `create-coralite` and `cca` (short for *Coralite Create App*) in the `bin` field of `package.json`.

---

## CLI Options

### `-o, --output <name>`

- **Purpose**: Set project output directory.
- **Default**: Empty string → prompt required
- **Usage Example**:
  ```bash
  npm create coralite -o my-project
  ```

### `-t, --template <name>`

- **Purpose**: Select styling template for the scaffolded project.
- **Choices**: `css`, `scss`
- **Default**: Empty string → user selection required
- **Usage Example**:
  ```bash
  npm create coralite -t scss
  ```

---

## Author & Licensing

- **Author**: Thomas David ([https://thomasjackdavid.com](https://thomasjackdavid.com))
- **License**: AGPL-3.0-only (Affero General Public License, version 3)
  > **Implication**: Any derived work must be open-source and accessible to users.

---

## Repository & Documentation

### Source Code
- Hosted on [Codeberg](https://codeberg.org), a decentralized Git hosting service.
- Path: [packages/create-coralite](https://codeberg.org/tjdavid/coralite/src/branch/main/packages/create-coralite) within the larger Coralite repository.

### Official Documentation
- Accessible at: [https://coralite.dev/docs/create-coralite](https://coralite.dev/docs/create-coralite)

> **Recommended**: Visit documentation for advanced usage, template details, and project structure reference.
