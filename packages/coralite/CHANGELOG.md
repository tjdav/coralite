# Changelog

## v0.38.4

> Comparing `coralite-v0.38.3` to `HEAD`

**Summary:** 4 commits

### ✨ Features

- extract components and add client-side hooks support (plugins) ([d970167](https://codeberg.org/tjdavid/coralite/commit/d9701678c538fc35b770274df2974bfae2c88d6a))
- transition to external CSS and fix imperative component styles ([8120c37](https://codeberg.org/tjdavid/coralite/commit/8120c377d7ca7184335a789a2d52d2190ab769b0))

### 🐛 Bug Fixes

- relocate onBeforeComponentRender hook execution ([327a416](https://codeberg.org/tjdavid/coralite/commit/327a4160f180051944d29990f3d354fb42e68d70))
- production CSS minification and robust component registration ([29b7d31](https://codeberg.org/tjdavid/coralite/commit/29b7d31ae609839f4c9e81771a040149210227f9))


## v0.38.3

> Comparing `coralite-v0.38.2` to `HEAD`

**Summary:** 7 commits

### ✨ Features

- process HTML and reorder lifecycle hooks (coralite) ([90f8dbc](https://codeberg.org/tjdavid/coralite/commit/90f8dbcee9accb3d9ddfdbbd0120f12349960fed))

### 🐛 Bug Fixes

- ensure sitemap includes all pages during incremental builds (website) ([9504e0e](https://codeberg.org/tjdavid/coralite/commit/9504e0ed80a2b88b66de47177bb83f58da71cf8e))

### 📚 Documentation

- emphasize page-component boundary and discourage page-level scripts ([00bf65d](https://codeberg.org/tjdavid/coralite/commit/00bf65d4a35dfc7bd2f2e85776ac03e44f642573))

### 🎨 Styles

- format test fixtures for consistency ([99d0f16](https://codeberg.org/tjdavid/coralite/commit/99d0f161c35ce8e4a58067fd23c5be95919af1fe))

### ♻️ Code Refactoring

- e2e test audit and fixture restructuring ([57961e3](https://codeberg.org/tjdavid/coralite/commit/57961e32dc65d2d56014bd4b6e1f12d1cc5d3b98))
- align E2E tests and fixtures with 'pages are consumers' architecture ([3ff589e](https://codeberg.org/tjdavid/coralite/commit/3ff589e516725dbffee3231706d089062efa51d8))

### 🧹 Chores

- remove unused tests ([947db01](https://codeberg.org/tjdavid/coralite/commit/947db016e8690e4e392840129a5d567f3bdd6201))


## v0.38.2

> Comparing `coralite-v0.38.1` to `HEAD`

**Summary:** 1 commit

### 🐛 Bug Fixes

- ensure server() results propagate to client state and getters ([bca02d2](https://codeberg.org/tjdavid/coralite/commit/bca02d2b9f8605a00ef828e04f54b50dbd803bab))


## v0.38.1

> Comparing `coralite-v0.38.0` to `HEAD`

**Summary:** 3 commits

### ✨ Features

- handle dynamically loading components via innerHTML ([ba6c3a1](https://codeberg.org/tjdavid/coralite/commit/ba6c3a1de92640b1d4678065280a073777812d13))

### 🐛 Bug Fixes

- provide client-side plugins with config and remove values (coralite) ([67c8246](https://codeberg.org/tjdavid/coralite/commit/67c8246ac26c434979b9fc1eee7abaa0cc555d67))
- correctly type instanceContext in plugin context functions ([c3cdfaf](https://codeberg.org/tjdavid/coralite/commit/c3cdfafe3a148e72ee533e468b86f704efb502ec))


## v0.38.0

> Comparing `coralite-v0.37.2` to `HEAD`

**Summary:** 20 commits

### ✨ Features

- implement namespaced plugin access with lazy resolution and caching ([374735e](https://codeberg.org/tjdavid/coralite/commit/374735e31bfdc57fbfaec2318be0b8b2e3e103d0))
- enforce two-phase plugin pattern and fix base evaluation path population ([55be180](https://codeberg.org/tjdavid/coralite/commit/55be18019f623ab9fa559ea973c8f0cbed198bac))
- improve createTestProject and refactor unit tests ([fddf2ab](https://codeberg.org/tjdavid/coralite/commit/fddf2ab4ef7c4c2373136ab4a1b5e9b05283094d))
- implement on-demand script loading for imperative components (core) ([fc6803e](https://codeberg.org/tjdavid/coralite/commit/fc6803e7333a301cdfe72f931239aaa57139ca1f))
- site-wide bundling for development with incremental updates ([1cfa40c](https://codeberg.org/tjdavid/coralite/commit/1cfa40c881c5a334671c8d5a051de8c1defedeec))
- site-wide stable chunk hashes and browser caching. ([c419e5d](https://codeberg.org/tjdavid/coralite/commit/c419e5d74f1fcbdcc2f526d203ecb7b095f9f098))
- remove server.exports virtual modules in favor of server.context injection (plugins) ([2e23859](https://codeberg.org/tjdavid/coralite/commit/2e238592f0dd08e35d2a242d3bd0672a6643bd3f))
- implement isomorphic contextual resolution for plugins (core) ([59c6fd1](https://codeberg.org/tjdavid/coralite/commit/59c6fd1b919e2e61f4009febe1fb18681b7dc45f))

### 🐛 Bug Fixes

- correct CLI import path and sync version (coralite) ([3674fec](https://codeberg.org/tjdavid/coralite/commit/3674fecb17d4ab24ff2fae9b1f36b20817d4dd65))
- ensure metadata is correctly extracted from components in head (plugins) ([4c7fe7d](https://codeberg.org/tjdavid/coralite/commit/4c7fe7db47e90b76efa0742b2765739ccb53ae93))
- use async locators to resolve race conditions in tests (e2e) ([cf7a1bf](https://codeberg.org/tjdavid/coralite/commit/cf7a1bf5bf5f9b820cf0fc90e2d5ab26c78f2dd0))
- prevent overwriting existing data-testid attributes (testing) ([84b2176](https://codeberg.org/tjdavid/coralite/commit/84b21762c93453f2d5bdaabf5c95edc47a48054d))

### ⚡ Performance Improvements

- replace forEach loops with traditional for loops in renderer.js ([e1bc823](https://codeberg.org/tjdavid/coralite/commit/e1bc823663aae558f31e28fe17253f8663e0811f))

### 📚 Documentation

- clarify Two-Phase Resolver pattern in server context ([1cb03f7](https://codeberg.org/tjdavid/coralite/commit/1cb03f7d7e2c6a0e76cfa0b98708be5174763a69))
- update defineComponent guide and error message ([7f5389c](https://codeberg.org/tjdavid/coralite/commit/7f5389c73e3664fadeef55f75ce2bf7d90104538))

### ♻️ Code Refactoring

- simplify complex conditional in script-manager.js ([fb24917](https://codeberg.org/tjdavid/coralite/commit/fb2491787d36e90439d402f81e0e8005b8ece1dd))
- use options objects for internal renderer functions (coralite) ([df2b5c9](https://codeberg.org/tjdavid/coralite/commit/df2b5c924d9a4fad4e5ba724ee8c63dc11005b27))
- remove plugin setup phase in favor of context phase 1 ([7287e73](https://codeberg.org/tjdavid/coralite/commit/7287e73c3e120bf88805b25d7d728efb4cfc480a))

### ✅ Tests

- add global context mutation and inter-plugin interop tests (server & client) ([4536814](https://codeberg.org/tjdavid/coralite/commit/4536814eabf795e2b8364d67f72a0d6ed5462b5d))
- add build-utils unit tests and fix test paths (coralite-scripts) ([71e015b](https://codeberg.org/tjdavid/coralite/commit/71e015b79153809f8cbaefebf305da6c00286fe0))


## v0.37.2

> Comparing `coralite-v0.37.1` to `HEAD`

**Summary:** 1 commit

### 🐛 Bug Fixes

- bundle missing plugin and utility files for browser runtime (build) ([8bbcf1f](https://codeberg.org/tjdavid/coralite/commit/8bbcf1f50fa3a53f4338e51084cbba9448974c04))


## v0.37.1

> Comparing `coralite-v0.37.0` to `HEAD`

**Summary:** 2 commits

### 🐛 Bug Fixes

- clear script cache on component changes in dev server ([2e90be0](https://codeberg.org/tjdavid/coralite/commit/2e90be03f20776d2219af8650945e3589c1abb32))
- robust filesystem operations in staticAssetPlugin (plugins) ([b6aa2c3](https://codeberg.org/tjdavid/coralite/commit/b6aa2c3f5955d608d5a34000dbcd89223dbf3c56))


## v0.37.0

> Comparing `coralite-v0.36.3` to `HEAD`

**Summary:** 59 commits

### ✨ Features

- replace md5 with xxHash64 for manifest hashing ([b89a71d](https://codeberg.org/tjdavid/coralite/commit/b89a71dd6cafedf3d90bb27d619d78e957e3acb1))
- reintegrate CoraliteError across the engine ([805a475](https://codeberg.org/tjdavid/coralite/commit/805a475af72347bf10a0158d61f72834e2ac7458))
- force rebuild in development mode for renderer (coralite) ([e44c954](https://codeberg.org/tjdavid/coralite/commit/e44c9545bf50839e606ce21d8f1acdbd45bc185d))
- integrate refs plugin into core ([43e81bd](https://codeberg.org/tjdavid/coralite/commit/43e81bd167b30c40c765d27d8f460bf04c218c2c))
- Inject plugin name into client context ([9c9aeb2](https://codeberg.org/tjdavid/coralite/commit/9c9aeb251d45c3da3355ebb4f263d60e933a92d5))
- advanced visual error reporting with source snippets and robust VM location recovery ([04982d9](https://codeberg.org/tjdavid/coralite/commit/04982d95bb510b3860f5f85e99b755427a381207))
- visual error reporting with code snippets and source pointers ([9c3faf8](https://codeberg.org/tjdavid/coralite/commit/9c3faf88cda8c4066b17182aa52d4eede799579b))
- replace coralite-plugin-aggregation with local implementation ([dd9522a](https://codeberg.org/tjdavid/coralite/commit/dd9522a81b8c0e724a54cabc0c53da8aa8dfb578))
- add isomorphic e2e registry test and update plugin typedefs ([64cb3e0](https://codeberg.org/tjdavid/coralite/commit/64cb3e068829eb55f5651727f850bcba74d488e1))
- implement Plugin Service Registry and parallel initialization ([dd3d39c](https://codeberg.org/tjdavid/coralite/commit/dd3d39ca29303e384f8ce0a87e80caf96f5e3f98))
- Enhance documentation with asset management and plugin details ([ba50d9b](https://codeberg.org/tjdavid/coralite/commit/ba50d9b860488e4acd2145cf92275216030575b2))

### 🐛 Bug Fixes

- harden regular expressions against ReDoS in error handling ([508b67e](https://codeberg.org/tjdavid/coralite/commit/508b67e5c543fa8387e1bb26e545f2575d368fd0))
- move build queue resolution after onBeforeBuild hooks ([885bad3](https://codeberg.org/tjdavid/coralite/commit/885bad35b867039c3a007b7b295f25ccb0b3152b))
- move defaultValues out of compiled js and refactor base registration ([7fcce0f](https://codeberg.org/tjdavid/coralite/commit/7fcce0fa110578745bef8dc1911446a238a4b781))
- implement robust importModuleDynamically for VM modules ([593bc82](https://codeberg.org/tjdavid/coralite/commit/593bc823a830d0c6c073923308ec72d689b28d67))
- prevent server-side utility leakage into client bundle ([5797410](https://codeberg.org/tjdavid/coralite/commit/5797410b2057bec0029842185a91487d8602cf20))
- prevent server.exports leaking into component data state ([c80400c](https://codeberg.org/tjdavid/coralite/commit/c80400c1b606f96570fc2560de9b7b10a056dced))
- prevent plugin exports from leaking into component state (with physical fixtures) ([e2349ae](https://codeberg.org/tjdavid/coralite/commit/e2349aecbfa8b86922e021053e69bea6f7bc3f24))
- resolve plugin name conflict and clean up dead code ([79f2e79](https://codeberg.org/tjdavid/coralite/commit/79f2e79d987d04e208ebac316473ff26df7c79e8))
- prevent plugin name conflict from externalizing imports ([9512db1](https://codeberg.org/tjdavid/coralite/commit/9512db101d5332f421d1c548d2d940db301138ae))
- resolve all tsc errors and export types from coralite ([75f5466](https://codeberg.org/tjdavid/coralite/commit/75f5466019807e0b565eb31a557133e82be42998))
- resolve all pnpm run lint errors\n\nSystematically addressed all lint errors across the repository by:\n\n- Removing unused variables, arguments, and imports.\n- Refactoring `catch (e)` to `catch` where the error object was unused.\n- Adding missing JSDoc descriptions in `eslint.config.js`.\n- Fixing indentation issues in documentation files.\n- Ensuring all unit tests pass after changes. ([632fa7d](https://codeberg.org/tjdavid/coralite/commit/632fa7dd67c4de87e936539f57dac84a5e2633ce))
- namespaced plugin context and cleanup phase 2 pollution ([292c95a](https://codeberg.org/tjdavid/coralite/commit/292c95ad84817c9abe05e467d11bc1a44d9a1355))
- improve plugin export function types ([a4d3536](https://codeberg.org/tjdavid/coralite/commit/a4d353696971de5e778f3fee463eb0fba3192cd5))
- handle page object correctly in head components ([cc2002d](https://codeberg.org/tjdavid/coralite/commit/cc2002d4f1e1b7edf44f345a4950721aa379ad50))
- improve component debugging and sourcemap accuracy (core) ([799162a](https://codeberg.org/tjdavid/coralite/commit/799162ac96ca1bfd4cdb774e348f473c4b64d89d))
- isolate server-side dependencies from client runtime ([cdd57ed](https://codeberg.org/tjdavid/coralite/commit/cdd57ed304203c4d1019a62de0ff2c75681dad9a))
- implement "Void = Bypass" paradigm for slots (core) ([251d41c](https://codeberg.org/tjdavid/coralite/commit/251d41cf74e5634839bf1d8c8e3dd32a49bce957))
- Correct indentation in registry test fixture HTML (coralite) ([15fdda2](https://codeberg.org/tjdavid/coralite/commit/15fdda28d5e3fecda10cc4baa8cdd162e8c5fa57))

### ⚡ Performance Improvements

- optimize dev-mode rendering performance ([b56b3e4](https://codeberg.org/tjdavid/coralite/commit/b56b3e44a71c00a342ab815fdd9d5ba879f5d816))
- optimize AST node creation and cloning ([7650ca3](https://codeberg.org/tjdavid/coralite/commit/7650ca3cd1262f9f44a86f0a1b25d9e2fe4e1b18))

### 📚 Documentation

- update plugin context documentation and API schema (api) ([0c3968b](https://codeberg.org/tjdavid/coralite/commit/0c3968bdbe119fe106fdf0dd553d838ccb1a3bc1))
- add missing JSDoc descriptions to @params and @propertys ([d48c4a8](https://codeberg.org/tjdavid/coralite/commit/d48c4a8c9b983304ab9e41058a9dd95735387f77))
- update architecture documentation ([1e36a80](https://codeberg.org/tjdavid/coralite/commit/1e36a8019bc513b5b4f5fe15f3ca97aae9ae4073))
- "Void = Bypass" for slots (core) ([b55cf10](https://codeberg.org/tjdavid/coralite/commit/b55cf1045090df324b329cce4a23ecc696476193))
- refine plugin documentation and implementation for global context and config ([d0a8d86](https://codeberg.org/tjdavid/coralite/commit/d0a8d861cd5e3ac1331598f03bd4ee58b0ae80eb))

### ♻️ Code Refactoring

- Update type definition for XXHash64Raw in manifest (coralite) ([bdc7013](https://codeberg.org/tjdavid/coralite/commit/bdc7013af9d86d689bf4928a24302cdca6076006))
- Update imports to use core and server utilities (benchmarks) ([f906471](https://codeberg.org/tjdavid/coralite/commit/f906471745a128a417993caa0e88c1d83df55225))
- reoganise utilities (coralite) ([5b3e385](https://codeberg.org/tjdavid/coralite/commit/5b3e38597ee43c0aa818fcca1b84248e98bfad4c))
- Ensure slots property is an array before processing ([601ca8e](https://codeberg.org/tjdavid/coralite/commit/601ca8e947c962bafbf207c8d2274ea03b96a8db))
- simplify JSDoc type organization and exports ([34354c9](https://codeberg.org/tjdavid/coralite/commit/34354c9efba398c1ece54dc9ee513b0a45bccdb9))
- Update plugin callback signatures for better type safety ([d281db0](https://codeberg.org/tjdavid/coralite/commit/d281db053a7ef30168ffaec1cc959889b806e293))
- update plugin Phase 1 signature to single argument ([6704122](https://codeberg.org/tjdavid/coralite/commit/6704122ffa0fda48daabd555b7eac04304d3383a))
- rename HTMLData physical property to virtual ([0cd533d](https://codeberg.org/tjdavid/coralite/commit/0cd533d2adad84003ca29c0fdb95a3803aec7b5c))
- enhance server-side DOM API and ensure AST integrity ([df003b6](https://codeberg.org/tjdavid/coralite/commit/df003b6e90267804bba49529a2cb4b8f69823959))
- removes numbered comments across various files ([861eeda](https://codeberg.org/tjdavid/coralite/commit/861eeda65924a6a2e25ef9881c97e3e1fcd0b412))
- resolve JSDoc and type check nitpicks ([1e96f31](https://codeberg.org/tjdavid/coralite/commit/1e96f3175b6fce5d7247b6e600ac537019577b4f))
- convert Coralite class to async factory function ([0827da6](https://codeberg.org/tjdavid/coralite/commit/0827da6d04dadd5df2bf3a87dc8041128ca5c367))
- Include registry in library build process (coralite) ([ce4ae83](https://codeberg.org/tjdavid/coralite/commit/ce4ae834b49382137c8a5938c63dfb2455673998))
- Update TypeScript target to ES2024 (coralite) ([824a700](https://codeberg.org/tjdavid/coralite/commit/824a700b5536f1f38a4a0197fb46e8cfd70dc6d3))
- Disable strict mode in tsconfig.json (coralite) ([cb20ce6](https://codeberg.org/tjdavid/coralite/commit/cb20ce6fec09b66d7caf1c4c12e67bb34eeec215))

### 🧹 Chores

- Update coralite executable permissions (build) ([33abe6b](https://codeberg.org/tjdavid/coralite/commit/33abe6bcb4de1a5567914ebe465419d08251f0d2))
- replace jsconfig.json with tsconfig.json and fix type errors ([49dfd0d](https://codeberg.org/tjdavid/coralite/commit/49dfd0db7c8181c1bf03845497d3890c880107e1))
- Add @types/serialize-javascript dependency to coralite package ([339d8b5](https://codeberg.org/tjdavid/coralite/commit/339d8b588a781f63c6cee8df34fcb2b5505050e3))

### 🔨 Other Changes

- Implement ISR and Three-Phase Sealed Queue Architecture ([31df5e6](https://codeberg.org/tjdavid/coralite/commit/31df5e67371263bf038e83b1762abae496354182))
- Refactor JSDoc types and improve public API definition ([2ceefa6](https://codeberg.org/tjdavid/coralite/commit/2ceefa61aae06aea9fc0410ab437dade3e505e05))
- Refactor: Modularize Coralite engine into specialized factories ([a64ca3e](https://codeberg.org/tjdavid/coralite/commit/a64ca3eb6897b8fd007493e66459989a218c8b2d))
- styles: add spacing ([4097b61](https://codeberg.org/tjdavid/coralite/commit/4097b61909a23ae27c4cc7269d541dbe13c5cc15))
- Refactor plugin system to use sequential global context mutation ([31e9ea8](https://codeberg.org/tjdavid/coralite/commit/31e9ea8c82b7ebb9d8ad6e232abf5cb100036e93))


## v0.36.3

> Comparing `coralite-v0.36.2` to `HEAD`

**Summary:** 3 commits

### 📚 Documentation

- Update README for coralite manual installation instructions ([63c992d](https://codeberg.org/tjdavid/coralite/commit/63c992d7e17ea193d28145139b6856e553bfd2a1))
- standardize plugin hooks with explicit context objects and improved JSDocs ([91cd45e](https://codeberg.org/tjdavid/coralite/commit/91cd45ebe781b0688db52d725b0bda223daf1173))
- refine plugin hook JSDocs with flat context intersections ([03aeb33](https://codeberg.org/tjdavid/coralite/commit/03aeb33cf6ffdcff01c5275454f9cfe91e3e6e82))


## v0.36.2

> Comparing `coralite-v0.36.1` to `HEAD`

**Summary:** 2 commits

### 🐛 Bug Fixes

- build optimization and resolution fix ([5926f5b](https://codeberg.org/tjdavid/coralite/commit/5926f5b85d4cfea4ed144520b57951e0c67cef39))

### ♻️ Code Refactoring

- adjust plugin imports in build script (tests) ([0938669](https://codeberg.org/tjdavid/coralite/commit/09386698a06d7b675d057fad0f77ae8f366914c9))


## v0.36.1

> Comparing `coralite-v0.36.0` to `HEAD`

**Summary:** 1 commit

### 🐛 Bug Fixes

- ensure HTML hydration respects binding type and preserves attributes ([63af2d9](https://codeberg.org/tjdavid/coralite/commit/63af2d9c5df4acb284ac21dcbbc71b3b70c2aeea))


## v0.36.0

> Comparing `coralite-v0.35.0` to `HEAD`

**Summary:** 38 commits

### ✨ Features

- implement modular styles configuration and generic build pipeline ([46f42a4](https://codeberg.org/tjdavid/coralite/commit/46f42a4b1b32e925c18c9061104f7ebf7c8b00cd))
- implement no-hydration attribute for host-tag and c-token stripping ([132d1e7](https://codeberg.org/tjdavid/coralite/commit/132d1e790a9eb3c28375931e10e787ed68f85853))
- implement onDisconnected plugin hook (coralite) ([ce18093](https://codeberg.org/tjdavid/coralite/commit/ce18093f1ab23233d67f314c4746a65c02001ac3))
- implement client-side hooks for onBeforeComponentRender and onAfterComponentRender ([553f2d9](https://codeberg.org/tjdavid/coralite/commit/553f2d958c8a6254db68d0b30c6303e4b3443e91))
- refactor Coralite to native Web Component hydration ([a8b2391](https://codeberg.org/tjdavid/coralite/commit/a8b2391aa97892e27a1d866140be90349cd59523))
- implement whitelist-based boolean attribute interception ([22c963f](https://codeberg.org/tjdavid/coralite/commit/22c963fcdb1da9ed67505947de9d3c350d37e9ea))

### 🐛 Bug Fixes

- align types for component options and refs in client runtime (coralite) ([c7f58f0](https://codeberg.org/tjdavid/coralite/commit/c7f58f002105e93a4796fc24a4792be4da6dbb96))
- prevent ReferenceError: HTMLElement is not defined in Node.js ([3da3ee0](https://codeberg.org/tjdavid/coralite/commit/3da3ee00b2f2795dfbfcd48d86b5676c9e284404))
- resolve TypeScript errors in coralite-element and refs plugin ([0376524](https://codeberg.org/tjdavid/coralite/commit/037652447a8fa3d1ab9cbd688a0a7e1564476c89))
- fix hydration map root path boundary (coralite) ([1b3166d](https://codeberg.org/tjdavid/coralite/commit/1b3166dd606836f275da70c28d83a8e70495ab0d))
- include component render hooks and preserve hydration state ([0424af7](https://codeberg.org/tjdavid/coralite/commit/0424af7e769156bcb7c3b1f3ff06598be2f761ac))
- resolve website build failure by unbundling coralite lib and improving asset writing ([c247c12](https://codeberg.org/tjdavid/coralite/commit/c247c12d684ed74ee830fa8d9d6e3515c6dc420d))
- component state isolation & SSR lifecycle hooks ([5ce0d92](https://codeberg.org/tjdavid/coralite/commit/5ce0d92b74b6eb0911fb173abf5f712e697c1a00))
- implement whitelist-based boolean attribute interception ([e324431](https://codeberg.org/tjdavid/coralite/commit/e324431d17213f4d65d220d6b84b3604f49874fb))

### 📚 Documentation

- update READMEs and website for 1.0.0 release ([c056c60](https://codeberg.org/tjdavid/coralite/commit/c056c60076e9caeb07d1d273835ef6c31bc7db0c))
- add CoraliteSession typedef and update JSDocs across codebase ([72f0dbf](https://codeberg.org/tjdavid/coralite/commit/72f0dbfd9bfd91ba2ffab1aecd572a917e05ce06))
- add comprehensive JSDoc to CoraliteElement ([1277f7e](https://codeberg.org/tjdavid/coralite/commit/1277f7ea2c9eae6fb19b5fad361ecf6752723292))
- update llms directives for ast splicing ([fd8e41a](https://codeberg.org/tjdavid/coralite/commit/fd8e41ae49f362303531262293c231988c70de46))
- update llms documentation with css scoping details ([bce0deb](https://codeberg.org/tjdavid/coralite/commit/bce0deb72b9d69b4132ef5872bccb5488d054221))

### ♻️ Code Refactoring

- update root element type in signature (coralite) ([892bef2](https://codeberg.org/tjdavid/coralite/commit/892bef299ec48801ff3f7d3b07cd4bad2e4d1ab0))
- replace render context with session object (coralite) ([48d15a5](https://codeberg.org/tjdavid/coralite/commit/48d15a56d7c65b236af50134f14f6883ec1459c2))
- introduce render versioning for race condition safety (coralite) ([a0dee82](https://codeberg.org/tjdavid/coralite/commit/a0dee82bac6e546f84d00cc82043e111d7455f6c))
- remove initial ref hydration in CoraliteElement ([4e98591](https://codeberg.org/tjdavid/coralite/commit/4e98591ede470c957277e15813807954e8be6d09))
- update context handling to use renderContext (runtime) ([7571207](https://codeberg.org/tjdavid/coralite/commit/7571207703153f1f9f61f6d00cb02c871d8d625e))
- rename renderContext to session and update hook payloads ([f56536f](https://codeberg.org/tjdavid/coralite/commit/f56536fa900bc704545beacf78846f0c602f626d))
- implement deterministic component IDs (core) ([834a8c8](https://codeberg.org/tjdavid/coralite/commit/834a8c83d6ad5b662736593e4dce2acd8f94a534))
- improve slot handling and runtime generation (coralite) ([755ecca](https://codeberg.org/tjdavid/coralite/commit/755ecca7ccb8624a9da12db8ffdbe4c13bd4d021))
- implement isomorphic plugin API with server/client separation ([cafd013](https://codeberg.org/tjdavid/coralite/commit/cafd013c8439803d374ff6b75c3eb39e76f418b4))
- adjust hydration map generation logic (coralite) ([43508f4](https://codeberg.org/tjdavid/coralite/commit/43508f4fdace7368adb78768c78e6e2484c35901))

### ✅ Tests

- migrate unit tests to happy-dom ([27447ce](https://codeberg.org/tjdavid/coralite/commit/27447ce51f0c03ebb2cc8c45db61f7f1c587848e))
- update test fixture selectors to use refs (fixtures) ([d9dcc73](https://codeberg.org/tjdavid/coralite/commit/d9dcc73fd71e116963b8328b4f78a1e1dfb85c0c))
- update e2e tests to use refs and testingPlugin pattern ([0eb0d5c](https://codeberg.org/tjdavid/coralite/commit/0eb0d5c2261b98fbd25ba543f4052ed2d4201efe))
- add e2e tests for boolean attributes ([773960e](https://codeberg.org/tjdavid/coralite/commit/773960e5ebb290e06c3fb923c108339942b1e993))

### 🧹 Chores

- update post-css ([2891819](https://codeberg.org/tjdavid/coralite/commit/28918194a34f9038a4b350d3f93d270373d8d961))
- Updates Playwright test dependency to version 1.60.0. ([fb869d8](https://codeberg.org/tjdavid/coralite/commit/fb869d82a016beb5bc99a85f74a18ae2a8410ede))

### 🔨 Other Changes

- Merge branch 'web-components' ([305aef8](https://codeberg.org/tjdavid/coralite/commit/305aef866363e088241253bdbb901b13296c8c64))
- Fix component scope leakage and implement isomorphic lifecycle hooks ([64e72d4](https://codeberg.org/tjdavid/coralite/commit/64e72d485daf1ef1266dfc3faccad3acd8fd6e6e))
- Refactor: Final clean removal of root from all script and plugin contexts ([5567c93](https://codeberg.org/tjdavid/coralite/commit/5567c9357ad0bab5cafe0cfdd8271d0734c41e25))


## v0.35.0

> Comparing `coralite-v0.34.0` to `HEAD`

**Summary:** 18 commits

### ✨ Features

- rename method API to exports and improve context injection (plugin) ([fe165f7](https://codeberg.org/tjdavid/coralite/commit/fe165f7959fa5892e482086c3dca14465890ef5c))

### 🐛 Bug Fixes

- update e2e tests for new plugin exports API ([230dcd2](https://codeberg.org/tjdavid/coralite/commit/230dcd2d8c133f3a84bdf22403c9956807e24e7c))
- protect internal properties and prototype methods with Object.defineProperties (coralite) ([6fc5e6c](https://codeberg.org/tjdavid/coralite/commit/6fc5e6ccdcffc6bd99936f1f2a800f2fc602b740))

### ⚡ Performance Improvements

- overhaul production memory management for 1M+ page scalability ([8223203](https://codeberg.org/tjdavid/coralite/commit/8223203aca181dee7c8a00fc1571c94ce9c8c7f7))
- optimize memory footprint by implementing on-demand parsing for pages ([94f90c6](https://codeberg.org/tjdavid/coralite/commit/94f90c67315e577d93d347161c0974d66edd8489))

### 📚 Documentation

- clarified `llms.txt` regarding the plugin exports system and virtual module imports. ([91a895b](https://codeberg.org/tjdavid/coralite/commit/91a895bb826e589ead4e080df2eed532f007cac7))
- remove deprecated definePlugin method from state plugin ([7b7ef69](https://codeberg.org/tjdavid/coralite/commit/7b7ef697f152cf2391027ab3e0ad1bc393635511))
- update plugin export documentation for server-side context ([60cadf6](https://codeberg.org/tjdavid/coralite/commit/60cadf6203b710c98ed93d3f53fe801b20cc9844))
- Revise exports to use two-phase currying and virtual modules. (plugins) ([d796257](https://codeberg.org/tjdavid/coralite/commit/d796257d86c688690fed78c64084b96a2446696a))
- document plugin exports context binding (website) ([e725a88](https://codeberg.org/tjdavid/coralite/commit/e725a88bc17c7d07076271293f6420d243c261b1))

### ♻️ Code Refactoring

- eliminate code smells and update typings (plugins) ([a2e7ec0](https://codeberg.org/tjdavid/coralite/commit/a2e7ec0a884e6a9b0b30eb8ac4641be5bcd8e9ea))
- clean up unused plugin typedefs (types) ([188123e](https://codeberg.org/tjdavid/coralite/commit/188123eb5984c376a8f68d903dfe782bdab67532))
- bind plugin context via 'this' instead of trailing argument ([881c288](https://codeberg.org/tjdavid/coralite/commit/881c288c824c5e7b66421f246fab1e9244423d42))
- resolve code smells in core engine (coralite) ([f97ccf6](https://codeberg.org/tjdavid/coralite/commit/f97ccf64ef3a01d4e5fcf91624fc9ae1ed6f7bb9))
- Update LLM directives for Coralite component development ([9080175](https://codeberg.org/tjdavid/coralite/commit/90801756e95581df871681fc98b0c9d2ebba71f6))

### ✅ Tests

- add CLI selection to benchmark script (coralite) ([e3dd4f3](https://codeberg.org/tjdavid/coralite/commit/e3dd4f3f4f0570560d075e3bc94764b3767e9cfc))

### 🧹 Chores

- remove unused file ([725b55c](https://codeberg.org/tjdavid/coralite/commit/725b55c03db6ba17bedf7cd4d7063829931ca420))

### 💥 Breaking Changes

- coralite plugin exports to two-phase currying ([157060c](https://codeberg.org/tjdavid/coralite/commit/157060ca62cba365ca2a337722a4fe567a78cd21))


## v0.34.0

> Comparing `coralite-v0.33.1` to `HEAD`

**Summary:** 11 commits

### ✨ Features

- improve error reporting with CoraliteError ([3705145](https://codeberg.org/tjdavid/coralite/commit/3705145138a1c395a4f54dbe6acb7045cc929caf))

### 📚 Documentation

- update user card component example (coralite) ([5f814d4](https://codeberg.org/tjdavid/coralite/commit/5f814d4f5b7ffd7f6c503690f121233b55506a23))
- update documentation across core concepts ([0c4fc91](https://codeberg.org/tjdavid/coralite/commit/0c4fc91e2bb89a327ab1ac8f83d6b9ad99259c9f))
- update script context arguments documentation ([6abfc7b](https://codeberg.org/tjdavid/coralite/commit/6abfc7b23a5ed2af606451be4db166a8fa1751d3))
- update llms directives for coralite ([2fa8ea0](https://codeberg.org/tjdavid/coralite/commit/2fa8ea08f180372ce1c11f1c4deab6c4c9f601ce))
- update component and plugin APIs (coralite) ([6b01545](https://codeberg.org/tjdavid/coralite/commit/6b0154555ea449e71638d9277522d939f4977b5a))
- define property patterns in website and llms.txt ([ab5c564](https://codeberg.org/tjdavid/coralite/commit/ab5c5648af47949ae224621f79259dc43447a60a))

### ♻️ Code Refactoring

- Improve attribute and getter formatting in component fixtures (tests) ([3485f64](https://codeberg.org/tjdavid/coralite/commit/3485f641d9de7e9179f33d51c0f9a366db8c3a09))
- enforce read-only state access in getters (coralite) ([1c58aa7](https://codeberg.org/tjdavid/coralite/commit/1c58aa7d1b316329b6c1a72feac50b4b8aea4407))

### 💥 Breaking Changes

- upgrade Coralite API ([14326e0](https://codeberg.org/tjdavid/coralite/commit/14326e042c08388df6b6fdddfc6a12054e9dbdc2))

### 🔨 Other Changes

- tests: update E2E tests and core for defineComponent ([43d9567](https://codeberg.org/tjdavid/coralite/commit/43d95674341931c96f5ab722246a00dbdc54f0e8))


## v0.33.1

> Comparing `coralite-v0.33.0` to `HEAD`

**Summary:** 3 commits

### ✨ Features

- Include llms.txt in package files (coralite) ([ddcaa01](https://codeberg.org/tjdavid/coralite/commit/ddcaa01cae94eb6b0842ad10851d457d905be05c))

### 🐛 Bug Fixes

- prevent circular structure error during serialization and refactor utilities ([ecdcf9d](https://codeberg.org/tjdavid/coralite/commit/ecdcf9da39f1607773016ac75670f1e4793b5d69))

### 🧹 Chores

- update changelog to v0.33.0 (changelog) ([f7027ac](https://codeberg.org/tjdavid/coralite/commit/f7027ac4a8d02f33bb907e0fad7a9e82565f4ba6))


## v0.33.0

> Comparing `coralite-v0.32.0` to `HEAD`

**Summary:** 62 commits

### ✨ Features

- inject readiness script into component root (coralite) ([44faba4](https://codeberg.org/tjdavid/coralite/commit/44faba4247e048b3703fa348dd949b8e469075ec))
- infer client rootDir from caller context (plugin) ([f9d2f34](https://codeberg.org/tjdavid/coralite/commit/f9d2f34d3c2ef5fafae5cde35eb403c60d6f261c))
- add components processing capability (plugin) ([2d583d2](https://codeberg.org/tjdavid/coralite/commit/2d583d293e63ed3b958234a68b49a6b1b24c5eed))
- implement dynamic property evaluation and attribute synchronization for components ([c9a07ca](https://codeberg.org/tjdavid/coralite/commit/c9a07ca6489bee35119d8090ac6abb5259515ef3))
- implement reactive properties support for components with dynamic evaluation and attribute synchronization ([69ed04a](https://codeberg.org/tjdavid/coralite/commit/69ed04a828f79cc8c9e2e41e8c17dcb67192b4ab))
- add mitata micro-benchmarks suite for core architecture ([6169228](https://codeberg.org/tjdavid/coralite/commit/616922865c8d4e03fccd5a8f7ddd388aa5f97905))
- implement `_triggerPluginAggregateHook` for array aggregation ([8a43bdf](https://codeberg.org/tjdavid/coralite/commit/8a43bdf0c8b24ba931971a8d081fba365422a066))

### 🐛 Bug Fixes

- remove throwing error twice ([9bd4ca7](https://codeberg.org/tjdavid/coralite/commit/9bd4ca7d4e3df356c6b8e2f6caf381ec46d3729b))
- correct property typo, sanitize function conversions, and handle non-string results in defineComponent plugin ([110e52c](https://codeberg.org/tjdavid/coralite/commit/110e52c745bcac6211d7c89e2ba936892f6396b0))
- update async-performance benchmark ([c4f0819](https://codeberg.org/tjdavid/coralite/commit/c4f08197c1aff6160eb4223d18fe7056cfbfb2af))
- preserve token values in nested dependent components ([f9818f9](https://codeberg.org/tjdavid/coralite/commit/f9818f95556283050faa983b7e9fdca35f504c57))
- export ScriptImport type from coralite types ([dfdabc4](https://codeberg.org/tjdavid/coralite/commit/dfdabc404b9ff481a6b30c4eb1ee2f1ffd949c50))

### 📚 Documentation

- update all READMEs to V1 API and standardize Node.js requirements ([cfa3f97](https://codeberg.org/tjdavid/coralite/commit/cfa3f971f89c6cddbb5886abf0caca76a8b0c4b7))
- update client injection documentation (coralite) ([cde021b](https://codeberg.org/tjdavid/coralite/commit/cde021bd84d5d7d60bc25200203939d517493ea4))
- update documentation on data management paradigms and disable local web server in playwright config ([ec6d0b9](https://codeberg.org/tjdavid/coralite/commit/ec6d0b9b19f8d0dbc0f53651c43f446792c06bd2))
- standardize module property access from values to properties (coralite) ([004861c](https://codeberg.org/tjdavid/coralite/commit/004861cd90a912c28f82ca2591e71c31777117e9))
- refine README.md sections and hierarchy (coralite) ([0c0728e](https://codeberg.org/tjdavid/coralite/commit/0c0728e44cde93ad9e90c9a912ccf1db1a6a9dec))

### ♻️ Code Refactoring

- modularize _generatePages and update JSDoc imports ([a564485](https://codeberg.org/tjdavid/coralite/commit/a564485df858e8bd2e840fe7d0aef055158b0fe4))
- remove component parameter from internal engine functions ([8a23842](https://codeberg.org/tjdavid/coralite/commit/8a238427485181e17cf83cc2cd34e81211b1cd03))
- overhaul Coralite context architecture ([12bc4d9](https://codeberg.org/tjdavid/coralite/commit/12bc4d9fb0d2b17db259c42f8685acb245a10756))
- remove optional urlPathname from module definitions (coralite) ([dc84a26](https://codeberg.org/tjdavid/coralite/commit/dc84a26eb5ca199bfbd1849f22f30fb80cbb04dc))
- include page in component metadata (metadata) ([deb6a38](https://codeberg.org/tjdavid/coralite/commit/deb6a38b2a2c0bd14653b18a94e1d5d14e9151fe))
- improve component and page accessors (coralite) ([55a2389](https://codeberg.org/tjdavid/coralite/commit/55a2389ea03e20299fbb01a4b9d6538c6246eaf2))
- update llms documentation for clarity ([0da2df9](https://codeberg.org/tjdavid/coralite/commit/0da2df935dbab252483d2559f421e536452bc336))
- add pending hydration tracking to coralite ([30247b7](https://codeberg.org/tjdavid/coralite/commit/30247b70dc2a5f4e5c01f59840b7fc1792dca707))
- improve component loading error handling (coralite) ([7f5f6bf](https://codeberg.org/tjdavid/coralite/commit/7f5f6bfe123272213475cb8ccd4c4b7e0794a011))
- make component script functions synchronous and update mock plugin import path ([4d1b753](https://codeberg.org/tjdavid/coralite/commit/4d1b753356af9810f2fa4f1c536f6b43e6a779f9))
- simplify E2E test synchronization by removing redundant error handling and adding type ignore annotations ([be042ae](https://codeberg.org/tjdavid/coralite/commit/be042ae6cfc1a4d5531b1acb8af5eb5f193f421a))
- flatten plugin context by removing `helpers` namespace ([804503c](https://codeberg.org/tjdavid/coralite/commit/804503c7e3833fb4d008b34eede4db31b5763300))
- normalize formatting and indentation across component test fixtures ([b17d764](https://codeberg.org/tjdavid/coralite/commit/b17d764cd500a4b895e0e3300ec1f015ba7a560e))
- enforce reserved context keys in plugins and standardize code formatting across test fixtures ([b1c2721](https://codeberg.org/tjdavid/coralite/commit/b1c272179c21ccfe0779b689589ab8b934579035))
- remove redundant utility functions no longer used in codebase ([108fb74](https://codeberg.org/tjdavid/coralite/commit/108fb74e7c0d85613f421b74721e28903d6b06a6))
- rename script helpers to client context properties and simplify initialization logic ([0d23811](https://codeberg.org/tjdavid/coralite/commit/0d2381151fe71428b51e519c6f3e65b71d3181a4))
- remove extensive legacy e2e tests and optimize core testing infrastructure ([8abece7](https://codeberg.org/tjdavid/coralite/commit/8abece76399b5292deb9b58d6aea258665a2ece4))
- rename element to root in defineComponent plugin and preserve original data types for property values ([cb9b60a](https://codeberg.org/tjdavid/coralite/commit/cb9b60a9aa078d28b42415a366330ca1a790484d))
- migrate component scripts and properties to named exports for improved ESM resolution and module handling ([0053cf4](https://codeberg.org/tjdavid/coralite/commit/0053cf45aa407b5e4945d795ab150686003a9fb9))
- improve import compatibility, preserve function names in utils, and stabilize e2e test execution ([6080fbf](https://codeberg.org/tjdavid/coralite/commit/6080fbf544853c1e5de9243fe466b77780aa6068))
- replace page-related properties with a centralized global CoralitePage object ([2350ec8](https://codeberg.org/tjdavid/coralite/commit/2350ec82f65873a68d3fa80bcf57f8a142573dff))
- restructure page information and update context properties handling ([c797298](https://codeberg.org/tjdavid/coralite/commit/c797298d080910648e4082d4df4204078a7787df))
- update component architecture documentation to reflect the new properties/script API and serialization constraints. ([2b78bf4](https://codeberg.org/tjdavid/coralite/commit/2b78bf48ccf9e0cbf8f57bd4b97ca8a5365bfd64))
- clean up property token evaluation logic and update E2E tests to use Playwright locators ([4de37e3](https://codeberg.org/tjdavid/coralite/commit/4de37e3344fbccd2e0ab3dba14726a561f829acb))
- simplify defineComponent properties API and update module definitions ([0297feb](https://codeberg.org/tjdavid/coralite/commit/0297febc429df2b7b8f7a355bb79e8f893b5cbef))
- adjust script line offset calculation and update component system documentation ([c42bab4](https://codeberg.org/tjdavid/coralite/commit/c42bab4a4cfb4eb09aebed82b5b40f9d0d7c9535))
- simplify script extraction by removing redundant token/import parsing and consolidating property logic ([dd04d73](https://codeberg.org/tjdavid/coralite/commit/dd04d7316efdb07777d49b390b48a3f9d61c4608))
- update defineComponent to support dynamic property resolution and improved nested component extraction ([e9206a4](https://codeberg.org/tjdavid/coralite/commit/e9206a4b3fb0121ce3557cfb600162eeb0fa1f50))
- simplify script extraction by removing redundant tokens and imports processing logic ([4fb0523](https://codeberg.org/tjdavid/coralite/commit/4fb052379aee0de04a5bad29b5e0e6f16aa9046e))
- Update component definition syntax in tests (coralite) ([1342f20](https://codeberg.org/tjdavid/coralite/commit/1342f20fad9025aa12c995dab058c873af80ac4b))
- update test api (tests) ([65bea67](https://codeberg.org/tjdavid/coralite/commit/65bea678c37c560734544dc504f53be85b25eed0))
- update plugin API for client-side injection and helpers (llms) ([ae0e5fc](https://codeberg.org/tjdavid/coralite/commit/ae0e5fc14a8fd9a0d93e09f7450561c1d77a047e))
- rename 'values' to 'properties' in Coralite context ([8ecd469](https://codeberg.org/tjdavid/coralite/commit/8ecd469e93c4a3cd1fc551c28e521b0a389cca2d))
- rename module values to definitions across types ([365fa93](https://codeberg.org/tjdavid/coralite/commit/365fa93a32dc4ffee03dd7aa6931e47455e7f2f0))
- rename 'values' to 'properties' for context data ([f02287e](https://codeberg.org/tjdavid/coralite/commit/f02287e3eb8bdcc03a045d8d4c7507ca67209db0))
- transition plugin hooks to return state patches instead of mutating data (plugins) ([e56129f](https://codeberg.org/tjdavid/coralite/commit/e56129f9ef7cb4b0e6190b27a7cc3435f3b0abe8))

### ✅ Tests

- implement e2e test suite for imperative components, slots, client scripts, and error handling ([8c3f5fc](https://codeberg.org/tjdavid/coralite/commit/8c3f5fca0a76a2e965f06bc6555421b1631b3bbc))
- update e2e test fixtures, refactor shorthand method implementation, and disable webServer in Playwright config ([1d1e2a6](https://codeberg.org/tjdavid/coralite/commit/1d1e2a6285fda5cbae621b8dbbead09eeca4fd81))
- stabilize e2e tests, refactor shorthand methods, and update component loading logic ([b5399b7](https://codeberg.org/tjdavid/coralite/commit/b5399b7c8ecd2104dcd4f47ab66285747038ceaf))

### 🧹 Chores

- use pnpm for dev server command (coralite) ([dc2dae2](https://codeberg.org/tjdavid/coralite/commit/dc2dae267e1304ee810d40833ad9e2cd4d1b0229))
- prepare e2e refactor ([e0be1c5](https://codeberg.org/tjdavid/coralite/commit/e0be1c53a29d407b14001ffd2e7f37cd2c22640e))
- update playwright and node types dependencies (deps) ([aef71ed](https://codeberg.org/tjdavid/coralite/commit/aef71ed5b2955da2b9f046e7bfa531337b3f71b7))
- update license for coralite plugin scripts ([1157c8b](https://codeberg.org/tjdavid/coralite/commit/1157c8b48c35a09ca867817927124d1a674661c6))
- update license to MPL-2.0 ([f3cc59e](https://codeberg.org/tjdavid/coralite/commit/f3cc59e535b5a111038df6e590bb1b4ca558fb5b))
- update eslint configuration and fix linting issues ([861d7dd](https://codeberg.org/tjdavid/coralite/commit/861d7ddb27a6f24faaf0065a99c73f4aa2b0f373))


## v0.32.0

> Comparing `coralite-v0.31.7` to `HEAD`

**Summary:** 14 commits

### ✨ Features

- add deprecated `$urlPathname` property for legacy plugin compatibility (coralite) ([c6c203a](https://codeberg.org/tjdavid/coralite/commit/c6c203a5b095d7f25f4edf49a7361df0e75c04fe))
- dynamically extract and inject used globals into dev vm context ([1909968](https://codeberg.org/tjdavid/coralite/commit/1909968e358fadbfe0f6a7e28cab065d65d21136))
- add testing plugin and deterministic component counter (coralite) ([2e8306c](https://codeberg.org/tjdavid/coralite/commit/2e8306cd7bb49574c4ff3e592bdc9c8fcbf41971))

### 🐛 Bug Fixes

- deterministic initialization order for declarative client scripts in development ([6fe0fc9](https://codeberg.org/tjdavid/coralite/commit/6fe0fc936a32916c7b99f013cd3d83d266ec6383))
- extract page title from HTML custom elements ([bb9931c](https://codeberg.org/tjdavid/coralite/commit/bb9931ccaaf45a2ba202782f1b72e1a62168a9fc))
- switch plugin hook execution from parallel to sequential mode ([54b4949](https://codeberg.org/tjdavid/coralite/commit/54b49496766b0a453b75f76627d0846648f2c5f5))
- update metadata namespacing and add onPageUpdate support (plugin) ([8f9b92a](https://codeberg.org/tjdavid/coralite/commit/8f9b92aac3e17b6902a9091658900dcf49a21f82))
- escape backslashes in dom-serializer import path on windows (coralite) ([9ca736c](https://codeberg.org/tjdavid/coralite/commit/9ca736cc5c8d5010fdd356316dc21084e9f923ef))

### ⚡ Performance Improvements

- optimize object iterations and lookups in script-manager.js ([cd6390f](https://codeberg.org/tjdavid/coralite/commit/cd6390f14b0769c5f998fdff9809568378fd3535))

### 📚 Documentation

- document built-in page variables and update navigation ([91b829d](https://codeberg.org/tjdavid/coralite/commit/91b829d46616cc74e81970dd9b1b4f6c6711ad1e))
- update E2E testing docs with namespaced data-testid details ([de94b83](https://codeberg.org/tjdavid/coralite/commit/de94b830d99e42276a3a42d61ded09d3b41cc652))
- update llms.txt to match current codebase ([42d7ef9](https://codeberg.org/tjdavid/coralite/commit/42d7ef98db68d0d22e2d8f57c498a08082678ad9))

### 🧹 Chores

- remove redundant comment in metadata extraction logic ([2cf78c3](https://codeberg.org/tjdavid/coralite/commit/2cf78c3f10149fe73e9d11f43c2f2343994f70ea))

### 💥 Breaking Changes

- update built-in variables to use `page_*` prefix ([e8d1649](https://codeberg.org/tjdavid/coralite/commit/e8d1649e5fb30ff2c1ea5fade9d57026ae7e0db0))


## v0.31.7

> Comparing `coralite-v0.31.6` to `HEAD`

**Summary:** 4 commits

### 🐛 Bug Fixes

- remove deprecated `root` property and update type definitions ([5910e59](https://codeberg.org/tjdavid/coralite/commit/5910e5990a179ce5e342d6eeebed27ff558705a7))
- resolve client.imports relative to component file (script-manager) ([cc04d3a](https://codeberg.org/tjdavid/coralite/commit/cc04d3adc9c52227aaf96bd3fe9aaf6976c4428e))

### ♻️ Code Refactoring

- rename createPlugin to definePlugin (core) ([9e7cd1c](https://codeberg.org/tjdavid/coralite/commit/9e7cd1ccc611d51b4b76dd0153bcfce024be4e1c))

### 🧹 Chores

- refine JSDoc types in script.js to improve type safety and clarity ([664d203](https://codeberg.org/tjdavid/coralite/commit/664d2037f84ff7765b931d138c72db64ceba4c0e))


## v0.31.6

> Comparing `coralite-v0.31.5` to `HEAD`

**Summary:** 3 commits

### 🐛 Bug Fixes

- avoid premature disconnectedCallback via innerHTML clear in Light DOM slots (core) ([076c3d1](https://codeberg.org/tjdavid/coralite/commit/076c3d1c2882cbfe792b92732a78f2ed225845d2))
- prevent recursive p-limit deadlock (html) ([520d338](https://codeberg.org/tjdavid/coralite/commit/520d338284294f8fedbe23fc33eb182fd7e57359))

### ✅ Tests

- add lifecycle race condition suite (e2e) ([8ef6524](https://codeberg.org/tjdavid/coralite/commit/8ef652490b8bb79d71defbaf3bed84f7a64f2e88))


## v0.31.5

> Comparing `coralite-v0.31.4` to `HEAD`

**Summary:** 2 commits

### 🐛 Bug Fixes

- deeply clone default values and completely resolve esbuild shorthand serialization errors ([59c5655](https://codeberg.org/tjdavid/coralite/commit/59c5655a64f442f61661ddbaa991fc5c5068eab6))

### 📚 Documentation

- document hydration readiness hook for E2E testing stability ([b030c64](https://codeberg.org/tjdavid/coralite/commit/b030c64c4c155ef1a478a074b8b5d890d7ec3f9e))


## v0.31.4

> Comparing `coralite-v0.31.3` to `HEAD`

**Summary:** 7 commits

### 🐛 Bug Fixes

- use original name for validation and error messages (parse) ([6cf8841](https://codeberg.org/tjdavid/coralite/commit/6cf884134c7976e91b04e4cf6d4becd00acf91e7))
- resolve TypeError when accessing component.path in createComponentElement and extract utility functions ([31f19af](https://codeberg.org/tjdavid/coralite/commit/31f19afc480aa0ef7538e06c78be7dc02ae0a3d9))
- properly register generated scripts under the page path and resolve component slot bugs (coralite) ([ca0913b](https://codeberg.org/tjdavid/coralite/commit/ca0913b7eaa4dff183481af765a640cc5061210c))
- properly merge and populate dynamic imperative ref tokens (coralite) ([1524815](https://codeberg.org/tjdavid/coralite/commit/1524815cf980099d0b15f1a79766e0e540ea6ff9))
- use correct path from moduleComponent in script manager registration ([cc8b50f](https://codeberg.org/tjdavid/coralite/commit/cc8b50f20f35a4e8f518eb09e5c650c42c44a3a8))
- compute dynamic wrapper slots issue causing test timeout ([8272185](https://codeberg.org/tjdavid/coralite/commit/827218575db54dd47fd90ffd09d274e721c0c230))

### ♻️ Code Refactoring

- improve `registerComponent` logic and code structure ([728c434](https://codeberg.org/tjdavid/coralite/commit/728c4341c2397eecdd520c84268311c83b27da7b))


## v0.31.3

> Comparing `coralite-v0.31.2` to `HEAD`

**Summary:** 5 commits

### ✨ Features

- define CoraliteModuleTokenFunction (types) ([7f7243b](https://codeberg.org/tjdavid/coralite/commit/7f7243ba5a05c50da2c7696a73d9a9a60ceb3c5a))
- define CoraliteModuleSlotFunction (types) ([eced451](https://codeberg.org/tjdavid/coralite/commit/eced451678a7ab0bf89d0a879ccd12dad67fa3a9))
- implement client-side reactivity for computed slots in web components ([e8ffe19](https://codeberg.org/tjdavid/coralite/commit/e8ffe196b732f86d5d100a58dbaad982acf09289))

### 🐛 Bug Fixes

- allow imperative component tokens to remain reactive ([a0ca589](https://codeberg.org/tjdavid/coralite/commit/a0ca589f83e3914bf7a8c623e343d92638240e2d))
- correctly pass tokens to imperative components without client.script ([eca9494](https://codeberg.org/tjdavid/coralite/commit/eca94943ffaae42838b69fc8d745f23fc301e530))


## v0.31.2

> Comparing `coralite-v0.31.1` to `HEAD`

**Summary:** 2 commits

### 🐛 Bug Fixes

- prevent parent components from overriding nested child component refs ([8b8a545](https://codeberg.org/tjdavid/coralite/commit/8b8a5452695c117b42d579407b5f0f0590c31590))
- set correct web component ref attribute value ([6c35557](https://codeberg.org/tjdavid/coralite/commit/6c3555792e2398ab134e6847eb900cf6f0983096))


## v0.31.1

> Comparing `coralite-v0.31.0` to `HEAD`

**Summary:** 1 commit

### ✨ Features

- emulate native slot projection for light dom web components ([5b43e83](https://codeberg.org/tjdavid/coralite/commit/5b43e835adee0acb450b62d78e584aac7ecfbc2f))


## v0.31.0

> Comparing `coralite-v0.30.0` to `HEAD`

**Summary:** 3 commits

### 🐛 Bug Fixes

- apply scoped style wrapper to dynamic web components (client) ([3c6998d](https://codeberg.org/tjdavid/coralite/commit/3c6998d5f2545cfc893056d4f9ba91666e7c38fd))
- prevent double export default in script fallback ([1006ea3](https://codeberg.org/tjdavid/coralite/commit/1006ea36bfc666ca7332f97776cc5e22e0d8a741))
- scope CSS within web components inside Light DOM (coralite) ([d4f170a](https://codeberg.org/tjdavid/coralite/commit/d4f170a2012ab4c06941322b98496f9828a3b091))


## v0.30.0

> Comparing `coralite-v0.29.5` to `HEAD`

**Summary:** 13 commits

### 🐛 Bug Fixes

- improve error messages for invalid custom elements and parsing errors ([041421d](https://codeberg.org/tjdavid/coralite/commit/041421dd4a2c29c660e0c317e288034a0a59e1a2))
- update Coralite instance to use internal handleError ([cb80447](https://codeberg.org/tjdavid/coralite/commit/cb80447dc32fa959637063405292966f20947c47))
- prevent duplicate task deletion on build error handling ([aa9fa6e](https://codeberg.org/tjdavid/coralite/commit/aa9fa6edaa2b397ee2662963a40da90029455563))
- E2E test flakiness and globalAbortController for declarative components ([15b4e47](https://codeberg.org/tjdavid/coralite/commit/15b4e472ce5cdd4e7e86bb54befc6aacd3ccb066))
- properly lazy-load declarative component dependencies without eager bundling ([b57b7e9](https://codeberg.org/tjdavid/coralite/commit/b57b7e9c0d876991d9ba156b46b30174c6a47257))
- automatically instantiate declarative components inside imperative components shadow DOM ([e506c04](https://codeberg.org/tjdavid/coralite/commit/e506c04dfe61a21ed30e7376243fbdf48d6fe5fe))
- make web component values property private (coralite) ([41706e0](https://codeberg.org/tjdavid/coralite/commit/41706e0785e97ec55ad44d376e5efbbcb2341ecf))

### ⚡ Performance Improvements

- optimize HTML loading and framework initialization ([1ecb3c1](https://codeberg.org/tjdavid/coralite/commit/1ecb3c1e42f97a213349e2f9cae80c42ed0a7500))

### 📚 Documentation

- update documentation for coralite internal handleError method ([2a10ec1](https://codeberg.org/tjdavid/coralite/commit/2a10ec1dba4188f3c1e915842e6c7ca4df098975))

### ♻️ Code Refactoring

- unified structured error and warning handling ([d8b59ce](https://codeberg.org/tjdavid/coralite/commit/d8b59ce88fd196b02b0bee8e878edc43de6d4b21))
- Remove expensive global MutationObserver for component loading ([c611677](https://codeberg.org/tjdavid/coralite/commit/c61167723830c7dc7c6483e0e6229ee3b7ddce29))
- Replace expensive global MutationObserver with eager loading ([2dff272](https://codeberg.org/tjdavid/coralite/commit/2dff27254200ddf7c2c309a8cdd04abb16f2304a))

### 🧹 Chores

- remove trailing newline before return statement in coralite.js ([fc38a47](https://codeberg.org/tjdavid/coralite/commit/fc38a479cfcfe018dac0ea9d51f72468c02f8420))


## v0.29.5

> Comparing `coralite-v0.29.4` to `HEAD`

**Summary:** 1 commit

### 🐛 Bug Fixes

- provide AbortSignal | null to component context (coralite) ([cffbd8c](https://codeberg.org/tjdavid/coralite/commit/cffbd8c515f80c422544bdee146388062271ba37))


## v0.29.4

> Comparing `coralite-v0.29.3` to `HEAD`

**Summary:** 6 commits

### ✨ Features

- implement AbortSignal pattern for web component lifecycle ([9d823e5](https://codeberg.org/tjdavid/coralite/commit/9d823e5e709797ed706e1fac0401d51c17655824))

### 📚 Documentation

- update `AbortSignal` injection and helper currying updates. ([97c8053](https://codeberg.org/tjdavid/coralite/commit/97c8053705749c777bc346a453885512eb84dbec))

### ✅ Tests

- decouples test environment from standard CLI ([3b5c8c5](https://codeberg.org/tjdavid/coralite/commit/3b5c8c5300d3fe69c1e6ddc8d862cd1954bbf020))
- cover signal ([c3b6342](https://codeberg.org/tjdavid/coralite/commit/c3b63428d627c8309e96c013a2b744af54d8548b))

### 🧹 Chores

- remove unused path and module imports in script-manager.js ([9a00f57](https://codeberg.org/tjdavid/coralite/commit/9a00f573638c3bbd6935c4348b4225adcb3bc810))

### 🔨 Other Changes

- efactor: transition web component rendering from regex to AST with dom-serializer ([4b750bf](https://codeberg.org/tjdavid/coralite/commit/4b750bfb07a504ca44a295402c5a135b493bbfdd))


## v0.29.3

> Comparing `coralite-v0.29.2` to `HEAD`

**Summary:** 13 commits

### ✨ Features

- enforce deterministic asset hashing and deduplicate rendering pipeline (coralite) ([8248ae1](https://codeberg.org/tjdavid/coralite/commit/8248ae155bb24d5ff6da8e3e74233ef43010221b))

### 🐛 Bug Fixes

- enable native browser module resolution in esbuild (script-manager) ([92d729c](https://codeberg.org/tjdavid/coralite/commit/92d729c3e6a51f18a6783c2c3da593875254c65e))
- map CLI mode to Coralite environment mode (scripts) ([45cb00a](https://codeberg.org/tjdavid/coralite/commit/45cb00ababa5447de68c9c96bd92a545521816ba))
- migrate node polyfill plugin to active library (script-manager) ([870e876](https://codeberg.org/tjdavid/coralite/commit/870e8769bb7fa012db340ac4e1a8adb6ca5564e2))
- handle node built-in modules during local resolution (script-manager) ([60a0ba9](https://codeberg.org/tjdavid/coralite/commit/60a0ba915c3cbb2c139dbf6a5738b40fab5460e0))
- resolve static assets relative to project root (coralite) ([a522802](https://codeberg.org/tjdavid/coralite/commit/a522802eb6b557d46fc175906e29c6aea9fcf312))
- resolve missing asset chunks on nested pages with absolute base URL and explicit assets/js dir ([3fec2e0](https://codeberg.org/tjdavid/coralite/commit/3fec2e09151d12d5c5e9fe75f44484a08ac0c778))
- explicit module exports (coralite) ([46fd07e](https://codeberg.org/tjdavid/coralite/commit/46fd07efd166c1ba50f5b522056cfe5bbf828275))

### 📚 Documentation

- clarify refs plugin resolution ([509ad88](https://codeberg.org/tjdavid/coralite/commit/509ad88b60cc7e0d12c33d84c18e89fe97122d33))

### 🎨 Styles

- normalize whitespace in node-builtins test fixture ([01e9b62](https://codeberg.org/tjdavid/coralite/commit/01e9b621b16f9441f2620446b5e102a81d937bc2))

### 🧹 Chores

- update asset output paths to .coralite/assets/css and .coralite/assets/js ([2de3966](https://codeberg.org/tjdavid/coralite/commit/2de3966841ba81d421496926794d4deaa270c223))
- remove unused import in coralite.js ([c87772c](https://codeberg.org/tjdavid/coralite/commit/c87772ce25bbdbfbb3d17cfa49c6781548e6ac48))
- add @types/node dependency to coralite package.json ([7974174](https://codeberg.org/tjdavid/coralite/commit/7974174bc3f90d1c16f6e712ff30a4cfef060566))


## v0.29.2

> Comparing `coralite-v0.29.1` to `HEAD`

**Summary:** 3 commits

### ✨ Features

- allow plugin client helpers phase 1 to be async ([4d1c2d5](https://codeberg.org/tjdavid/coralite/commit/4d1c2d550450899f41dc8e6c36e6594285bde571))

### 🧹 Chores

- refactor script manager helpers to support async operations ([25d4883](https://codeberg.org/tjdavid/coralite/commit/25d48833ffaf26e04ac992c2e0393b40be640f1a))
- update llms.txt with critical directives and architectural clarifications ([4a6687b](https://codeberg.org/tjdavid/coralite/commit/4a6687b01e32f93f3da380c1c9431552fdef37ba))


## v0.29.1

> Comparing `coralite-v0.29.0` to `HEAD`

**Summary:** 2 commits

### 🐛 Bug Fixes

- update whitespace in reactive-token-parent test fixture to ensure consistent formatting ([566b68b](https://codeberg.org/tjdavid/coralite/commit/566b68bbc363e5ae44f8db9adb201f54dffdd2f0))
- implement reactive token replacement in imperative web components ([b7bf443](https://codeberg.org/tjdavid/coralite/commit/b7bf44394769b6393b1f62229ff2a5ff6b1e3651))


## v0.29.0

> Comparing `coralite-v0.28.5` to `HEAD`

**Summary:** 10 commits

### ✨ Features

- implement recursive imperative component dependency resolution and bundling ([51d55c4](https://codeberg.org/tjdavid/coralite/commit/51d55c4525dca517a1097b43d37f21b8353925f3))
- update plugin client helpers API to two-phase execution (script-manager) ([0aa9e90](https://codeberg.org/tjdavid/coralite/commit/0aa9e901648edcb507b056890c5aeeaf99eb1857))
- add E2E tests for imperative component hydration and shared state ([edbdaff](https://codeberg.org/tjdavid/coralite/commit/edbdaff019b77874a12ba9ea0809369f5fb70699))

### 🐛 Bug Fixes

- add missing newline in script-manager.js context assignment to ensure proper code formatting ([476db43](https://codeberg.org/tjdavid/coralite/commit/476db434de6e5545c6aaee749b95ac4513a131e7))

### 📚 Documentation

- update llms.txt with latest framework changes ([f767914](https://codeberg.org/tjdavid/coralite/commit/f7679143f4970b275ab90fe63307d35bf52f981f))

### ♻️ Code Refactoring

- preserve ref attribute uniqueness instead of relying on id ([4f01629](https://codeberg.org/tjdavid/coralite/commit/4f01629873fe60d5e9d7615e7f13bcab38d306e0))
- completely remove standalone components feature (coralite) ([142d9aa](https://codeberg.org/tjdavid/coralite/commit/142d9aae1be9527febd47b384a7768228c0cdc7f))
- rename Document types to Component globally ([7a5db39](https://codeberg.org/tjdavid/coralite/commit/7a5db399a8589e774dcb9b233595d583bb3b9440))

### ✅ Tests

- update ScriptManager test cases to use new object-based API signature ([ecb96e7](https://codeberg.org/tjdavid/coralite/commit/ecb96e771108397c06824671fb66dd4a71615d41))

### 🧹 Chores

- remove unused tests ([dd988a7](https://codeberg.org/tjdavid/coralite/commit/dd988a7773410436c9e3ece9f7c03119707747c2))


## v0.28.5

> Comparing `coralite-v0.28.4` to `HEAD`

**Summary:** 2 commits

### 📚 Documentation

- enhance Static Assets Plugin documentation with local path support and WASM details ([96d7726](https://codeberg.org/tjdavid/coralite/commit/96d7726977584b4491302e7876ce476e053706c8))

### 🔨 Other Changes

- revert(feat (build)): disable tree shaking in script manager compilation ([d5ec771](https://codeberg.org/tjdavid/coralite/commit/d5ec771bd1111d586596a4aaae217274bc31c3b6))


## v0.28.4

> Comparing `coralite-v0.28.3` to `HEAD`

**Summary:** 1 commit

### 🐛 Bug Fixes

- update staticAssetPlugin to support explicit src and fallback resolution ([55cb5be](https://codeberg.org/tjdavid/coralite/commit/55cb5be34420d16436d7cede264cd5a3170d1a41))


## v0.28.3

> Comparing `coralite-v0.28.2` to `HEAD`

**Summary:** 5 commits

### ✨ Features

- add --assets option to copy static files during build (build) ([bd166da](https://codeberg.org/tjdavid/coralite/commit/bd166da7b194074a4ad1f7d3bbec3c2e98407cbb))
- add static asset plugin support for copying package assets during build (core) ([cab4a3e](https://codeberg.org/tjdavid/coralite/commit/cab4a3e6bad6a53ab03ab7de4c005ee0ee7cd8ec))

### 📚 Documentation

- add JSDoc comments to static asset plugin function ([634c628](https://codeberg.org/tjdavid/coralite/commit/634c628861f5a0fd5b1d9f9d14b8a9977667f45b))

### ♻️ Code Refactoring

- asset parsing to support flexible package:path:dest format ([4623f1c](https://codeberg.org/tjdavid/coralite/commit/4623f1c80eba34c83df915f27ddc2bfb38e3986d))

### ✅ Tests

- add e2e coverage for staticAssetPlugin (coralite) ([5cf9b1b](https://codeberg.org/tjdavid/coralite/commit/5cf9b1bb14b803640df785e77b8be3d046e4a6b8))


## v0.28.2

> Comparing `coralite-v0.28.1` to `HEAD`

**Summary:** 10 commits

### ✨ Features

- implement staticAssetPlugin for handling binary dependencies ([ebc09d4](https://codeberg.org/tjdavid/coralite/commit/ebc09d4d20e3b92d1e199d9b99f7d0007b61aefb))

### 📚 Documentation

- clarify dynamic component data passing and ref compilation patterns ([ca461ef](https://codeberg.org/tjdavid/coralite/commit/ca461ef53fbc3f2a190ae3bbf02da16aec479ee6))
- document Refs Plugin DOM output and testing patterns ([af9e917](https://codeberg.org/tjdavid/coralite/commit/af9e9172f6326fd32f475b345dc104d2ba091d00))
- fix newline ([da73885](https://codeberg.org/tjdavid/coralite/commit/da7388598d23c843cf939eb05e6c5aac6c55567a))
- clarify cross-component import rules for llms.txt ([09d336f](https://codeberg.org/tjdavid/coralite/commit/09d336fb81ddee572578d2deff50703c735f7232))
- add comprehensive LLM documentation for Coralite framework architecture ([31d04aa](https://codeberg.org/tjdavid/coralite/commit/31d04aaa5b4de31bf0da7f1f8ec9f55828596b64))
- clarify client-side execution context in module definitions and types ([cdb228f](https://codeberg.org/tjdavid/coralite/commit/cdb228fbd323d9cf70410ecb4adf054845e65f5f))

### ♻️ Code Refactoring

- make coralite save method use internal options ([8eda84c](https://codeberg.org/tjdavid/coralite/commit/8eda84cc2063d94465a496dd61a8351b108eb95c))
- rename llm.md to llms.txt ([f73641f](https://codeberg.org/tjdavid/coralite/commit/f73641f0c7b4172b7ba625d4c2697c276352be85))

### 🧹 Chores

- document Static Assets Plugin for binary dependencies in llms.txt ([77abc7f](https://codeberg.org/tjdavid/coralite/commit/77abc7f75fa86530ba77d5bccc62c95198815313))


## v0.28.1

> Comparing `coralite-v0.28.0` to `HEAD`

**Summary:** 1 commit

### 🐛 Bug Fixes

- correctly resolve relative path for standalone component imports (script-manager) ([a7f4875](https://codeberg.org/tjdavid/coralite/commit/a7f4875b89e2b7c1b5badc59a6ca23ddd1ec87c7))


## v0.28.0

> Comparing `coralite-v0.27.0` to `HEAD`

**Summary:** 11 commits

### ✨ Features

- implement dynamic attribute binding and token replacement in generated web components ([4a4d22f](https://codeberg.org/tjdavid/coralite/commit/4a4d22f20bfff90698b97a1a742c5768774f4353))
- refactor standalone component tests to use dynamic HTML injection ([19a3523](https://codeberg.org/tjdavid/coralite/commit/19a35234667e960baf66b77ac3380ca2f1a30441))
- expand E2E coverage for standalone Web Components (tests) ([f53ec32](https://codeberg.org/tjdavid/coralite/commit/f53ec320074f485dc8ff45965f9de1340649516b))

### 🐛 Bug Fixes

- update test assertions to match esbuild's JSON key formatting in pluginImports output ([16f51fd](https://codeberg.org/tjdavid/coralite/commit/16f51fd5e15121f0556e355003f25ffd9bd87362))
- update component import specifier in standalone-wrapper fixture (tests) ([f80391a](https://codeberg.org/tjdavid/coralite/commit/f80391a4198ebaf78d5d3340eefad75c8087fc70))
- unconditionally build standalone components with .js extension ([236cead](https://codeberg.org/tjdavid/coralite/commit/236cead5ec79192ca305222f9138910b7806696f))

### 📚 Documentation

- clarify terminology in Coralite README from templates to components ([8b8f31b](https://codeberg.org/tjdavid/coralite/commit/8b8f31b3f3438a87fbd934baedbd30da02f57d5f))
- simplify CLI installation and update option names ([4474b84](https://codeberg.org/tjdavid/coralite/commit/4474b8438c808252f11d410464b21bde3eb02062))

### ♻️ Code Refactoring

- standardise JavaScript formatting and remove trailing whitespace ([d2f36e9](https://codeberg.org/tjdavid/coralite/commit/d2f36e97dac5f6fb0d6da87f0c76eaf165b34553))
- rename `relDir` to `relativeDir` for consistency in coralite.js ([51cb2e2](https://codeberg.org/tjdavid/coralite/commit/51cb2e2959b4a1cd70c650758e65654cfdc0decd))
- improve standalone component E2E tests and assertions ([0241ab9](https://codeberg.org/tjdavid/coralite/commit/0241ab9fd98fe64290855cc28376abca9129340c))


## v0.27.0

> Comparing `coralite-v0.26.0` to `HEAD`

**Summary:** 19 commits

### ✨ Features

- allow `skipRenderByAttribute` and `ignoreByAttribute` to accept string or object arrays ([a9686cd](https://codeberg.org/tjdavid/coralite/commit/a9686cdb877e685c6099e642744b68789b5ede12))
- fix standalone web components client-side import resolution ([df4e3fe](https://codeberg.org/tjdavid/coralite/commit/df4e3fe0505c45b31e6dc975dc39e2975e147cef))
- extract client.imports from AST for standalone component generation ([ccf64f1](https://codeberg.org/tjdavid/coralite/commit/ccf64f1cbcbe0c9dbbac57739fba733e26eabee5))
- bypass transformCSS and remove mock DOM ([022a762](https://codeberg.org/tjdavid/coralite/commit/022a762c9306535cc02a96210c1a5970e86b3a5e))
- add E2E tests for standalone web components and custom elements (tests) ([20ebcfd](https://codeberg.org/tjdavid/coralite/commit/20ebcfd097f9967fe467290bb6e9bf285a3f551c))
- add rudimentary text token replacement for user script payloads ([5d00e07](https://codeberg.org/tjdavid/coralite/commit/5d00e074e33601f0eaa5922938edfcbcd229f811))
- add optional callback transformation for standalone component generation ([443057f](https://codeberg.org/tjdavid/coralite/commit/443057ff70f198aae8a7ed9850b6c2fa1245e655))
- normalize standalone output parameter in constructor (coralite) ([0a40abf](https://codeberg.org/tjdavid/coralite/commit/0a40abf2f843944191d9943a3d6fc2114881757e))
- add --standalone option for client-side web component output directory ([fc761a3](https://codeberg.org/tjdavid/coralite/commit/fc761a3a9ee19dbbec76934a9a9708f6741c9236))
- extract and set $lang from html lang attribute in head (metadata) ([cdaefcd](https://codeberg.org/tjdavid/coralite/commit/cdaefcd291a2c7f9ea544af3b1b759dcb9a56baf))

### 🐛 Bug Fixes

- standalone components not firing e2e tests. ([b52bc5f](https://codeberg.org/tjdavid/coralite/commit/b52bc5f0efb4ef5eeb1a9fb75a0a4565efb07297))
- standalone Web Components so that CSS is unscoped correctly ([9c9c9c5](https://codeberg.org/tjdavid/coralite/commit/9c9c9c5d1738078f4bf6743721adbdc111cf982f))

### 🎨 Styles

- expands abbreviated variable names ([0e644c4](https://codeberg.org/tjdavid/coralite/commit/0e644c45ea437eb8f81df0785e793822512707d4))

### ♻️ Code Refactoring

- move fixture templates to components dir ([70103cc](https://codeberg.org/tjdavid/coralite/commit/70103cc98145aab641f695264fe204b0c43ebe67))
- the refs plugin to assign ref values directly to the `id` ([4271556](https://codeberg.org/tjdavid/coralite/commit/427155649cdab380aba61e37e35085f080ca4893))

### ✅ Tests

- test for current-language support (meta) ([830b337](https://codeberg.org/tjdavid/coralite/commit/830b337cd816d0edca0112574b96e1fb3ec83c9a))

### 🧹 Chores

- update coralite build-html script with standalone and skip-render flags ([a737532](https://codeberg.org/tjdavid/coralite/commit/a737532bb08493c3a3f97fe9c5a0d454e931b016))

### 💥 Breaking Changes

- rename "templates" to "components" across the public API ([8ea8764](https://codeberg.org/tjdavid/coralite/commit/8ea876488a8e5a88d7c8edee1dbc42d30d76ab7b))

### 🔨 Other Changes

- feat!(coralite): implement standalone client-side components with breaking API changes ([533ea3d](https://codeberg.org/tjdavid/coralite/commit/533ea3dae4f1d7a6cf1fa4a5b1dbdb76bfdc788e))


## v0.26.0

> Comparing `coralite-v0.25.0` to `HEAD`

**Summary:** 3 commits

### ✨ Features

- rename script plugin to client and move setup to frontend bundle (script-manager) ([6f96075](https://codeberg.org/tjdavid/coralite/commit/6f960750d836faadb5df3e2d0e4e2572063eea0c))

### ♻️ Code Refactoring

- migrate from script to client config (test-script-plugin) ([aef12a9](https://codeberg.org/tjdavid/coralite/commit/aef12a9097bf95b19d361c419d72a7c6ff9924cb))
- rename IgnoreByAttribute type to Attribute ([241d91a](https://codeberg.org/tjdavid/coralite/commit/241d91a45a9aa0c848f203b39a29be83cbf9c6e6))


## v0.25.0

> Comparing `coralite-v0.24.0` to `HEAD`

**Summary:** 5 commits

### ✨ Features

- add skipRenderByAttribute option to parse but exclude elements from render ([2a0a91c](https://codeberg.org/tjdavid/coralite/commit/2a0a91c7c3155bf467544c19c75975221b5b0eb3))
- add E2E tests for client and plugin imports with ESM bundler format ([475fbef](https://codeberg.org/tjdavid/coralite/commit/475fbef19015bdbda915edd966eade880f42394a))
- add onBeforePageRender and onBeforeBuild plugin hooks ([c18ddaf](https://codeberg.org/tjdavid/coralite/commit/c18ddafcb66a1ebb4cacc6e36111595c706e4770))

### 🐛 Bug Fixes

- change build format to ESM and exclude HTTP(S) from bundling (script-manager) ([764ba6b](https://codeberg.org/tjdavid/coralite/commit/764ba6ba2f15dba2ac751b1764f489a336ff0f4f))

### ♻️ Code Refactoring

- rename onBuildComplete hook to onAfterBuild ([0ad170f](https://codeberg.org/tjdavid/coralite/commit/0ad170f6f5f1b372222c7af6eea222180949b90a))


## v0.24.0

> Comparing `coralite-v0.23.0` to `HEAD`

**Summary:** 26 commits

### ✨ Features

- add plugin configuration support to script compilation (script-manager) ([f27be00](https://codeberg.org/tjdavid/coralite/commit/f27be000f61eb1ffc533025296f8ee7cc8cfd884))
- add validation for script.config property (plugin) ([eabe015](https://codeberg.org/tjdavid/coralite/commit/eabe0152c05234de864a23cb493e18446bfcddde))
- add namespaceExport support and improve import validation ([dc22603](https://codeberg.org/tjdavid/coralite/commit/dc22603847370652e8e0d659e63fbc5e80a5cfd7))
- add validation for script imports and improve script module handling (plugin) ([879ad33](https://codeberg.org/tjdavid/coralite/commit/879ad3368cf2a3fd317b5c2df820a292863b3e61))
- add benchmark suite for Coralite build modes ([c34a508](https://codeberg.org/tjdavid/coralite/commit/c34a508680ad5eb0b3071fbe80a2b8975685d412))
- add unit test for module resolution in development mode ([af7fbbb](https://codeberg.org/tjdavid/coralite/commit/af7fbbb969534aca29e64b0116d3aa302784b0f7))
- introduce development and production build modes ([02a1b7a](https://codeberg.org/tjdavid/coralite/commit/02a1b7a3f80f3139e69f7fd2bde60e483cafbe10))
- add sourcemap to defineComponent client side script ([394f8e0](https://codeberg.org/tjdavid/coralite/commit/394f8e0358df28fbb14f0a0c9f9f25825c77fa52))
- improve script compilation and add source mapping (script-manager) ([b5aa2de](https://codeberg.org/tjdavid/coralite/commit/b5aa2de0ae8355180e8983648f24735459dcd82b))
- add onBuildComplete hook for build lifecycle events ([f0012fe](https://codeberg.org/tjdavid/coralite/commit/f0012feeb9ae59699acad370ee1f85db5899b7b1))

### 🐛 Bug Fixes

- correct sourcemap test assertions to use proper source index ([5179dd6](https://codeberg.org/tjdavid/coralite/commit/5179dd6c70f1b09fab563dc3a117a10e7a521f6c))
- correct helper iteration and inject imports into context (script-manager) ([d8d1fae](https://codeberg.org/tjdavid/coralite/commit/d8d1faef89cfd147a88a36c9f70f8b74da37ccca))
- add mode option to Coralite initialization in sourcemap tests ([5b1c04f](https://codeberg.org/tjdavid/coralite/commit/5b1c04faacb31c92f5fe9a67e0ce889d1d75fac8))
- resolve dynamic import relative to template file ([1f50dbf](https://codeberg.org/tjdavid/coralite/commit/1f50dbf6b92e8f0fd8d6177fb4361ef4397d806a))
- export core plugins from main entry point ([bd53216](https://codeberg.org/tjdavid/coralite/commit/bd53216099f2f83787176f6e2c4553a037b7e574))
- preserve HTML entities in parsing and rendering ([5298814](https://codeberg.org/tjdavid/coralite/commit/52988142f32374a96249549da83ae02f61ecd95a))
- prevent prototype pollution in storage objects (collection) ([e05418d](https://codeberg.org/tjdavid/coralite/commit/e05418d92da16e7f56a2109f71cbd8dd5e153645))

### 📚 Documentation

- update README with plugin documentation details ([23894a2](https://codeberg.org/tjdavid/coralite/commit/23894a26d5dedf72e68fdd786631c07569417c66))
- refactor: consolidate JSDoc callback descriptions into single line ([1e54cf7](https://codeberg.org/tjdavid/coralite/commit/1e54cf700c170878425f8eb10ebcea1a8ef590fc))

### ♻️ Code Refactoring

- restructure defineComponent API for client/server separation ([7f079f2](https://codeberg.org/tjdavid/coralite/commit/7f079f25c56f2e917d135a915c5d169a815dfa27))
- update test assertions to reflect new scriptModules structure (script-manager) ([02fbf9c](https://codeberg.org/tjdavid/coralite/commit/02fbf9c37a459cf9f0ecaadc8dd867c2b6dd9f84))
- extract script parsing logic into utils ([b5301d8](https://codeberg.org/tjdavid/coralite/commit/b5301d807e974834449bafd187714eb46219715b))

### ✅ Tests

- add e2e test for script plugin configuration ([067ac6a](https://codeberg.org/tjdavid/coralite/commit/067ac6a7c09f04fa1ac35cace701f09e39e76ecd))
- add unit tests for config injection into helper context (script-manager) ([1039c05](https://codeberg.org/tjdavid/coralite/commit/1039c050ac02d90239c8e2ef79f45a31f16a601b))
- add unit tests for script extraction and sourcemap generation ([ddab7b3](https://codeberg.org/tjdavid/coralite/commit/ddab7b3b5ca10a7967e370d50631285d54e78bdc))
- add unit test for source map generation (sourcemap) ([40e0b57](https://codeberg.org/tjdavid/coralite/commit/40e0b570a909f20e6e15f43437892deac5d816a4))


## v0.23.0

> Comparing `coralite-v0.22.1` to `HEAD`

**Summary:** 7 commits

### ✨ Features

- add onAfterPageRender plugin hook ([56f7421](https://codeberg.org/tjdavid/coralite/commit/56f742185dd7ee4a94d7b7a1cdd3d2b620286655))
- normalize slot component attributes to camelCase ([5a3a203](https://codeberg.org/tjdavid/coralite/commit/5a3a203e557612de0cf1d157a8d7607caa732665))

### 🐛 Bug Fixes

- update homepage URL from .io to .dev ([a83c431](https://codeberg.org/tjdavid/coralite/commit/a83c431b3f34dd8c90e2600671a78a1fc05a3ac9))
- pass fully merged results to token functions and processor ([479efef](https://codeberg.org/tjdavid/coralite/commit/479efef995ef764197d898b2ea9dacffdb896519))
- update slot references when cloning nodes ([e7d27c8](https://codeberg.org/tjdavid/coralite/commit/e7d27c8c1a9fca0601fcbab8d5db4d9b62b33812))

### ♻️ Code Refactoring

- reorganize type definitions by domain ([27a76df](https://codeberg.org/tjdavid/coralite/commit/27a76dfab1912e411465849e439f300669da91b8))

### 🔨 Other Changes

- types: add type definitions for Coralite plugin system ([1ff954a](https://codeberg.org/tjdavid/coralite/commit/1ff954a0ca080dd97d900049d30c6ec6cc751bf2))


## v0.22.1

> Comparing `coralite-v0.21.0` to `HEAD`

**Summary:** 22 commits

### ✨ Features

- expose page title to available values (plugins) ([0a71ce4](https://codeberg.org/tjdavid/coralite/commit/0a71ce4cdc44a7b0d4d0230700378e7c862bb663))
- add renderContext parameter to evaluation context ([216d342](https://codeberg.org/tjdavid/coralite/commit/216d3427a4a8f3b9cab3f4dae23b0c81caffc4e0))
- implement scoped style support for components ([0589108](https://codeberg.org/tjdavid/coralite/commit/0589108027a02f28e00e053bb908607bd258e282))
- add options parameter to transform method for serialization control ([11fab18](https://codeberg.org/tjdavid/coralite/commit/11fab182866458cdbbf118192b2848a13e253695))
- expose transform method to context source for plugin rendering ([bb6d4eb](https://codeberg.org/tjdavid/coralite/commit/bb6d4eb7302dae790a773490903829a6748976d9))
- add cloneDocumentInstance utility for safe document mutation ([b414461](https://codeberg.org/tjdavid/coralite/commit/b414461586f06d06bfde3144bb39999e1aa75afe))
- add concurrent rendering support with build-scoped render queues ([2658f96](https://codeberg.org/tjdavid/coralite/commit/2658f9607b3f757c12ce278668b74b255f68bfb3))
- add publishConfig to package.json files for public access and provenance ([a634901](https://codeberg.org/tjdavid/coralite/commit/a634901d5c79c6230b3e13c8c21c0fec3c54e1d2))
- switch test browser from Firefox to Chromium (playwright) ([093ba6b](https://codeberg.org/tjdavid/coralite/commit/093ba6b7b7e22d032d9a435aa92b71354a82b7e4))
- add server extension hook to plugin configuration (plugin) ([78ada4a](https://codeberg.org/tjdavid/coralite/commit/78ada4a0c4562575eb5ed5996d8e7ee996cecf38))

### 🐛 Bug Fixes

- add missing contextId to custom element rendering for token values ([c68ff17](https://codeberg.org/tjdavid/coralite/commit/c68ff17781100f3986106ec7b994b19c57f56252))
- pass index to createComponent in processTokenValue (define-component) ([e36b81a](https://codeberg.org/tjdavid/coralite/commit/e36b81ac6cc39fc84d04d1df80421a3a67249684))
- remove unnecessary context binding in plugin evaluation ([4a39fc4](https://codeberg.org/tjdavid/coralite/commit/4a39fc4baa4110005ee2da93468ee2363c72648e))
- expose pages collection to plugins during initialization ([a396920](https://codeberg.org/tjdavid/coralite/commit/a396920dc3b572516ed5e0c7bf63b2cfe5d0b19b))

### ♻️ Code Refactoring

- revise defineComponent tests to improve coverage and clarity ([135a2b1](https://codeberg.org/tjdavid/coralite/commit/135a2b1fa7071867e75b07ab0950f3ea9329142f))
- unify component style system and add automatic CSS transformation ([760cf8e](https://codeberg.org/tjdavid/coralite/commit/760cf8e1883f9d67210aee3e40eb80a1e599d9dc))
- rename locals parameter to values in _generatePages ([347037e](https://codeberg.org/tjdavid/coralite/commit/347037ee65871e13b7ed9695270afd78d706709e))
- optimize context handling and plugin binding ([051b201](https://codeberg.org/tjdavid/coralite/commit/051b201557216c666ef4708560c2a3356ed50710))

### ✅ Tests

- remove e2e tests for styles since unit covers it ([b54cdb8](https://codeberg.org/tjdavid/coralite/commit/b54cdb8575252888a62036555406f6796c3e5145))

### 🧹 Chores

- remove publishConfig from package.json files ([180e5f5](https://codeberg.org/tjdavid/coralite/commit/180e5f524e976547fec51f0128f7688c96d5df4d))
- remove old changelog and update plugin configuration ([c051b72](https://codeberg.org/tjdavid/coralite/commit/c051b720adb08a2d4ff5e0fd466443ea94b0cf3f))

### 🔨 Other Changes

- release(coralite): version 0.22.0 ([84a8ffa](https://codeberg.org/tjdavid/coralite/commit/84a8ffa147fbc61cf44c9e36db8aa11cef6c4690))


## v0.22.0

> Comparing `coralite-v0.20.1` to `HEAD`

**Summary:** 28 commits

### ✨ Features

- expose page title to available values (plugins) ([0a71ce4](https://codeberg.org/tjdavid/coralite/commit/0a71ce4cdc44a7b0d4d0230700378e7c862bb663))
- add renderContext parameter to evaluation context ([216d342](https://codeberg.org/tjdavid/coralite/commit/216d3427a4a8f3b9cab3f4dae23b0c81caffc4e0))
- implement scoped style support for components ([0589108](https://codeberg.org/tjdavid/coralite/commit/0589108027a02f28e00e053bb908607bd258e282))
- add options parameter to transform method for serialization control ([11fab18](https://codeberg.org/tjdavid/coralite/commit/11fab182866458cdbbf118192b2848a13e253695))
- expose transform method to context source for plugin rendering ([bb6d4eb](https://codeberg.org/tjdavid/coralite/commit/bb6d4eb7302dae790a773490903829a6748976d9))
- add cloneDocumentInstance utility for safe document mutation ([b414461](https://codeberg.org/tjdavid/coralite/commit/b414461586f06d06bfde3144bb39999e1aa75afe))
- add concurrent rendering support with build-scoped render queues ([2658f96](https://codeberg.org/tjdavid/coralite/commit/2658f9607b3f757c12ce278668b74b255f68bfb3))
- add publishConfig to package.json files for public access and provenance ([a634901](https://codeberg.org/tjdavid/coralite/commit/a634901d5c79c6230b3e13c8c21c0fec3c54e1d2))
- switch test browser from Firefox to Chromium (playwright) ([093ba6b](https://codeberg.org/tjdavid/coralite/commit/093ba6b7b7e22d032d9a435aa92b71354a82b7e4))
- add server extension hook to plugin configuration (plugin) ([78ada4a](https://codeberg.org/tjdavid/coralite/commit/78ada4a0c4562575eb5ed5996d8e7ee996cecf38))
- add DOM creation benchmark showing 22x speedup (benchmarks) ([29bb1c5](https://codeberg.org/tjdavid/coralite/commit/29bb1c58203f9a97e5d8327c53b65f9bc7922fff))
- add async performance test (benchmarks) ([4f25b63](https://codeberg.org/tjdavid/coralite/commit/4f25b634a114f94a107ef72ec6ed46db5f76cc9c))

### 🐛 Bug Fixes

- remove unnecessary context binding in plugin evaluation ([4a39fc4](https://codeberg.org/tjdavid/coralite/commit/4a39fc4baa4110005ee2da93468ee2363c72648e))
- expose pages collection to plugins during initialization ([a396920](https://codeberg.org/tjdavid/coralite/commit/a396920dc3b572516ed5e0c7bf63b2cfe5d0b19b))
- use Object.entries instead of Object.values in cleanKeys ([6290c33](https://codeberg.org/tjdavid/coralite/commit/6290c33ab85889ddc0343f472b0ee48c9682ca39))
- rename local constructors to avoid shadowing imported types ([62fc468](https://codeberg.org/tjdavid/coralite/commit/62fc4683aee896654450590ccf272cb40768d879))
- return build results unconditionally ([7c3df81](https://codeberg.org/tjdavid/coralite/commit/7c3df81b043252ffd0e637e3701cb2b4cbcabca0))

### ⚡ Performance Improvements

- optimize findAttributesToIgnore with Map lookup ([22c1fcf](https://codeberg.org/tjdavid/coralite/commit/22c1fcf897206c4abc8ef2b839fcdc5783b76b82))
- replace Object.defineProperties per node with shared prototypes (dom) ([cf243d7](https://codeberg.org/tjdavid/coralite/commit/cf243d75498f77fcf0b6decb582ead0535474ac1))
- optimize compileAllInstances string building (script-manager) ([6286295](https://codeberg.org/tjdavid/coralite/commit/6286295d010c63080752ebaf71936790d2cf720c))

### ♻️ Code Refactoring

- unify component style system and add automatic CSS transformation ([760cf8e](https://codeberg.org/tjdavid/coralite/commit/760cf8e1883f9d67210aee3e40eb80a1e599d9dc))
- rename locals parameter to values in _generatePages ([347037e](https://codeberg.org/tjdavid/coralite/commit/347037ee65871e13b7ed9695270afd78d706709e))
- optimize context handling and plugin binding ([051b201](https://codeberg.org/tjdavid/coralite/commit/051b201557216c666ef4708560c2a3356ed50710))
- update JSDoc types to use Record type ([7c36e07](https://codeberg.org/tjdavid/coralite/commit/7c36e0731b426984f4a510e1a87a95edf33cf7ec))
- optimize cleanKeys function for single-pass efficiency ([032208f](https://codeberg.org/tjdavid/coralite/commit/032208f11b4cf6077b18b2cacb8ccd600b7a67b2))
- hoist kebab-to-camel regex to module scope ([69ed091](https://codeberg.org/tjdavid/coralite/commit/69ed091c635aefb61a406e01ee3b351e960c2a56))

### ✅ Tests

- remove e2e tests for styles since unit covers it ([b54cdb8](https://codeberg.org/tjdavid/coralite/commit/b54cdb8575252888a62036555406f6796c3e5145))

### 🔨 Other Changes

- release(coralite): version 0.21.0 ([949d15f](https://codeberg.org/tjdavid/coralite/commit/949d15fed04e01c06dd89d37aa8953f63c5e899d))

