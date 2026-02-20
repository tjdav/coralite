# Coralite Plugin Template

This is a template for creating Coralite plugins.

## Usage

### Development

1. Install dependencies:
```bash
npm install
```

2. Run tests:
```bash
npm test
```

### Creating your plugin

Edit `src/index.js` to implement your plugin logic.
You can use `tests/fixtures` to create a minimal Coralite site to test your plugin against.
`tests/smoke.test.js` builds this site and checks the output.

### Releasing

This project includes a release script that handles version bumping, changelog generation, and git tagging.

To create a new release:

```bash
npm run release
```

This will:
1. Run tests.
2. Ask for the release type (major, minor, patch).
3. Update `package.json`.
4. Generate/update `CHANGELOG.md`.
5. Create a git commit and tag.

After that, you can push the changes and publish to npm:

```bash
git push && git push --tags
npm publish
```

## CI/CD

If you selected a CI platform during setup, a workflow file has been created in the appropriate directory (e.g., `.github/workflows/ci.yml`). This workflow automatically runs tests on push and pull requests.
