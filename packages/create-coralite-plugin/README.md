> ⚠️ **NOTE: This is a read-only mirror.** Development happens on [Codeberg](https://codeberg.org/tjdavid/coralite).

# Create Coralite Plugin Scaffolding

The `create-coralite-plugin` package is a CLI tool designed to scaffold new plugins for the Coralite ecosystem.

> **Note**: Requires Node.js v20.19.0 or higher (Node.js v24 LTS recommended).

---

## Installation & Usage

To initialize a new Coralite plugin:

```bash
npm create coralite-plugin@latest
```

---

## CLI Options

### `-o, --output <name>`

- **Purpose**: Set the plugin output directory.
- **Default**: Empty string → prompt required

---

## Plugin Structure

Scaffolded plugins follow the isomorphic Coralite plugin pattern:

```
my-plugin/
├── src/
│   ├── index.js      # Main plugin entry (server + client)
│   ├── client.js     # Client-side specific logic
│   └── components/   # Optional plugin-provided components
├── package.json
└── README.md
```

---

## Author & Licensing

- **Author**: Thomas David ([https://thomasjackdavid.com](https://thomasjackdavid.com))
- **License**: MPL-2.0
