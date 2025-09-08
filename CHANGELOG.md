# Changelog

## v0.16.0

> Comparing `v0.15.0` to `v0.16.0`

**Summary:** 22 commits, 2 pull requests

### ✨ Features

- add refs plugin exports (core) ([4b04115](https://codeberg.org/tjdavid/coralite/commit/4b04115b661432cdaf16526decde401ea5556c51))
- add script option to defineComponent plugin with callback handling (core) ([04322d4](https://codeberg.org/tjdavid/coralite/commit/04322d483fefa035f159a852be7434fa28853de0))
- add script execution support with refs management and cleanup (core) ([a81a0ef](https://codeberg.org/tjdavid/coralite/commit/a81a0efb857631ed4ab123bb2e0cdf82a5f3420a))
- add refs plugin for DOM element referencing functionality (coralite) ([d99db6a](https://codeberg.org/tjdavid/coralite/commit/d99db6a0853641a2ff32d2a8afd269a4ac417632))
- collect ref elements (core) ([4324359](https://codeberg.org/tjdavid/coralite/commit/4324359d4a53b9cb61869e4658d940d032de51e1))
- init create coralite script ([a52d77c](https://codeberg.org/tjdavid/coralite/commit/a52d77cdebcfa0bb094c985bb8c0fe1f4427270c))
- add publish-scripts command for coralite-scripts ([a14e544](https://codeberg.org/tjdavid/coralite/commit/a14e544fa38623cbafe8d5099d41e9cf8846e4d9))

### 🐛 Bug Fixes

- SCSS watch trigger condition ([a4a03fc](https://codeberg.org/tjdavid/coralite/commit/a4a03fcdf7cedee4e2b243d8d27b507338488a9b))
- update coralite dependency versions in package.json (coralite-release) ([f3bc73a](https://codeberg.org/tjdavid/coralite/commit/f3bc73a8a368db555912cf5babaf9d4025ad683c))

### 📚 Documentation

- add README.md ([b5af9be](https://codeberg.org/tjdavid/coralite/commit/b5af9be71b9150ce953d6d754694700a10dd0207))
- update README image path for coralite intro gif ([6cb4554](https://codeberg.org/tjdavid/coralite/commit/6cb4554f56b6931d74015c4f141438cf3ea76917))
- update type definitions for coralite document values and add remove flag support ([fb9650a](https://codeberg.org/tjdavid/coralite/commit/fb9650a8d0ddac3016746bc0f5a284a1a1dae86e))
- add README for create-coralite package with installation and CLI options ([33223ba](https://codeberg.org/tjdavid/coralite/commit/33223ba72e185ef453429e23a3242b1dc2c1d0f1))
- add README for coralite-release package with CLI documentation ([595f959](https://codeberg.org/tjdavid/coralite/commit/595f959ebe958d4e8e1605f882c0faa965c4152b))
- update changelog ([ddcccfe](https://codeberg.org/tjdavid/coralite/commit/ddcccfef61940e84eb551738ad036361412b5beb))

### ♻️ Code Refactoring

- cleanup ref attributes (core) ([7f916f3](https://codeberg.org/tjdavid/coralite/commit/7f916f3bf3f0159dd475372f46a49458fe27d3ce))

### 🧹 Chores

- update coralite to v0.15.0 (deps) ([5115415](https://codeberg.org/tjdavid/coralite/commit/5115415e8f13df7812fdca74b55a71673e3ce435))
- enable JSON module resolution in jsconfig.json ([58d50ac](https://codeberg.org/tjdavid/coralite/commit/58d50ac49647b89511afa7361bdf9f34a3001ca9))

### 🔨 Other Changes

- release: version 0.16.0 ([0ddc175](https://codeberg.org/tjdavid/coralite/commit/0ddc175e8e903be1a38a0c70fa81fc97e4a5ee37))
- Merge pull request 'Add JavaScript Support to Components and Refs Management' (#8) from javascript-support into main ([#8](https://codeberg.org/tjdavid/coralite/pulls/8)) ([97a7b04](https://codeberg.org/tjdavid/coralite/commit/97a7b040cd8eb4ccd14519bd84afbbf147a9d7bb))
- Merge pull request 'create-coralite' (#7) from create-coralite into main ([#7](https://codeberg.org/tjdavid/coralite/pulls/7)) ([5e15a1e](https://codeberg.org/tjdavid/coralite/commit/5e15a1e9e0624e52fb74c6aa8ad60c9f116eaae4))
- Merge branch 'main' of ssh://codeberg.org/tjdavid/coralite into create-coralite ([35a55ca](https://codeberg.org/tjdavid/coralite/commit/35a55cadcd34b02f2f8f4ca0b4fa3b5e2d7e035f))

### 🔗 Pull Requests

- [#7](https://codeberg.org/tjdavid/coralite/pulls/7)
- [#8](https://codeberg.org/tjdavid/coralite/pulls/8)

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

- [#3](https://codeberg.org/tjdavid/coralite/pulls/3)
- [#4](https://codeberg.org/tjdavid/coralite/pulls/4)
- [#5](https://codeberg.org/tjdavid/coralite/pulls/5)
- [#6](https://codeberg.org/tjdavid/coralite/pulls/6)

