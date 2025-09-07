# Changelog

## v0.15.0

> Comparing `v0.14.2` to `v0.15.0`

**Summary:** 52 commits, 4 pull requests

### ✨ Features

- add changelog command and update bin entry points ([1b33b57](https://codeberg.org/tjdavid/coralite/commit/1b33b57e6e754c08ee360323d37f5d5b59a14dcd))
- add changelog generation script with commit parsing and PR tracking ([6ca300b](https://codeberg.org/tjdavid/coralite/commit/6ca300b8681504495827674def73832ac731d9d6))
- add git status check and use simple-git for operations ([f7fb018](https://codeberg.org/tjdavid/coralite/commit/f7fb018f661dba7cfde765b7f23f7aed0575edcd))
- add coralite-release package with CLI for version management and git tagging ([49e9542](https://codeberg.org/tjdavid/coralite/commit/49e95429de5f9b5a86dc52fcd8e7472496e496d4))
- add template file handling in watcher for coralite-scripts ([637dfbf](https://codeberg.org/tjdavid/coralite/commit/637dfbf52b0ca0b9b43ef6889144e70338db64f4))
- integrate Coralite for page compilation and live reload support ([dd33588](https://codeberg.org/tjdavid/coralite/commit/dd3358868edcc6ae35f68212e84774f243a8e05e))
- add collection item handling with string path support ([a367408](https://codeberg.org/tjdavid/coralite/commit/a36740887edf9434b41b6b1752437e4927f8333c))
- add _loadByPath method for loading collection items by file path ([0362c44](https://codeberg.org/tjdavid/coralite/commit/0362c44d35eb813e296fd29f8fa6fc876ad374ae))
- add rootDir option to CoraliteCollection constructor with trailing slash normalization ([d39a2e5](https://codeberg.org/tjdavid/coralite/commit/d39a2e59b8ad517e64a304e7a8abc56aeb13e691))
- add response time logging middleware ([a69a644](https://codeberg.org/tjdavid/coralite/commit/a69a644875ef166501de0e7bb027bfe37c044498))
- add SASS compilation support with watch functionality and rebuild on file changes ([02333bb](https://codeberg.org/tjdavid/coralite/commit/02333bbd1feec3329c07453323fce50b4cff866f))
- add SCSS build script with source map support ([d0cd28e](https://codeberg.org/tjdavid/coralite/commit/d0cd28e8be9a002b8dfe70a62f02c0d2ea501fb7))
- coralite-scripts ([c3a79ea](https://codeberg.org/tjdavid/coralite/commit/c3a79ea4d5608839069754b70aee48ed73086cc0))
- add defineConfig and type definitions ([d4849d7](https://codeberg.org/tjdavid/coralite/commit/d4849d7c5be4b017e6af64fe166a90fdbf5fb59d))

### 🐛 Bug Fixes

- revert version from 0.15.0 to 0.14.2 ([a041712](https://codeberg.org/tjdavid/coralite/commit/a041712fc2d56d53c151852624ba3966b72ea203))
- normalise collection root directory ([ec87581](https://codeberg.org/tjdavid/coralite/commit/ec8758181f61e07b2020a1036fe46b47777d8817))
- rename binary from coralite-run to coralite-scripts ([64a742a](https://codeberg.org/tjdavid/coralite/commit/64a742a1f40180df49445cf2312829c318e27f0f))
- move coralite from devDependencies to dependencies ([a7f91dd](https://codeberg.org/tjdavid/coralite/commit/a7f91dd8575a93e2dffa0c3aeb6635207e06069e))
- update Sass build output path to css directory ([d7f62ea](https://codeberg.org/tjdavid/coralite/commit/d7f62ea6b783c301e58d1823d7fb81e631e5db07))
- remove redundant sass output check ([835c89b](https://codeberg.org/tjdavid/coralite/commit/835c89b8708b8a45b8be10b43e7f7976869da466))
- enhance static asset serving and HTML ([e2e0050](https://codeberg.org/tjdavid/coralite/commit/e2e00508b12710f8b8129cd100a7524e49daa331))
- update sass import syntax and remove mixed-decls deprecation warning ([1cdb887](https://codeberg.org/tjdavid/coralite/commit/1cdb887a1cd98859baa46c1c9c33d514b1cfe8db))
- update workflow to use build-html script instead of html ([635207d](https://codeberg.org/tjdavid/coralite/commit/635207d9a26d128b1b9f6b45063ac06d495c0b0b))
- remove node version check ([b687e3c](https://codeberg.org/tjdavid/coralite/commit/b687e3c85ae0c37c0d2be2d23df001e2f6a9e8a8))

### 📚 Documentation

- enhance JSDoc comments with parameter descriptions and default values ([1eddee3](https://codeberg.org/tjdavid/coralite/commit/1eddee3a2210f5ead61a36a5c12f29b74e5014b5))
- add coralite-scripts README ([0e041be](https://codeberg.org/tjdavid/coralite/commit/0e041bef15fb7b77f9d66f6ca97f0432d31aedfb))
- add comments ([bf99fec](https://codeberg.org/tjdavid/coralite/commit/bf99fec71616261fbcf9b0a8aba9e1c48469c23d))

### ♻️ Code Refactoring

- move coralite to packages ([fb03662](https://codeberg.org/tjdavid/coralite/commit/fb03662c711d6afd457740e7f5855aeacad8703a))

### 📦 Build System

- mono repo only needs one lock file ([3f93373](https://codeberg.org/tjdavid/coralite/commit/3f93373a9b456c5ce23ddc3872d388a739d63351))

### 🔧 Continuous Integration

- remove multiple versions of pnpm ([0c6f3ea](https://codeberg.org/tjdavid/coralite/commit/0c6f3ea21d296c72b74f7e1b06f32d2a360feb65))
- update pnpm version to 10 ([517991e](https://codeberg.org/tjdavid/coralite/commit/517991ec7f82b3ef4c8960988728384b65e7d652))

### 🧹 Chores

- remove create-coralite package and template files ([66e81f7](https://codeberg.org/tjdavid/coralite/commit/66e81f7bdbbf5a2e88d1dbec2a7aae357b686240))
- move to fixed versions - coralite-scripts version to 0.14.2 ([f8649a8](https://codeberg.org/tjdavid/coralite/commit/f8649a85a1de2fa6b031ca5afb595bc042ad8dba))
- move to fixed versions - coralite-scripts version to 0.14.2 ([d0d8256](https://codeberg.org/tjdavid/coralite/commit/d0d82566471f70dd2291b5278fe1f29d59d0041b))
- add coralite-release scripts ([0cf172b](https://codeberg.org/tjdavid/coralite/commit/0cf172b0a5bd5596df136460703876b17953f6a3))
- remove unused script ([c1bfac2](https://codeberg.org/tjdavid/coralite/commit/c1bfac21057be5ab76e84dcc5fea3e3bddce01aa))
- rename script entry point from coralite-scripts.js to index.js ([18fc1df](https://codeberg.org/tjdavid/coralite/commit/18fc1dfcc11f2f6ef20ca152bdacd96d5fdfd521))
- remove unused packages ([0d86fcd](https://codeberg.org/tjdavid/coralite/commit/0d86fcdee5dda35b1ee539d9dd2ce75a2810141d))
- lint fix ([b96e8d8](https://codeberg.org/tjdavid/coralite/commit/b96e8d8fa78bcf0146e8ef0afdd9889281773f08))
- fix lint ([9d3855f](https://codeberg.org/tjdavid/coralite/commit/9d3855ffb0f433f34d04841d5c97ca81a38a72ad))
- remove unused sass.output configuration option ([0192d57](https://codeberg.org/tjdavid/coralite/commit/0192d57eb12ac4e6c116ee392b9fd44910440c65))
- update workspace packages removing docs and adding website, also remove sass-embedded package extensions config (config) ([135f1ea](https://codeberg.org/tjdavid/coralite/commit/135f1ea488782b5d1ea099e82655f1fb33ec5eb4))
- update e2e workflow commands and dependencies ([d2c521e](https://codeberg.org/tjdavid/coralite/commit/d2c521e01a61e347942d295de795a041efdf44d9))
- update package scripts for e2e testing and publishing ([ed5e887](https://codeberg.org/tjdavid/coralite/commit/ed5e8874292907393bc5e4f2a8257608485f0b54))
- update pnpm workspace configuration with packages and overrides (config) ([96ff008](https://codeberg.org/tjdavid/coralite/commit/96ff008b52aaaa044bffe750f4bf706472808005))

### 🔨 Other Changes

- release: version 0.15.0 ([9dc4279](https://codeberg.org/tjdavid/coralite/commit/9dc4279c0e8522af6b017580c66792ce3fb8faeb))
- release: version 0.15.0 ([96cb2f9](https://codeberg.org/tjdavid/coralite/commit/96cb2f9f52f4024938b2d266f2c6bce61435458b))
- Merge pull request 'Coralite release scripts' (#6) from release-script into main ([#6](https://codeberg.org/tjdavid/coralite/pulls/6)) ([01b71a3](https://codeberg.org/tjdavid/coralite/commit/01b71a30b9c9274a5cd1f14020241f7c3c43bb74))
- Merge pull request 'Add utility scripts for coralite project development and build' (#5) from create-coralite-script into main ([#5](https://codeberg.org/tjdavid/coralite/pulls/5)) ([bfbabb6](https://codeberg.org/tjdavid/coralite/commit/bfbabb6c7d98a40f06c454fd406206a7a9949cb6))
- Merge pull request 'feat: add defineConfig and type definitions' (#4) from coralite-define-config into main ([#4](https://codeberg.org/tjdavid/coralite/pulls/4)) ([ee9d431](https://codeberg.org/tjdavid/coralite/commit/ee9d4313b13f726b96e64b5cb74effc01ca31496))
- lint: clean up whitespace and formatting ([37244ae](https://codeberg.org/tjdavid/coralite/commit/37244ae87007da03aff8816179d171fdefb78ac7))
- Merge pull request 'mono-repo' (#3) from mono-repo into main ([#3](https://codeberg.org/tjdavid/coralite/pulls/3)) ([ec4ad6a](https://codeberg.org/tjdavid/coralite/commit/ec4ad6a48509c71dc708d0c8ac971452896e2b09))

### 🔗 Pull Requests

- [#3](https://codeberg.org/tjdavid/coralite/pull/3)
- [#4](https://codeberg.org/tjdavid/coralite/pull/4)
- [#5](https://codeberg.org/tjdavid/coralite/pull/5)
- [#6](https://codeberg.org/tjdavid/coralite/pull/6)

