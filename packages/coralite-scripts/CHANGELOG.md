# Changelog

## v0.31.6

> Comparing `coralite-scripts-v0.31.5` to `HEAD`

**Summary:** 1 commit

### ✨ Features

- add config and plugin hot reload to coralite-scripts ([fe6be1f](https://codeberg.org/tjdavid/coralite/commit/fe6be1f247eb9c3022eaf3bba42b5801f66dae78))


## v0.30.0

> Comparing `coralite-scripts-v0.29.6` to `HEAD`

**Summary:** 1 commit

### ♻️ Code Refactoring

- unified structured error and warning handling ([d8b59ce](https://codeberg.org/tjdavid/coralite/commit/d8b59ce88fd196b02b0bee8e878edc43de6d4b21))


## v0.29.4

> Comparing `coralite-scripts-v0.29.2` to `HEAD`

**Summary:** 5 commits

### ✨ Features

- write ESM script assets during dev and server build phases ([8afd33b](https://codeberg.org/tjdavid/coralite/commit/8afd33bec5b1ac7025a48600c3d84a6dc2b267e2))

### 🐛 Bug Fixes

- map CLI mode to Coralite environment mode (scripts) ([45cb00a](https://codeberg.org/tjdavid/coralite/commit/45cb00ababa5447de68c9c96bd92a545521816ba))
- resolve missing asset chunks on nested pages with absolute base URL and explicit assets/js dir ([3fec2e0](https://codeberg.org/tjdavid/coralite/commit/3fec2e09151d12d5c5e9fe75f44484a08ac0c778))

### 🧹 Chores

- update asset output paths to .coralite/assets/css and .coralite/assets/js ([2de3966](https://codeberg.org/tjdavid/coralite/commit/2de3966841ba81d421496926794d4deaa270c223))

### 🔨 Other Changes

- release(coralite-scripts): version 0.29.3 ([6ecbdb3](https://codeberg.org/tjdavid/coralite/commit/6ecbdb396798a8386f7585c563b94355d886ade4))


## v0.29.3

> Comparing `coralite-scripts-v0.29.2` to `HEAD`

**Summary:** 4 commits

### ✨ Features

- write ESM script assets during dev and server build phases ([8afd33b](https://codeberg.org/tjdavid/coralite/commit/8afd33bec5b1ac7025a48600c3d84a6dc2b267e2))

### 🐛 Bug Fixes

- map CLI mode to Coralite environment mode (scripts) ([45cb00a](https://codeberg.org/tjdavid/coralite/commit/45cb00ababa5447de68c9c96bd92a545521816ba))
- resolve missing asset chunks on nested pages with absolute base URL and explicit assets/js dir ([3fec2e0](https://codeberg.org/tjdavid/coralite/commit/3fec2e09151d12d5c5e9fe75f44484a08ac0c778))

### 🧹 Chores

- update asset output paths to .coralite/assets/css and .coralite/assets/js ([2de3966](https://codeberg.org/tjdavid/coralite/commit/2de3966841ba81d421496926794d4deaa270c223))


## v0.29.0

> Comparing `coralite-scripts-v0.28.7` to `HEAD`

**Summary:** 2 commits

### ♻️ Code Refactoring

- completely remove standalone components feature (coralite) ([142d9aa](https://codeberg.org/tjdavid/coralite/commit/142d9aae1be9527febd47b384a7768228c0cdc7f))

### 🧹 Chores

- remove unused CoraliteStaticAsset typedef from config types ([11011bc](https://codeberg.org/tjdavid/coralite/commit/11011bc41b48f22fcc4aa1784959e9fb9feaa5b4))


## v0.28.5

> Comparing `coralite-scripts-v0.28.4` to `HEAD`

**Summary:** 1 commit

### ✨ Features

- refactor asset handling to use plugin system (config) ([bcf66d8](https://codeberg.org/tjdavid/coralite/commit/bcf66d86c75195c25da64e14396be2b923cc8e64))


## v0.28.4

> Comparing `coralite-scripts-v0.28.3` to `HEAD`

**Summary:** 2 commits

### 📚 Documentation

- update README to reflect current configuration and remove emojis (coralite-scripts) ([4456454](https://codeberg.org/tjdavid/coralite/commit/44564547ce1b1029ce43275520cd75d9d0724bce))
- update types and examples for the `assets` feature (coralite-scripts) ([58f4d79](https://codeberg.org/tjdavid/coralite/commit/58f4d79b7fbaa118a1efc1ced389d2bb0789782d))


## v0.28.3

> Comparing `coralite-scripts-v0.28.2` to `HEAD`

**Summary:** 1 commit

### ✨ Features

- add static asset plugin support and configure WASM headers (coralite-scripts) ([abbb4d4](https://codeberg.org/tjdavid/coralite/commit/abbb4d47f2a03c0fef26d4d3476b636ccffa287a))


## v0.28.2

> Comparing `coralite-scripts-v0.28.1` to `HEAD`

**Summary:** 2 commits

### 🐛 Bug Fixes

- clean up dev server build artifacts ([76950ff](https://codeberg.org/tjdavid/coralite/commit/76950ff38da65431346e66206e0eaa857cdd4cf2))

### 📚 Documentation

- remove read-only mirror note from coralite-scripts README ([6c7b868](https://codeberg.org/tjdavid/coralite/commit/6c7b868dfe2b0b18c0d332b87d6e2503c26ee6c5))


## v0.28.1

> Comparing `coralite-scripts-v0.28.0` to `HEAD`

**Summary:** 1 commit

### ✨ Features

- save standalone components to disk during build and dev (coralite-scripts) ([5067fb5](https://codeberg.org/tjdavid/coralite/commit/5067fb5a8713627462b8d7899328cd0200d6b495))


## v0.27.0

> Comparing `coralite-scripts-v0.26.0` to `HEAD`

**Summary:** 3 commits

### ✨ Features

- allow `skipRenderByAttribute` and `ignoreByAttribute` to accept string or object arrays ([a9686cd](https://codeberg.org/tjdavid/coralite/commit/a9686cdb877e685c6099e642744b68789b5ede12))

### ♻️ Code Refactoring

- rename result property from html to content ([31e9911](https://codeberg.org/tjdavid/coralite/commit/31e9911b3a447df0a804744c4830340b3887e2bc))

### 🔨 Other Changes

- refactor!(coralite-scripts): align terminology with core components rename ([560e083](https://codeberg.org/tjdavid/coralite/commit/560e0833204303f5c513cb20a295887d49e3b0ae))


## v0.26.0

> Comparing `coralite-scripts-v0.25.0` to `HEAD`

**Summary:** 1 commit

### ✨ Features

- add validation for ignoreByAttribute and skipRenderByAttribute options (config) ([ae82713](https://codeberg.org/tjdavid/coralite/commit/ae82713c5f1c9cbe8b3199749d03ac4f14783bf1))


## v0.24.0

> Comparing `coralite-scripts-v0.23.0` to `HEAD`

**Summary:** 4 commits

### ✨ Features

- enable experimental VM modules and development mode (scripts) ([5e457e7](https://codeberg.org/tjdavid/coralite/commit/5e457e7074232f0bf72bbaa79f51a8e6e77fec14))
- improve config loading error handling and validation (scripts) ([ad48e49](https://codeberg.org/tjdavid/coralite/commit/ad48e49894f5e1d95a7250fdc93009bb87acc974))

### 🐛 Bug Fixes

- improve static file serving and page resolution ([0420a06](https://codeberg.org/tjdavid/coralite/commit/0420a06f4f1a892d22b8783fad1fcc3a980deab3))

### ♻️ Code Refactoring

- remove unused html build file ([a92d293](https://codeberg.org/tjdavid/coralite/commit/a92d293654a5266c0c4cdc515c80e8a2891dbeff))


## v0.22.1

> Comparing `coralite-scripts-v0.21.0` to `HEAD`

**Summary:** 5 commits

### ✨ Features

- add publishConfig to package.json files for public access and provenance ([a634901](https://codeberg.org/tjdavid/coralite/commit/a634901d5c79c6230b3e13c8c21c0fec3c54e1d2))
- add plugin server initialisation (plugin) ([6b2199d](https://codeberg.org/tjdavid/coralite/commit/6b2199db93c56cee655a7b32057d22082d191813))

### 🐛 Bug Fixes

- remove unused `initWatcher` variable and redundant assignments ([57772f9](https://codeberg.org/tjdavid/coralite/commit/57772f913d5bd01dcbaff7e1ce881c3cb46cb628))

### 🧹 Chores

- remove publishConfig from package.json files ([180e5f5](https://codeberg.org/tjdavid/coralite/commit/180e5f524e976547fec51f0128f7688c96d5df4d))

### 🔨 Other Changes

- release(coralite-scripts): version 0.22.0 ([e7e3b21](https://codeberg.org/tjdavid/coralite/commit/e7e3b21295d0a043ac9129b25c60eabb2b2aec15))


## v0.22.0

> Comparing `coralite-scripts-v0.20.0` to `HEAD`

**Summary:** 6 commits

### ✨ Features

- add publishConfig to package.json files for public access and provenance ([a634901](https://codeberg.org/tjdavid/coralite/commit/a634901d5c79c6230b3e13c8c21c0fec3c54e1d2))
- add plugin server initialisation (plugin) ([6b2199d](https://codeberg.org/tjdavid/coralite/commit/6b2199db93c56cee655a7b32057d22082d191813))

### 🐛 Bug Fixes

- remove unused `initWatcher` variable and redundant assignments ([57772f9](https://codeberg.org/tjdavid/coralite/commit/57772f913d5bd01dcbaff7e1ce881c3cb46cb628))

### 🧹 Chores

- remove publishConfig from package.json files ([180e5f5](https://codeberg.org/tjdavid/coralite/commit/180e5f524e976547fec51f0128f7688c96d5df4d))
- remove unused files ([ead0399](https://codeberg.org/tjdavid/coralite/commit/ead039932ff0a45e8080b16bc6bad5cf76327487))

### 🔨 Other Changes

- release(coralite-scripts): version 0.21.0 ([51c0a80](https://codeberg.org/tjdavid/coralite/commit/51c0a806f90ed5d6f19faf00d505f047b619232f))

