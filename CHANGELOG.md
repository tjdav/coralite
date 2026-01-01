# Changelog

## v0.19.0

> Comparing `v0.18.7` to `v0.19.0`

**Summary:** 157 commits, 24 pull requests

### ✨ Features

- add coralite counter and footer templates, update script signature ([8fba633](https://codeberg.org/tjdavid/coralite/commit/8fba63387c2bcccac32b0171115e76b4ccfdd6ab))
- add coralite-table template component (website) ([16418e5](https://codeberg.org/tjdavid/coralite/commit/16418e58830d9c17cd16eb23a04a8e58d77a19c8))
- add padding to server compilation log messages (scripts) ([61d6f42](https://codeberg.org/tjdavid/coralite/commit/61d6f42704ebbfc4356c7fad0572093f9ba44133))
- downgrade invalid custom element tag error to warning ([3789043](https://codeberg.org/tjdavid/coralite/commit/3789043b08830af0f47c0de2994cb4f2e72f574a))
- add syntax highlighting for script tags in HTML code ([604efb2](https://codeberg.org/tjdavid/coralite/commit/604efb27af099df12b5a340d57a9b13df7f54b28))
- Implement clipboard copy functionality via script ([ccb9080](https://codeberg.org/tjdavid/coralite/commit/ccb90809008ae70d0e61e9d381f74047d8a2331f))
- add defineComponent plugin documentation page (docs) ([f486b23](https://codeberg.org/tjdavid/coralite/commit/f486b23e8b1c86022a1cac6b0d6f5b27e372a2f8))
- add comprehensive plugin system documentation (docs) ([8862009](https://codeberg.org/tjdavid/coralite/commit/88620094d9f0bb9ca9fb86042c1ac361948d52ea))
- Update coralite-plugin.html with new meta tag structure (website) ([f4dc89d](https://codeberg.org/tjdavid/coralite/commit/f4dc89d671caa622849f668f26eba777cb896555))
- update coralite docs page metadata (website) ([32b00fb](https://codeberg.org/tjdavid/coralite/commit/32b00fb624bf145f422f6d72b16d19f7139bf6bf))
- Add fixture pages and templates for counter component (tests) ([46d376a](https://codeberg.org/tjdavid/coralite/commit/46d376aedc435cf80e100bb752130935eb7a5293))
- update script function signatures to include context parameter ([83957cd](https://codeberg.org/tjdavid/coralite/commit/83957cdb0223019f3d29cdba10b1f15b9261e571))
- add @this annotation to CoralitePluginModule callback (types) ([dd9d445](https://codeberg.org/tjdavid/coralite/commit/dd9d4455f316bbe59c619fc2ad3c363513c551c5))
- update CoralitePathValues JSDoc description (types) ([d9631ee](https://codeberg.org/tjdavid/coralite/commit/d9631ee6d91965d2febbc568e10ab308c9f7fc93))
- Update defineComponent tests to use __script__ property ([e75e41b](https://codeberg.org/tjdavid/coralite/commit/e75e41ba0b5c1b6f7570b1b8718eb205924f3fcd))
- add script content support to module values (types) ([a836025](https://codeberg.org/tjdavid/coralite/commit/a836025bd57189aff2d059c594ade1c94b1ab7d2))
- convert refs utility to plugin system (refs) ([5a1d62e](https://codeberg.org/tjdavid/coralite/commit/5a1d62ebe60e3e493ef51cd13165e855b9a78c49))
- add esbuild target and external config (build) ([20c416b](https://codeberg.org/tjdavid/coralite/commit/20c416becf29349ab9ce020790773b7f5f691c8d))
- add InstanceContext to coralite.js imports ([7a16cfd](https://codeberg.org/tjdavid/coralite/commit/7a16cfd5a9a21ec5702048327dfcc2ed92963962))
- introduce ScriptManager and refactor script handling ([6536d02](https://codeberg.org/tjdavid/coralite/commit/6536d024a6a73071133b212c710bc88086a05e4f))
- Add validation and improve plugin creation (plugin) ([4c2743b](https://codeberg.org/tjdavid/coralite/commit/4c2743be8c61c401fe02f242707d8e60e795a650))
- export script-manager module ([82bea33](https://codeberg.org/tjdavid/coralite/commit/82bea334f1f4c4edefddce1924b20f5ac8811c62))
- extend plugin and script type definitions (types) ([c28886b](https://codeberg.org/tjdavid/coralite/commit/c28886b44ef8261019bce6fd1f102193a8c8f3e7))
- add ScriptManager for template function orchestration ([e8ce058](https://codeberg.org/tjdavid/coralite/commit/e8ce058791a4c9b15ad8b020bbceeae5674a67ce))
- add normalizeFunction utility to standardize function string ([ec65ee0](https://codeberg.org/tjdavid/coralite/commit/ec65ee0f14b243db5b6577307f29df9f267c5867))
- improve file exclusion and hidden file handling (html) ([b989a4d](https://codeberg.org/tjdavid/coralite/commit/b989a4d8c0cf19ceb7be277484bc99c10e2a1ea4))
- add user feedback and error handling to server initialization ([63634e2](https://codeberg.org/tjdavid/coralite/commit/63634e2fddca4228e42c1e80e17efa80997f3c77))
- add prettified console output functions for errors, warnings, and info ([095226b](https://codeberg.org/tjdavid/coralite/commit/095226b7665309dfb9c764fffd1764d5e9d41b20))
- trigger browser reload on page changes ([f2821c9](https://codeberg.org/tjdavid/coralite/commit/f2821c93e4b5ae384b0687c9c4ae8b33c3a03de8))
- add validation for HTMLData object in setItem (collection) ([da8b7d7](https://codeberg.org/tjdavid/coralite/commit/da8b7d75b755d5ead84e79649f0c7962ab4dc44e))
- add validation to defineConfig function (config) ([f1d91c2](https://codeberg.org/tjdavid/coralite/commit/f1d91c225d174a1fae2a10c9b871e5770c804465))
- add debouncing to file watcher compilation ([c435961](https://codeberg.org/tjdavid/coralite/commit/c43596136c22fc04f60d3628123ac3385153b2fd))
- add ignoreInitial to file watcher (scripts) ([6707996](https://codeberg.org/tjdavid/coralite/commit/67079969b51aeca028df3c42518a8980401ace94))
- add Forgejo workflow for unit tests (ci) ([ae6e019](https://codeberg.org/tjdavid/coralite/commit/ae6e019152fc4a8b46bae2cf1e3f7d0ef99675d4))
- add type guards and validation utilities ([1a46668](https://codeberg.org/tjdavid/coralite/commit/1a4666869784707ca6d1199eb787e7e7dfc8bb38))
- add isRemovableNode helper function ([8170e7b](https://codeberg.org/tjdavid/coralite/commit/8170e7b3fcf3c31c930dde2cb6df95def0f9aac4))
- add isParentNode utility function (type-helper) ([00b325d](https://codeberg.org/tjdavid/coralite/commit/00b325d06bab4f65f81575a235804208df11c678))
- add isValidChildNode validation function (type-helper) ([3e24f66](https://codeberg.org/tjdavid/coralite/commit/3e24f668a66af8deebd8a1f40f3ebfe89784f164))
- Add hasValidTextNodeStructure helper function ([bac9476](https://codeberg.org/tjdavid/coralite/commit/bac94765d9d8f6967509779113d4e752b0c2167a))
- Add validation for CoraliteElement structure ([f286af1](https://codeberg.org/tjdavid/coralite/commit/f286af1ebca2a59f4330f3110cef7b068e5f4a6a))
- Add isCoraliteNode type guard for unified node checking ([105b3be](https://codeberg.org/tjdavid/coralite/commit/105b3be030d6e1b3ab1875012babef8a66be4847))
- add type guard for CoraliteCollectionItem ([3fa0786](https://codeberg.org/tjdavid/coralite/commit/3fa0786484372e0a575ba2190fcd2c9c8dbc5a79))
- add type guard for CoraliteDocumentRoot. ([107ba1e](https://codeberg.org/tjdavid/coralite/commit/107ba1ed753cc505381ebddb7957d29fc8e490a1))
- Add isCoraliteDirective type guard function ([5b367b8](https://codeberg.org/tjdavid/coralite/commit/5b367b835e1a47420fe29625ead17ddda446a1b7))
- Add JSDoc for isObject helper function ([898b40c](https://codeberg.org/tjdavid/coralite/commit/898b40c526d8fcfa8631ca202f0fccf35ab1fa65))
- Add JSDoc import for Coralite types in type-helper.js ([fc951a1](https://codeberg.org/tjdavid/coralite/commit/fc951a10c26f28f720896e9478a2fbd7303ad6c5))
- remove component ID from unexpected slot value error message ([d479bbc](https://codeberg.org/tjdavid/coralite/commit/d479bbcb2eabf955f5011cd743dbbdbcbfcfb10b))
- add unit test scripts with coverage and watch modes ([8444cf3](https://codeberg.org/tjdavid/coralite/commit/8444cf3533a55687bdc08dcc5bc12e9dfe907982))
- allow coralite-version custom tag in code highlight (website) ([96b0831](https://codeberg.org/tjdavid/coralite/commit/96b08313f4fa1c862f538af07df7db3f049315e8))
- add tag node support in code highlight parsing (ui) ([72cd4ca](https://codeberg.org/tjdavid/coralite/commit/72cd4caba858494877476b7330c3aec91757d9f5))

### 🐛 Bug Fixes

- prevent errors when deleting pages with missing custom elements ([b858712](https://codeberg.org/tjdavid/coralite/commit/b858712083a624928fd337ec44bbb3fafd022e42))
- InstanceContext type definitions. (types) ([a0619d7](https://codeberg.org/tjdavid/coralite/commit/a0619d7b8799e9e307a62e55549604b830e63523))
- use correct variable in template id validation error ([51d6b79](https://codeberg.org/tjdavid/coralite/commit/51d6b7907b7d324ed39cee2f00059bd617d4deae))
- remove empty text slot filtering in define-component ([3d895a1](https://codeberg.org/tjdavid/coralite/commit/3d895a11a125d9b54c4dc140e52f8e7e9aea9e77))
- update navbar links to use index.html paths ([cdbe7c0](https://codeberg.org/tjdavid/coralite/commit/cdbe7c0440e373994b139f7b8a9a6c1a92166bd3))
- use correct highlightCode variable for parsing ([9cb78c7](https://codeberg.org/tjdavid/coralite/commit/9cb78c7310c6554a6dc65fcebd6858243db85cf1))
- update coralite documentation with structure and new sections (docs) ([fba566f](https://codeberg.org/tjdavid/coralite/commit/fba566ffaa70028455cd85e917b53cfd6059dad0))
- Reformat installation guide for readability (docs) ([34a4ced](https://codeberg.org/tjdavid/coralite/commit/34a4ced254431db5b81e6956ec298241bccbd0bc))
- use raw values instead of stringified templateId in instance context ([d34f3ac](https://codeberg.org/tjdavid/coralite/commit/d34f3acb67b2f4c2ae52282f9d7bd5223c1af8ca))
- return empty string instead of undefined for empty HTML tokens ([77ddcbd](https://codeberg.org/tjdavid/coralite/commit/77ddcbdf02dbbe5267d29752e6ef739cfaa05022))
- handle async token functions and falsy values ([474e77b](https://codeberg.org/tjdavid/coralite/commit/474e77bef5cb33d92745bd3ffd3705d2bd27b0bb))
- remove async from replaceCustomElementWithTemplate ([1259a03](https://codeberg.org/tjdavid/coralite/commit/1259a03c1eb73b9f24889903f0d8fd0b7cea3c51))
- ensure all tokens are html parsed ([5f9fca4](https://codeberg.org/tjdavid/coralite/commit/5f9fca410655a8fc0bfa59dca265be09a39768b6))
- update JSDoc return type to use CoraliteModuleValues ([15b9565](https://codeberg.org/tjdavid/coralite/commit/15b95650de1fce9c787dbf59ce2ec5f9e8fbc4eb))
- check for null/undefined in script namespace default ([88f0460](https://codeberg.org/tjdavid/coralite/commit/88f046023283b5f70053c1a4b075e62a76d938f6))
- refactor script handling to use structured object ([8493439](https://codeberg.org/tjdavid/coralite/commit/849343985469e9d95c1d088246f87aabfa5f140c))
- remove unused node:fs/promises import ([58e7d1a](https://codeberg.org/tjdavid/coralite/commit/58e7d1a1cae664cbf62cf04ee7fd05666d647015))
- calculate per-file duration for CSS and SASS builds ([6ee2984](https://codeberg.org/tjdavid/coralite/commit/6ee2984541050c4d941634a47d712fc3717f93d4))
- move performance tracking to per-document compilation ([d328b44](https://codeberg.org/tjdavid/coralite/commit/d328b44a07f4c7519e2ec50797576c6259d90959))
- improve deleteItem robustness and handle edge cases ([5e78970](https://codeberg.org/tjdavid/coralite/commit/5e7897089d219b9672e672239731831e28c75833))
- prevent duplicate entries in collection lists ([2d0f11c](https://codeberg.org/tjdavid/coralite/commit/2d0f11c692fed844eaa57eddae7f4a6f19ec9ae3))
- update type helper import and usage for collection items ([9cb04ba](https://codeberg.org/tjdavid/coralite/commit/9cb04baea0e42ae9c3bba9a62a725c605e5a74ba))
- add validation for CoraliteComment structure (type-helper) ([b6590a7](https://codeberg.org/tjdavid/coralite/commit/b6590a78de57071b3b83f485ae8716dfbc394677))
- add isCoraliteSlotElement type guard (type-helper) ([435df55](https://codeberg.org/tjdavid/coralite/commit/435df550e790bf3d7efda15a78a34e27f32e35a6))
- update JSDoc for type predicate (type-helper) ([385baaf](https://codeberg.org/tjdavid/coralite/commit/385baaf062f3691b90ac0a7cae2ab7d7b912d097))
- remove default empty string from token function result ([39cebf1](https://codeberg.org/tjdavid/coralite/commit/39cebf1eaa0a3f2e16923cfb53bc5307dcd10ce7))
- parse token if it is a string (plugin) ([06c7aeb](https://codeberg.org/tjdavid/coralite/commit/06c7aeb0ad990d83794066f8701ca954be724b61))
- replace typeof result.then check with Promise instance (plugin) ([5a38a2c](https://codeberg.org/tjdavid/coralite/commit/5a38a2c542d3b93c2e8c07a1e2958deef88e65ec))
- correct tokens validation check (plugin) ([b2d920c](https://codeberg.org/tjdavid/coralite/commit/b2d920ce752f8608f3e0e561c215143cd5195d8e))
- replace popover with ref-based implementation (website) ([21be5af](https://codeberg.org/tjdavid/coralite/commit/21be5afbef921595bc2ebfdd84c8e5caf8dc4d11))
- clear parent script content from child elements ([ff5630f](https://codeberg.org/tjdavid/coralite/commit/ff5630f0d6251d8d1ecadd25f1a5e7c422b884cf))
- purge unused client script variables ([54a8efc](https://codeberg.org/tjdavid/coralite/commit/54a8efc629cc42f6ec4b410cf854c04ed6a14b24))
- SourceTextModule identifier resolve absolute path ([7053eb0](https://codeberg.org/tjdavid/coralite/commit/7053eb0426cac047757cb928e32c053408a11b26))

### 📚 Documentation

- add Coralite plugin system to reference page ([96248ad](https://codeberg.org/tjdavid/coralite/commit/96248ad14c1e2dea4b9cc95ec92e544c1bfc5ad1))
- add coralite.config.js support documentation ([79b1b4b](https://codeberg.org/tjdavid/coralite/commit/79b1b4b0c4e49fff9185e81934abaff321913ce7))
- enhance JSDoc descriptions for plugin callbacks (types) ([7ca8471](https://codeberg.org/tjdavid/coralite/commit/7ca847143dd2ee08156345fb6497cf571498d47f))
- improve JSDoc comments for type definitions (types) ([927a494](https://codeberg.org/tjdavid/coralite/commit/927a4941664f2d573b46d116647bd87da9cc361a))
- coralite website link update ([14e171e](https://codeberg.org/tjdavid/coralite/commit/14e171e6ca404e3300741912db2f495b8bd24a4b))
- coralite website link ([6ea0553](https://codeberg.org/tjdavid/coralite/commit/6ea05531323e92894d4d97030e90154c94f00f3c))
- update coralite version placeholder in installation guide (website) ([6a52eaa](https://codeberg.org/tjdavid/coralite/commit/6a52eaa7c6b27571d779c0c84169bed7631472c1))
- add version display template (website) ([f300a6a](https://codeberg.org/tjdavid/coralite/commit/f300a6ac60ab37fc8b1b3d651499b2ae890d75c6))
- add Coralite v0.18.7 release notes with key improvements, bug fixes, and upgrade instructions (website) ([ee0e005](https://codeberg.org/tjdavid/coralite/commit/ee0e00555e828c6707298612c7f39ef63c40a69b))
- add release notes for Coralite v0.18.6 with new UI features, accessibility improvements, and inline CSS support (website) ([7d33ba8](https://codeberg.org/tjdavid/coralite/commit/7d33ba879a534cc5894d03bca569dba8d44464cc))
- add Coralite v0.18.5 release notes page with CSS build fix details (website) ([9d3683d](https://codeberg.org/tjdavid/coralite/commit/9d3683d8a137eba545b9b2bbb394c96ac931e8ba))
- add Coralite v0.18.4 release notes with new utilities, UI improvements, and dependency updates (website) ([c8aad60](https://codeberg.org/tjdavid/coralite/commit/c8aad60c670b62dfb5d963b3a154c4780f25091b))
- add Coralite v0.18.3 release notes with configurable step, type safety improvements, and bug fixes (website) ([0d4bfcf](https://codeberg.org/tjdavid/coralite/commit/0d4bfcf16a3d785157cf13d41bc161424d896174))
- add Coralite v0.18.2 release notes with CLI testing, build scripts, and type import fixes (website) ([b31ada8](https://codeberg.org/tjdavid/coralite/commit/b31ada85e00ef5e6bfadc511e46f205582015fc0))
- add Coralite v0.18.1 release notes with config and CLI path fixes (website) ([b575c3d](https://codeberg.org/tjdavid/coralite/commit/b575c3d519563962e4239f1389f796ad21d8facf))
- add Coralite v0.18.0 release notes with module structure, type safety, and bug fixes updates (website) ([681212a](https://codeberg.org/tjdavid/coralite/commit/681212a42cc29182b56c9a9a6e5958820edf5a4a))
- add Coralite v0.17.0 release notes with key improvements, new features, bug fixes, and upgrade instructions (website) ([c72c813](https://codeberg.org/tjdavid/coralite/commit/c72c8135b5e15e4fd331e8a0d7a925022ccb9eb2))
- add Coralite v0.16.0 release notes with key improvements, bug fixes, and upgrade guide (website) ([3c0a2fe](https://codeberg.org/tjdavid/coralite/commit/3c0a2fec697146290a8f388e52231ec5e23c69ce))
- update release notes for v0.15.0 with CLI, SASS/SCSS support, and collection improvements (website) ([d977553](https://codeberg.org/tjdavid/coralite/commit/d977553dde721053a988e6b8816de955cd24ee76))
- add Coralite v0.14.2 release notes with bug fixes and upgrade instructions (website) ([0a24282](https://codeberg.org/tjdavid/coralite/commit/0a24282dad1ac167549b0c9e9846b5df73167ff7))
- add Coralite v0.14.0 release notes (website) ([1a8f0d0](https://codeberg.org/tjdavid/coralite/commit/1a8f0d097a9496d8b6a345d6834116d2add0d3b3))
- update blog post title and description for v0.13.0 release notes (website) ([b84743c](https://codeberg.org/tjdavid/coralite/commit/b84743cbb82bfd5c239822d2b05c869f6b5d5be9))

### 🎨 Styles

- fix code style and remove trailing whitespace ([e767fbb](https://codeberg.org/tjdavid/coralite/commit/e767fbbb61c6c550338265f22eb798114e8b9d0f))
- increase post spacing (website) ([a56bd2f](https://codeberg.org/tjdavid/coralite/commit/a56bd2fa9c68b75421697c949fffacbc237adad8))
- add top and bottom padding to content container (website) ([7e00441](https://codeberg.org/tjdavid/coralite/commit/7e00441b6135b9b8307e04cac17b9c85c322dbe6))
- whitespace in catch block ([accc6ba](https://codeberg.org/tjdavid/coralite/commit/accc6ba27f84ecb8b34eaa8c33aca061426858d5))

### ♻️ Code Refactoring

- restructure filesystem order for documentation (docs) ([2c534df](https://codeberg.org/tjdavid/coralite/commit/2c534df438b73e3964ac5714a860f39252d8c2d1))
- replace HTML heading tags with coralite-heading components ([e120260](https://codeberg.org/tjdavid/coralite/commit/e120260ccc0b1059d8eb98a6ac4ea3ca4e6a0f16))
- move replaceCustomElementWithTemplate function to top of file ([8c74e8f](https://codeberg.org/tjdavid/coralite/commit/8c74e8f17c56e96d3a91529b14380d53b72f3130))
- improve updateItem logic and error handling ([310e790](https://codeberg.org/tjdavid/coralite/commit/310e790ffb953cb90c4d78c434a6a5783f989333))
- Expand defineComponent unit tests with comprehensive coverage ([b1f3bc1](https://codeberg.org/tjdavid/coralite/commit/b1f3bc195ddfd3c8cb1ccf69228d0f536ee1f668))
- use param variable (plugin) ([9ef7a05](https://codeberg.org/tjdavid/coralite/commit/9ef7a0549fb350d587be00c03fa464b36118d628))
- allow computed errors to be handled outside plugin (plugin) ([4bfd0fa](https://codeberg.org/tjdavid/coralite/commit/4bfd0fa2555d083bcd6df141a39e8da7b1726f0b))
- improve heading ID generation with stricter sanitization (website) ([6862cfb](https://codeberg.org/tjdavid/coralite/commit/6862cfba431f181e79d451f33030cc9dd48c64ee))

### ✅ Tests

- add unit tests for normalizeFunction utility ([8ea8590](https://codeberg.org/tjdavid/coralite/commit/8ea8590d6808e41385dc3b040b12d149677a4a7e))
- add comprehensive unit tests for html.js ([bd21c8f](https://codeberg.org/tjdavid/coralite/commit/bd21c8fa14fd40384a678a736255ed28916b6c6a))
- add unit tests for CoraliteCollection ([6718a02](https://codeberg.org/tjdavid/coralite/commit/6718a0251b79aa9b08b7d4af94aa12b786bfa1ae))
- add unit tests for type-helper.js ([82e5cde](https://codeberg.org/tjdavid/coralite/commit/82e5cde6706e80d157b4df7084319491ff0aee1b))
- remove commented-out test cases from defineComponent.spec.js ([2415850](https://codeberg.org/tjdavid/coralite/commit/2415850fb8233d96b1a386abf43cb7e8632d3777))
- add unit tests for defineComponent plugin ([3dbbedc](https://codeberg.org/tjdavid/coralite/commit/3dbbedc3a0998784566e3e4c69322f41dece774b))

### 🧹 Chores

- remove unused type definitions from coralite types ([97cce69](https://codeberg.org/tjdavid/coralite/commit/97cce69b16311e81725a8f7bd082372e6120ba23))
- move CLI packages to devDependencies and esbuild to dependencies (deps) ([990ae08](https://codeberg.org/tjdavid/coralite/commit/990ae0822b2fb21db23a024a823d3f3faf9e8f26))
- update quotes rule to always allow template literals (eslint) ([3803fac](https://codeberg.org/tjdavid/coralite/commit/3803fac9012a8eaf0ce5989aed0564211f5b57f3))
- update coralite-plugin-aggregation to ^0.5.3 (deps) ([4c625ec](https://codeberg.org/tjdavid/coralite/commit/4c625ecf035a2007b456ded6b9c16f7ade90f1ed))
- update changelog ([5516956](https://codeberg.org/tjdavid/coralite/commit/5516956662615020b949be397fb127e3b05ada5d))

### 🔨 Other Changes

- release: version 0.19.0 ([c32293a](https://codeberg.org/tjdavid/coralite/commit/c32293af1ae194f7bb0766d6df0eca04b13bc174))
- Merge pull request 'fix: downgrade invalid custom element tag error to warning and fix template ID validation error message' (#45) from fix-parsing-reporting into main ([#45](https://codeberg.org/tjdavid/coralite/pulls/45)) ([d408aab](https://codeberg.org/tjdavid/coralite/commit/d408aabefa81d228f1b333f1d686e482b5c1e265))
- Merge pull request 'fix: remove empty text slot filtering in define-component' (#44) from fix-slot-empty-space into main ([#44](https://codeberg.org/tjdavid/coralite/pulls/44)) ([259198c](https://codeberg.org/tjdavid/coralite/commit/259198c46f29fe7820672859577fd3b0fbbef4f8))
- Merge pull request 'feat: improve code viewer with script syntax highlighting and clipboard functionality' (#43) from update-website-docs into main ([#43](https://codeberg.org/tjdavid/coralite/pulls/43)) ([34f5a26](https://codeberg.org/tjdavid/coralite/commit/34f5a266467e0f6c4032b4a7650ffda868c26df6))
- Merge remote-tracking branch 'origin/main' into update-website-docs ([e57b9d2](https://codeberg.org/tjdavid/coralite/commit/e57b9d20dd6342cd23082dd8cb8890450b3fe707))
- Merge pull request 'tests: add E2E tests for script-based components' (#42) from test-script-e2e into main ([#42](https://codeberg.org/tjdavid/coralite/pulls/42)) ([ef6a5f1](https://codeberg.org/tjdavid/coralite/commit/ef6a5f1b9a1ca2c734992762eafc1c74677b60c3))
- tests: add E2E tests for script-based components ([952e23a](https://codeberg.org/tjdavid/coralite/commit/952e23a4e46eedaa6c18d56b45606a7e5fb3dd1f))
- Merge pull request 'fix: token handling and HTML parsing' (#41) from fix-make-computed-token-strings-always-parsed into main ([#41](https://codeberg.org/tjdavid/coralite/pulls/41)) ([29197e2](https://codeberg.org/tjdavid/coralite/commit/29197e2647946932ab64fedf3f16bca5dba4e06a))
- Merge pull request 'docs: plugin type definitions and documentation' (#40) from clean-up-types into main ([#40](https://codeberg.org/tjdavid/coralite/pulls/40)) ([4bd027b](https://codeberg.org/tjdavid/coralite/commit/4bd027bfc349ed3bf0ba0ebf12888b4e10dad218))
- Merge pull request 'feat script and plugin system refactor' (#39) from script-manager into main ([#39](https://codeberg.org/tjdavid/coralite/pulls/39)) ([8df3bdd](https://codeberg.org/tjdavid/coralite/commit/8df3bdd15919b4b897a848dbf0f05c4094005f19))
- Merge pull request 'feat: add normalizeFunction utility' (#38) from normalise-function-util into main ([#38](https://codeberg.org/tjdavid/coralite/pulls/38)) ([d9b2ee8](https://codeberg.org/tjdavid/coralite/commit/d9b2ee851fb6836e941ffc8d13a306763b79b2f2))
- Merge pull request 'feat(html): improve file exclusion and hidden file handling' (#37) from handle-html-exclusions into main ([#37](https://codeberg.org/tjdavid/coralite/pulls/37)) ([70c1f12](https://codeberg.org/tjdavid/coralite/commit/70c1f1218c83ad674f404f79816e28bfa72785fd))
- Merge pull request 'feat: add user feedback, error handling, and prettified console output' (#35) from display-pretty-errors into main ([#35](https://codeberg.org/tjdavid/coralite/pulls/35)) ([a03e3e1](https://codeberg.org/tjdavid/coralite/commit/a03e3e1608971f4ae5c72a90304c73e00265625d))
- Merge pull request 'fix: calculate per-file duration for CSS and SASS builds' (#34) from fix-styles-duration into main ([#34](https://codeberg.org/tjdavid/coralite/pulls/34)) ([c07cd2d](https://codeberg.org/tjdavid/coralite/commit/c07cd2d12c4696e7c0de041479b5334eff15ee27))
- Merge pull request 'feat: trigger browser reload on page changes' (#33) from watch-pages into main ([#33](https://codeberg.org/tjdavid/coralite/pulls/33)) ([cf0d1d8](https://codeberg.org/tjdavid/coralite/commit/cf0d1d8fbdcc87ba721832be4d5d570ecffbda8d))
- Merge pull request 'fix: move performance tracking to per-document compilation' (#32) from fix-duration into main ([#32](https://codeberg.org/tjdavid/coralite/pulls/32)) ([34413e7](https://codeberg.org/tjdavid/coralite/commit/34413e77f64f1bc01d8e88b4af5228ea30e38436))
- Merge pull request 'feat(collection): enhance validation, deduplication, and item management' (#31) from collection-validation-checks into main ([#31](https://codeberg.org/tjdavid/coralite/pulls/31)) ([74e65b3](https://codeberg.org/tjdavid/coralite/commit/74e65b386c22be8a144c2da4b771392a707ebd37))
- Merge pull request 'Add validation and unit tests for defineConfig' (#30) from validate-coralite-configs into main ([#30](https://codeberg.org/tjdavid/coralite/pulls/30)) ([df9c447](https://codeberg.org/tjdavid/coralite/commit/df9c4475391250c7d099e34589d42627eb38d604))
- tests: add unit tests for config.js ([a697f46](https://codeberg.org/tjdavid/coralite/commit/a697f462e88c268a4d45fdb1e1987430328f11d2))
- Merge pull request 'Add debouncing and initial event filtering to file watcher' (#29) from fix-duplicate-compilations into main ([#29](https://codeberg.org/tjdavid/coralite/pulls/29)) ([3b71fa2](https://codeberg.org/tjdavid/coralite/commit/3b71fa2964c9dc78df4684f1b272f09acfd17cf5))
- Merge pull request 'feat(ci): add Forgejo workflow for unit tests' (#28) from unit-test-ci into main ([#28](https://codeberg.org/tjdavid/coralite/pulls/28)) ([d9ed857](https://codeberg.org/tjdavid/coralite/commit/d9ed857b3912a729b828dae8a3d32121bd90d515))
- Merge pull request 'Add  type guards and validation utilities for Coralite nodes' (#27) from type-helper-tests into main ([#27](https://codeberg.org/tjdavid/coralite/pulls/27)) ([64aca95](https://codeberg.org/tjdavid/coralite/commit/64aca957b456c1f4443e91610fd81ef2d12bd4af))
- Merge pull request 'defineComponent-test-coverage' (#26) from defineComponent-test-coverage into main ([#26](https://codeberg.org/tjdavid/coralite/pulls/26)) ([667babd](https://codeberg.org/tjdavid/coralite/commit/667babd108c4c132382146e829541cc3b15c8d96))
- Merge pull request 'Define component plugin token generation improvements' (#25) from handle-token-strings into main ([#25](https://codeberg.org/tjdavid/coralite/pulls/25)) ([d84f6df](https://codeberg.org/tjdavid/coralite/commit/d84f6dff94b0c736b43a3a81361af0f674e7b982))
- Merge pull request 'website-fix-copy' (#24) from website-fix-copy into main ([#24](https://codeberg.org/tjdavid/coralite/pulls/24)) ([fc99131](https://codeberg.org/tjdavid/coralite/commit/fc99131cff5d4a2e669c0482c550657ad1f4f1b9))
- Merge pull request 'purge-unused-script-variables' (#22) from purge-unused-script-variables into main ([#22](https://codeberg.org/tjdavid/coralite/pulls/22)) ([ce0484a](https://codeberg.org/tjdavid/coralite/commit/ce0484a0e643a1af0085aca80dcfc74636639d38))
- Merge remote-tracking branch 'origin/main' into purge-unused-script-variables ([e533cef](https://codeberg.org/tjdavid/coralite/commit/e533cef96eb3929d42dc134b1bb47baa775ab540))
- Merge pull request 'docs: coralite website link' (#21) from docfix into main ([#21](https://codeberg.org/tjdavid/coralite/pulls/21)) ([e8e65fb](https://codeberg.org/tjdavid/coralite/commit/e8e65fb5cfa0fa894df29901a3756c25b31adf77))
- Merge pull request 'fix: SourceTextModule identifier resolve absolute path' (#19) from fix-template-debugging into main ([#19](https://codeberg.org/tjdavid/coralite/pulls/19)) ([68fe198](https://codeberg.org/tjdavid/coralite/commit/68fe198fbea80a08757652ef1f0e5ad99af289f1))

## v0.18.7

> Comparing `v0.18.6` to `v0.18.7`

**Summary:** 27 commits

### ✨ Features

- update coralite dependencies to new version in package and template files ([b8506e4](https://codeberg.org/tjdavid/coralite/commit/b8506e4e8c1349550af989ce06956187aa9b70dc))
- add abort support for onSet and onUpdate callbacks (collection) ([c3eda2a](https://codeberg.org/tjdavid/coralite/commit/c3eda2abf02b7b50c306eb9b65cc75a2bd7074dc))
- enable JavaScript type checking with checkJs option ([3d654bc](https://codeberg.org/tjdavid/coralite/commit/3d654bc53b3526791f7ea35a9892dacc7e64957f))
- make parseModule to return isTemplate flag on missing template (core) ([4213031](https://codeberg.org/tjdavid/coralite/commit/4213031fb653dda22e28e2c6549bb57fa0d58800))
- add scaffolding command prompt to the footer ([904413c](https://codeberg.org/tjdavid/coralite/commit/904413ce2e33a5cb259f5202f9836dd345ebd7e6))

### 🐛 Bug Fixes

- invalid templates being added to collection ([9e9e9d4](https://codeberg.org/tjdavid/coralite/commit/9e9e9d413a1c20ce7a1ae98133d8accb2157e75b))
- update social meta urls to coralite.dev ([047682f](https://codeberg.org/tjdavid/coralite/commit/047682fe07045ce235a465e27ab49a858a63e871))

### 📚 Documentation

- update docs url to coralite.dev ([eac5da2](https://codeberg.org/tjdavid/coralite/commit/eac5da2da96855086f858696c8181bf30c875a34))
- update package.json author information ([3b003f2](https://codeberg.org/tjdavid/coralite/commit/3b003f2e87ddf699d1d1795c1b17871d802a3e12))

### 🎨 Styles

- update string formatting (config) ([1b3b46e](https://codeberg.org/tjdavid/coralite/commit/1b3b46ef2288d3378b4775acf323fa1bcade19b7))
- update @stylistic plugin to js scope and fix rule path (eslint) ([d655fc6](https://codeberg.org/tjdavid/coralite/commit/d655fc69f3af9639ee7cf1c8da673d28f93e219e))

### ✅ Tests

- add empty template to fixtures ([a04b083](https://codeberg.org/tjdavid/coralite/commit/a04b0830a51489260f1d0a20a50d327db21eb897))

### 🧹 Chores

- update package json formatting (deps) ([b6483a9](https://codeberg.org/tjdavid/coralite/commit/b6483a9410a9e43fc31ab01396f04dbf2f516be0))
- add eslint to workspace (deps) ([a8fb592](https://codeberg.org/tjdavid/coralite/commit/a8fb592bb166f2e1a33ff6135b081132f5d504a2))
- update @parcel/watcher and fix package extension format (deps) ([c1bc24c](https://codeberg.org/tjdavid/coralite/commit/c1bc24c33e3cdd804ae3e9fe9326faf1c6a6a816))
- update coralite to workspace:* (deps) ([c4c7dc1](https://codeberg.org/tjdavid/coralite/commit/c4c7dc178d9dbbd2076078748885f73897a0fa0c))
- update pnpm to v10.18.3 (deps) ([2a9953a](https://codeberg.org/tjdavid/coralite/commit/2a9953a9b5c787f636693d1bb0c8f004f9996149))
- update homepage URLs to coralite.dev (docs) ([e5705ef](https://codeberg.org/tjdavid/coralite/commit/e5705ef5c53b3dc97b288dd94dbda47d5f235288))
- update stylistic-eslint to v5.4.0 (deps) ([cd6d031](https://codeberg.org/tjdavid/coralite/commit/cd6d031bc61d27636786b1468c3337950be5f530))
- update website repository and author metadata (config) ([c97930e](https://codeberg.org/tjdavid/coralite/commit/c97930e9dc43f7ee3fb51689290a463180516d6d))
- update changelog ([384f526](https://codeberg.org/tjdavid/coralite/commit/384f526ae74b7dcea66b5afdf5941b7f305f540b))

### 🔨 Other Changes

- release: version 0.18.7 ([f44aa2a](https://codeberg.org/tjdavid/coralite/commit/f44aa2a821d1b7b802932cc778cb253598168df9))
- types: add isTemplate property to CoraliteModule interface ([94891d9](https://codeberg.org/tjdavid/coralite/commit/94891d91abd03f07ba38fbb3f5785983be2cf995))
- types: update plugin method type to Function ([b80f42b](https://codeberg.org/tjdavid/coralite/commit/b80f42bb4ca8588bfe04d153241e2ea286b02df9))
- types: remove duplicate CoraliteRef typedef ([dfdba01](https://codeberg.org/tjdavid/coralite/commit/dfdba011c879634e7aeadcd7d18aa3f38a37fe82))
- types: update ref resolver return type to HTMLElement | null ([3096818](https://codeberg.org/tjdavid/coralite/commit/3096818c1faf9411bd96bcb3e36feb141d2787fa))
- types: add generic types to plugin module and plugin interface ([f421087](https://codeberg.org/tjdavid/coralite/commit/f421087804c3802bfc820ccd4d5bb488f8aca7fa))

---

## v0.18.6

> Comparing `v0.18.5` to `v0.18.6`

**Summary:** 76 commits

### ✨ Features

- add automatic port finding with fallback to configured port 3000 (server) ([1c5e091](https://codeberg.org/tjdavid/coralite/commit/1c5e091096c734c6833eef6678e04f64f62d9f53))
- add styles directory creation and build support (server) ([96b35ca](https://codeberg.org/tjdavid/coralite/commit/96b35cac8ee913f3a034f1ca3e9b9d0d7b20d98d))
- handle template and page on change and unlink ([791c52b](https://codeberg.org/tjdavid/coralite/commit/791c52bea71880b581e0a8f003b2382c8796cf8c))
- add no-cache middleware to prevent caching of server responses (ui) ([fb1136e](https://codeberg.org/tjdavid/coralite/commit/fb1136e83091df7824c7f6a1336f35bfda652987))
- add static rays (website) ([0645c65](https://codeberg.org/tjdavid/coralite/commit/0645c65189d6a76df79b119d392b4bf8b7b9ba6a))
- add skip to content link (website) ([40204c4](https://codeberg.org/tjdavid/coralite/commit/40204c4676e6ae25769d04f5a8cbf9275d523708))
- add inline-css plugin with minification and at-import support v1.0.0 (config) ([6fabdd2](https://codeberg.org/tjdavid/coralite/commit/6fabdd26f885ec3ea6d84d91a436989997a4da3d))
- add coralite-plugin-inline-css v0.4.0 and update dependencies (deps) ([188f619](https://codeberg.org/tjdavid/coralite/commit/188f6198bda302463942618bb1ba36c35008466b))
- add link to license (website) ([a144ec6](https://codeberg.org/tjdavid/coralite/commit/a144ec62425dbd4ac2b6e7fedc2f244c3d9e6bab))
- add drop shadow to offcanvas (website) ([4982eca](https://codeberg.org/tjdavid/coralite/commit/4982ecafcfd87508f88a12c804e2cf57e9bda26e))
- add card template (website) ([5ac0eb1](https://codeberg.org/tjdavid/coralite/commit/5ac0eb13aee21e508ccfb3d3bc8c8f85d54d8303))
- add starter section (website) ([2c5a9a4](https://codeberg.org/tjdavid/coralite/commit/2c5a9a4c29854e288e153fea0fc735429599dda8))
- add author section (website) ([2464647](https://codeberg.org/tjdavid/coralite/commit/24646476aa8782ef6591cc2e9df0d5647fec65c3))
- add feature section (website) ([9f320f8](https://codeberg.org/tjdavid/coralite/commit/9f320f86943749ff6bb2d92e745116a982e86509))
- add new video background (website) ([731b976](https://codeberg.org/tjdavid/coralite/commit/731b9767698f0b1c33d7319e29009b0f4ce6891e))
- add ray effect to hero (website) ([832afdd](https://codeberg.org/tjdavid/coralite/commit/832afdddebc21a581f69538d110a8b9646468124))
- add padding bottom util (website) ([4a824f9](https://codeberg.org/tjdavid/coralite/commit/4a824f91f0327c3d782063dbda2d332587640e1c))
- add ray effect (website) ([d689fe7](https://codeberg.org/tjdavid/coralite/commit/d689fe7296dc0af50ccf6d771276c6f182af054e))
- make navbar toggler dark secondary (website) ([970fe0d](https://codeberg.org/tjdavid/coralite/commit/970fe0d591479eca9a1189c7d2533017076d6aaa))
- make secondary color rebecapurple (website) ([f06c348](https://codeberg.org/tjdavid/coralite/commit/f06c348cc5d8238310a91dc160189c86c39b35e5))
- add position classes (website) ([a963a8e](https://codeberg.org/tjdavid/coralite/commit/a963a8ea65df28ae7112b026f775cde3697075aa))
- add video background (website) ([cd3193b](https://codeberg.org/tjdavid/coralite/commit/cd3193b1333c1f5ec0eadcf45783b13664730ea9))
- add icon class (website) ([0163244](https://codeberg.org/tjdavid/coralite/commit/01632445092a22dbed48a456ed0a87a938e06f63))
- add flex alignment class (website) ([52a292a](https://codeberg.org/tjdavid/coralite/commit/52a292a1ce429ddcf70d8ae04ea47127d07a0cd1))
- add card component (website) ([ff0c668](https://codeberg.org/tjdavid/coralite/commit/ff0c66812c47fa28dc2536c10e643d4b1be99ce0))
- add more border utility classes (website) ([e83085b](https://codeberg.org/tjdavid/coralite/commit/e83085b7b2b8c91c01573ca723bb99a4266dbcef))
- add gradient backgrounds ([402f1f2](https://codeberg.org/tjdavid/coralite/commit/402f1f22c0f7f390e1f8a690f21a23c3afefd22b))
- progressive enhancement image ([b89e655](https://codeberg.org/tjdavid/coralite/commit/b89e65540135bd5cffe53e112ab890ece82f5990))
- author photo ([0d2cae4](https://codeberg.org/tjdavid/coralite/commit/0d2cae45d035f77038a64854f8bd6ea467e42a7e))
- icon sprite ([4b16a7c](https://codeberg.org/tjdavid/coralite/commit/4b16a7c36660759cfa12333e8a76686e82a5648b))
- normalise urls ([ed37b97](https://codeberg.org/tjdavid/coralite/commit/ed37b97dd60a7d317ce32dbefe7fd0097f722b20))
- dark mode only variables ([f605df4](https://codeberg.org/tjdavid/coralite/commit/f605df4a3f778ffde01181ecad95095d8a007718))
- dark mode only video ([9f7a8d5](https://codeberg.org/tjdavid/coralite/commit/9f7a8d5554b33ac7fbf7ccf57f1cd15f8210e3db))
- dark mode only navbar ([654758f](https://codeberg.org/tjdavid/coralite/commit/654758f8daab292fcd6c066be25bbaff1e4a4b6c))
- dark mode only hero ([53a5f0b](https://codeberg.org/tjdavid/coralite/commit/53a5f0bc526f552013433b2989e336a2a0bbd8d8))
- dark mode only code ([cb78938](https://codeberg.org/tjdavid/coralite/commit/cb78938eab9b7469ed1b6d5d117333a74b01b547))
- dark mode only buttons ([fc24c21](https://codeberg.org/tjdavid/coralite/commit/fc24c21f1ceb612d8d75b5cf9eee6d734d81c4ae))
- add border utility classes with secondary color support (website) ([b532954](https://codeberg.org/tjdavid/coralite/commit/b5329546abbbf84f3653cf72a085d970d7e1d7a5))
- add dark gradient background class with light mode media query v1.0.0 (website) ([b850702](https://codeberg.org/tjdavid/coralite/commit/b8507020d4ffb86e984911e007ac6c6ee2e0b0e3))
- add bg-glass background style for hero section (website) ([21c8880](https://codeberg.org/tjdavid/coralite/commit/21c8880b1ac5359be57123c10787a43f4794234a))
- add fetchpriority="high" to hero background image for performance optimization (ui) ([31d1417](https://codeberg.org/tjdavid/coralite/commit/31d141776f3fa19550e720345936d03bd4c8e2e0))
- add stylelist to website ([53b9875](https://codeberg.org/tjdavid/coralite/commit/53b98751b602b1843e9b16fd62054822ca5d240d))
- add neon shadow to logo (website) ([c34bdea](https://codeberg.org/tjdavid/coralite/commit/c34bdea9d592c0fe45996eba329e8485b0f5baa5))
- add shadow utils (website) ([017aa56](https://codeberg.org/tjdavid/coralite/commit/017aa567d059bf1ae8e4e68ae598eab6d8426ebe))
- add two coral borders to hero ([4ccb624](https://codeberg.org/tjdavid/coralite/commit/4ccb62423c4265820884be93996cb1977bdd4c0d))
- add placeholder dot ([6528bf8](https://codeberg.org/tjdavid/coralite/commit/6528bf88131e3fe3cbe37c225b1b4cd306552bac))
- add second coral border ([2db2224](https://codeberg.org/tjdavid/coralite/commit/2db22242fdadbf124455410ce43cfd8c267ed5be))

### 🐛 Bug Fixes

- margin bottom should match strength (website) ([a8318c5](https://codeberg.org/tjdavid/coralite/commit/a8318c5bab3bfe1120bf56d04fd3f4026869fe1d))
- add html file extension to href (website) ([39f511b](https://codeberg.org/tjdavid/coralite/commit/39f511bb2b1417bbdd84664d7c2a926f281f2998))
- remove duplicate padding for navbar (website) ([5aef7f5](https://codeberg.org/tjdavid/coralite/commit/5aef7f50414b50195729e3be3002463005ed0656))
- increase h2 font size (website) ([8109769](https://codeberg.org/tjdavid/coralite/commit/81097697ee49a13a77d41036fa2b68aaa3015b57))
- css lint ([a449a99](https://codeberg.org/tjdavid/coralite/commit/a449a99bb8591640ca75a4a0bd4d21ce6b06c0d2))
- increase hero subtitle font-size (website) ([2ea7da1](https://codeberg.org/tjdavid/coralite/commit/2ea7da16d14b94aa8b33ff37a21bb3e0b40e8402))
- hero body contrast for light mode (website) ([522fc00](https://codeberg.org/tjdavid/coralite/commit/522fc0098c436b9911e9b8582dff0b20d9da13d2))
- use shadow util for navbar (website) ([d705598](https://codeberg.org/tjdavid/coralite/commit/d705598797ac7a2e0af66755e1a20b184b60bfdc))

### 🎨 Styles

- disable background animation on mobile devices and enable on larger screens (website) ([4f45c55](https://codeberg.org/tjdavid/coralite/commit/4f45c55e7620610a43c17795b2f1a7b71e84d49f))
- add underline offset to links in base css (website) ([8611a60](https://codeberg.org/tjdavid/coralite/commit/8611a6099f95f0d73c99d2b9ced0199cfeac1475))
- update video background width from 75% to 65% in _video.css ([3da2dc1](https://codeberg.org/tjdavid/coralite/commit/3da2dc14effe0253a36468c7cc8ff397c63c0ac5))
- add border styles import to main CSS file ([4414566](https://codeberg.org/tjdavid/coralite/commit/441456699f59d9f586c8b1722bd2efbdecc6089c))
- remove margin-bottom from hero section layout ([c611958](https://codeberg.org/tjdavid/coralite/commit/c61195868a1310b3fc27590d2ecddb6d208e9ba3))

### ♻️ Code Refactoring

- make hero bg generic (website) ([09e5df3](https://codeberg.org/tjdavid/coralite/commit/09e5df38e88e011e4ff383dc5499dd4709fb0e93))
- rename _fonts.css to _font.css for consistency (css) ([1e849f7](https://codeberg.org/tjdavid/coralite/commit/1e849f720d9852e61485c640e67cf70812817389))
- update spacing utilities from py-5/px-5 to py-3/py-5 in CSS variables (ui) ([8b7d4d3](https://codeberg.org/tjdavid/coralite/commit/8b7d4d3e6d617de5d20be408150f7137277cce2c))
- remove hero background styles and border overrides (ui) ([6b9bf46](https://codeberg.org/tjdavid/coralite/commit/6b9bf46da83b42b734c2a3a341bc09ae195f79a3))
- replace dot with base64 ([37e32ca](https://codeberg.org/tjdavid/coralite/commit/37e32ca40d09c13137a9b65b6efc08ba07287000))
- change hero body shadow to drop shadow (website) ([9adf930](https://codeberg.org/tjdavid/coralite/commit/9adf930647363c14f438a3361fa2f1aa8460e985))

### 🧹 Chores

- update node engine to ^20.19.0 || >=22.19.0 and pnpm to 10.17.1 (deps) ([3b68231](https://codeberg.org/tjdavid/coralite/commit/3b68231f5e34037bcaeda52dc4d95e0399280a30))
- remove prefetch links for hero background images (website) ([4cc0eb9](https://codeberg.org/tjdavid/coralite/commit/4cc0eb9933dd88a758819d875bd0a419a306cb66))
- remove html-validate dependency (deps) ([81d94d9](https://codeberg.org/tjdavid/coralite/commit/81d94d983adc4bc1720b6c5821737029b2ff3f3e))
- compress coral border ([fbdd39e](https://codeberg.org/tjdavid/coralite/commit/fbdd39e8ebb80b70f0a6f2c2126ea85099481a43))
- update change log ([a78e04f](https://codeberg.org/tjdavid/coralite/commit/a78e04fe074a5fe6e3f0ac337180a35b34f60b38))
- website coralite-scripts version bump ([cf1acd6](https://codeberg.org/tjdavid/coralite/commit/cf1acd6ba925318a196f3bcd6ea7fa3e8f73a906))

### ⏪ Reverts

- revert redirects (website) ([e54a7d2](https://codeberg.org/tjdavid/coralite/commit/e54a7d2c2d712fa5b52463e5e24553f0e5cb70a1))


## v0.18.5

> Comparing `v0.18.4` to `v0.18.5`

**Summary:** 7 commits

### 🐛 Bug Fixes

- build css (coralite-scripts) ([a5c306b](https://codeberg.org/tjdavid/coralite/commit/a5c306bddcd8c7ac9b0d1209556cc6d3c1cb3d8a))

### 🧹 Chores

- update lockfile ([6626089](https://codeberg.org/tjdavid/coralite/commit/662608986d3d2946838f20539e9ad9ef664b914c))
- update coralite-scripts to v0.18.4 (deps) ([7e46282](https://codeberg.org/tjdavid/coralite/commit/7e462826ffc5cb9709d5c9de4272059466a9c0f4))
- update changelog ([b16abd8](https://codeberg.org/tjdavid/coralite/commit/b16abd82786201d48c9e589b79a9dac12eecf0a3))

---
## v0.18.4

> Comparing `v0.18.3` to `v0.18.4`

**Summary:** 28 commits, 2 pull requests

### ✨ Features

- add public directory copy functionality for dev mode (coralite-scripts) ([0c778db](https://codeberg.org/tjdavid/coralite/commit/0c778db2689b6886085d7a22d6a7d5667b225388))
- add recursive directory deletion utility function (coralite-scripts) ([6f1d31f](https://codeberg.org/tjdavid/coralite/commit/6f1d31f7c3e31847794c87c1239f1473f7560b7f))
- add copyDirectory utility function for recursive directory copying (coralite-scripts) ([f4e03c8](https://codeberg.org/tjdavid/coralite/commit/f4e03c8d4e3ace24289e49c29dc31f5d90e22e81))
- add layout utils ([39cde04](https://codeberg.org/tjdavid/coralite/commit/39cde045dbeaa10c1a895a65bd7dcf2b13964de0))
- add display utils ([529d5db](https://codeberg.org/tjdavid/coralite/commit/529d5db692f9456f3987ed1c3ba4dc4b881a8248))
- add sticky navbar ([c53ad54](https://codeberg.org/tjdavid/coralite/commit/c53ad545993bc504e2a216d344a404704473aa98))
- logo svg ([6ed7e63](https://codeberg.org/tjdavid/coralite/commit/6ed7e63527161204ffb4364f85cccdaba1fbeb06))
- hero background ([142d004](https://codeberg.org/tjdavid/coralite/commit/142d00429c5d91044ea11406e8d1503ed0d6206c))
- transfer from coralite.io ([2d5f6e2](https://codeberg.org/tjdavid/coralite/commit/2d5f6e254189656fce753e07b3b3928bccc57894))
- export types ([f6311d1](https://codeberg.org/tjdavid/coralite/commit/f6311d1c9c79e1f164bf19bf0dc23a0a5bc3c68c))

### 🐛 Bug Fixes

- clean up output directory before compilation ([9aef2c5](https://codeberg.org/tjdavid/coralite/commit/9aef2c5b726335defa033ecfa85de2ae15b6cb79))
- remove unused custom hot reload element ([53f7b0d](https://codeberg.org/tjdavid/coralite/commit/53f7b0dfc95668467ae49687139a44a0a0a8c143))
- update hero markup for responsive fix ([ee114b0](https://codeberg.org/tjdavid/coralite/commit/ee114b04a9dce837a1fd6ee207bf86e614f03632))
- make hero section responsive ([d92021a](https://codeberg.org/tjdavid/coralite/commit/d92021ae96ebac23870770dd8ee17f101f7af593))
- remove unused border on buttons ([b96c216](https://codeberg.org/tjdavid/coralite/commit/b96c216ea8053375df6f138c6d49ee0f904ea55f))

### 🧹 Chores

- remove redundant hrtime initialization in build mode ([02ef64b](https://codeberg.org/tjdavid/coralite/commit/02ef64bd7a7eb05dc2262ad6d1e4b575bee43b4b))
- update lock file ([104b45e](https://codeberg.org/tjdavid/coralite/commit/104b45e5b75c37ad4316c6a77d00fb4361f58f3e))
- update lock file ([dbbc34d](https://codeberg.org/tjdavid/coralite/commit/dbbc34ded47db7a759ac1d4c76191b16cbcf8e89))
- update coralite-scripts to v0.18.3 and add coralite-plugin-aggregation dependency (deps) ([ed267a6](https://codeberg.org/tjdavid/coralite/commit/ed267a6bc254c15f6c26b57982dd4c52ba761e28))
- update pnpm workspace dependencies esbuild and playwright-firefox to v0.18.3 (config) ([82acee4](https://codeberg.org/tjdavid/coralite/commit/82acee4befc2397094e9dde5f1da1869c02fe79f))
- update pnpm to v10.17.0 and add coralite-release dependency (deps) ([e8a19b9](https://codeberg.org/tjdavid/coralite/commit/e8a19b923e8573ab87b8fd3e8ce01fdae24ff210))
- update stylistic eslint plugins and @types/node to latest versions (deps) ([4a551ce](https://codeberg.org/tjdavid/coralite/commit/4a551ced17375486396048d31f0de6e9ffb306a7))
- build scripts before publish ([de2955c](https://codeberg.org/tjdavid/coralite/commit/de2955c4d873878b11763c42d8f8097b3e064952))
- update changelog ([2db0e84](https://codeberg.org/tjdavid/coralite/commit/2db0e84b49cd351ee0122586680e7b9d079a02d6))

### ⏪ Reverts

- version number ([01b95f2](https://codeberg.org/tjdavid/coralite/commit/01b95f2048ce39f5f6c1ea807a16084b54d575fa))

### 🔨 Other Changes

- release: version 0.18.4 ([ae0acc5](https://codeberg.org/tjdavid/coralite/commit/ae0acc530e0b60f3215dea64e3a8d17fb115bd65))
- Merge pull request 'Coralite scripts clean up build files' (#17) from build-include-public-files into main ([#17](https://codeberg.org/tjdavid/coralite/pulls/17)) ([88cf0da](https://codeberg.org/tjdavid/coralite/commit/88cf0dafaf2e17c1052511bd1b224bb233a3ab33))
- Merge pull request 'website' (#16) from website into main ([#16](https://codeberg.org/tjdavid/coralite/pulls/16)) ([b328121](https://codeberg.org/tjdavid/coralite/commit/b3281218277d68ba0a04e2960517acddcc4e9719))

### 🔗 Pull Requests

- [#16](https://codeberg.org/tjdavid/coralite/pull/16)
- [#17](https://codeberg.org/tjdavid/coralite/pull/17)

---

## v0.18.3

> Comparing `v0.18.2` to `v0.18.3`

**Summary:** 13 commits

### ✨ Features

- implement configurable step value for counter component (counter) ([3303301](https://codeberg.org/tjdavid/coralite/commit/330330166ba67bc746ed76cca99251f87490e742))
- update ref resolution type definition (refs) ([1ee5eda](https://codeberg.org/tjdavid/coralite/commit/1ee5eda1f9124cf930361f232d0734d1d081ac38))
- add CoralitePathValues and CoraliteValues typedefs (coralite) ([9d92284](https://codeberg.org/tjdavid/coralite/commit/9d92284a460fae8902ed4606dc26e270cfb11443))

### 🐛 Bug Fixes

- remove types build ([c36452c](https://codeberg.org/tjdavid/coralite/commit/c36452ccab0ca51ef67e97a385a3a4275f1efd18))
- add an export to jsdoc type files ([df59ce9](https://codeberg.org/tjdavid/coralite/commit/df59ce9d49d1d75f510fd2c73b3bfc9fd19729bf))
- remove unused CoraliteModuleScript callback and update tokens/slots param descriptions ([9d0a5c8](https://codeberg.org/tjdavid/coralite/commit/9d0a5c8fb7d85486e8877f55468bac567193ae95))
- add null safety checks for customElements access in initialise method ([2ae462f](https://codeberg.org/tjdavid/coralite/commit/2ae462fd3114a88576a89db13a879bc83e722edb))

### 📚 Documentation

- add CoraliteValues type definition to initialise method ([f9964d4](https://codeberg.org/tjdavid/coralite/commit/f9964d4c742aebdbe476fcf7013c4dc15afbc728))

### 🧹 Chores

- update publish script to use run build command instead of build-coralite (config) ([b81c8fd](https://codeberg.org/tjdavid/coralite/commit/b81c8fd16ad6d760b972f3ee79a0fa067a58ccfe))
- update changelog ([e7ce7c0](https://codeberg.org/tjdavid/coralite/commit/e7ce7c009eb3a59433e7cc94a7dadb92226f5889))

### 🔨 Other Changes

- release: version 0.18.3 ([7e35779](https://codeberg.org/tjdavid/coralite/commit/7e3577984b82dfdc548940d2eb7c61e402cc53a3))
- release: version 0.18.2 ([b2c1ec0](https://codeberg.org/tjdavid/coralite/commit/b2c1ec00e82a8e0e2f4129fb7681d42a67bafa1a))
- release: version 0.18.2 ([61be599](https://codeberg.org/tjdavid/coralite/commit/61be599b67672657e49ad19b112c1bd7a64a431c))

---

## v0.18.2

> Comparing `v0.18.1` to `v0.18.2`

**Summary:** 16 commits, 2 pull requests

### ✨ Features

- add CLI testing workflow ([220de0a](https://codeberg.org/tjdavid/coralite/commit/220de0aa481d179c389c8ba8a793361d58044722))
- add build scripts and dist output support (coralite-scripts) ([997ce8e](https://codeberg.org/tjdavid/coralite/commit/997ce8ef6ddebae8ef3ae85ea9c5a037d7f83110))

### 🐛 Bug Fixes

- update type imports to use relative paths instead of #types alias ([d67447a](https://codeberg.org/tjdavid/coralite/commit/d67447aaa2b2c2749e43bad1ce2e6da522e69f40))

### ♻️ Code Refactoring

- add path aliases for lib and plugins modules (core) ([ea2150e](https://codeberg.org/tjdavid/coralite/commit/ea2150effaf12fbb73a92031c8422ef2d6ff9146))
- remove minify-whitespace from esbuild commands (build) ([78c7b88](https://codeberg.org/tjdavid/coralite/commit/78c7b8857dada4634320bfce5306c1286018c455))

### 🔧 Continuous Integration

- add end-to-end testing workflow with Playwright setup ([5ece5a4](https://codeberg.org/tjdavid/coralite/commit/5ece5a495590472290e39fd2eccf5faede2e0425))

### 🧹 Chores

- remove deprecated GitHub Actions workflows and release configuration files (ci) ([a1b11d3](https://codeberg.org/tjdavid/coralite/commit/a1b11d34fe6345192b77305949e794c3e430cb46))
- update build commands in e2e and script test workflows (ci) ([7277d16](https://codeberg.org/tjdavid/coralite/commit/7277d16502638e6684ebb81fb7dd8dbb9447aeef))
- add esbuild  and premove to workspace (deps) ([82b13ee](https://codeberg.org/tjdavid/coralite/commit/82b13ee751a9541d62f27c2be6f7c92f39041800))
- update package.json build scripts for coralite and coralite-scripts packages (config) ([80e9484](https://codeberg.org/tjdavid/coralite/commit/80e9484a18010d7d36d67efb565436e833367d56))
- remove unused #types import alias from package.json (config) ([7571a5e](https://codeberg.org/tjdavid/coralite/commit/7571a5e97ae2eac2d80b4646be4ed5e4618acdf7))

### 🔨 Other Changes

- release: version 0.18.2 ([61be599](https://codeberg.org/tjdavid/coralite/commit/61be599b67672657e49ad19b112c1bd7a64a431c))
- Merge pull request 'Add export types support for coralite-script #14' (#15) from coralite-script-types into main ([#14](https://codeberg.org/tjdavid/coralite/pulls/14)) ([968c4bb](https://codeberg.org/tjdavid/coralite/commit/968c4bba4a87174baf624b771ddc235c1c5bf8d3))
- Merge pull request 'resolve-types' (#13) from resolve-types into main ([#13](https://codeberg.org/tjdavid/coralite/pulls/13)) ([6bef32a](https://codeberg.org/tjdavid/coralite/commit/6bef32a630cfe4ff1ad5ceb7d9cb32d6ab32b532))
- release: version 0.18.1 ([c070d75](https://codeberg.org/tjdavid/coralite/commit/c070d7540daccaf0bd1c120b70389d6a479e7a8a))
- release: version 0.18.1 ([b73d837](https://codeberg.org/tjdavid/coralite/commit/b73d83772e3fc3d90a7fc27cd89e06f21b258b8f))

### 🔗 Pull Requests

- [#13](https://codeberg.org/tjdavid/coralite/pull/13)
- [#14](https://codeberg.org/tjdavid/coralite/pull/14)

---


> Comparing `v0.18.0` to `v0.18.1`

**Summary:** 7 commits

### 🐛 Bug Fixes

- update jsconfig.json module property to lowercase nodenext (config) ([5fd4926](https://codeberg.org/tjdavid/coralite/commit/5fd4926e853a3f9e1f3f19caca8e2ba913cc19e5))
- correct config file path handling (coralite) ([dd17194](https://codeberg.org/tjdavid/coralite/commit/dd171944053b3a97c5362b561e0ba6105b5de091))

### 🧹 Chores

- update publish script to build coralite before publishing (package) ([482167d](https://codeberg.org/tjdavid/coralite/commit/482167df0c528adcfae7a19090d58bc015c9851c))
- changelog ([6e149ac](https://codeberg.org/tjdavid/coralite/commit/6e149ac4f0dea133bf47548962a36984de8f3e43))

---

## v0.18.0

> Comparing `v0.17.0` to `v0.18.0`

**Summary:** 25 commits, 2 pull requests

### ✨ Features

- export core modules and update import paths (coralite) ([bf4c2e4](https://codeberg.org/tjdavid/coralite/commit/bf4c2e4030f6a7a6c4a4d155abe4899b49a0c298))
- add type exports (core) ([37f0820](https://codeberg.org/tjdavid/coralite/commit/37f0820b54529680fe39c1cc96bd07987dc29e8a))
- add default export for Coralite (core) ([c359796](https://codeberg.org/tjdavid/coralite/commit/c35979605211b1e457d9b48c86d9a8134165ea68))
- add tsconfig.json for coralite (config) ([bc4a132](https://codeberg.org/tjdavid/coralite/commit/bc4a1328708bf07ab489cf4894110dc9de35e9b8))

### 🐛 Bug Fixes

- correct banner structure in test ([0138a43](https://codeberg.org/tjdavid/coralite/commit/0138a43b8fb184a1caa8d98244e3aa162157920c))
- update coralite imports to use the core package instead of plugins ([537b98d](https://codeberg.org/tjdavid/coralite/commit/537b98dc7604115b8bb077c07c8f5a607b36370b))
- update code highlight component import path corallite/utils to coralite ([1a5b26d](https://codeberg.org/tjdavid/coralite/commit/1a5b26de38231b8d10a6350c3a3e5d5190ce55ab))
- correct nested-components fixture header tag name corallite-header → coralite-title ([5635682](https://codeberg.org/tjdavid/coralite/commit/5635682ea29635c3f142a6f61e595de8fb0c8215))
- reduce css template image sizes ([b77c8a1](https://codeberg.org/tjdavid/coralite/commit/b77c8a1f416e1e842624d4210c05e66cf8dc1c54))

### ♻️ Code Refactoring

- simplify config loading and remove getPkg utility (coralite) ([813039f](https://codeberg.org/tjdavid/coralite/commit/813039fc527f48d92b2460d338e6ba577c5d76b8))
- update e2e workflow to use filter syntax for coralite package. (ci) ([8080368](https://codeberg.org/tjdavid/coralite/commit/80803684ac2c53ab308e1da2562e63dbdc06b4ae))
- update path handling for template rendering with url pathname conversion ([aa68dea](https://codeberg.org/tjdavid/coralite/commit/aa68deaa6546194aec06388d7d2ce25f1a577868))

### 🧹 Chores

- update npm ignore and files (config) ([07b4e29](https://codeberg.org/tjdavid/coralite/commit/07b4e295e0b6b8ab9a0f1c4960ca9b3884c9a938))
- update workflow to use build-coralite script instead of symlink step (ci) ([3ec1beb](https://codeberg.org/tjdavid/coralite/commit/3ec1bebee0fb93450651e3829983b623e85caee9))
- add build coralite ([814e916](https://codeberg.org/tjdavid/coralite/commit/814e916bdb57cf87a656a002c84a5227e0f50d4b))
- update test workflow to use coralite filter for build-html command (ci) ([7188b7d](https://codeberg.org/tjdavid/coralite/commit/7188b7d9851437d5af350fce92cc7db86bd1a3b2))
- add esbuild and premove (deps) ([86e3f2f](https://codeberg.org/tjdavid/coralite/commit/86e3f2fbf89bdc456c1d25ddad12ae76c6d45b65))
- update package.json with new build scripts and dependencies ([349f91e](https://codeberg.org/tjdavid/coralite/commit/349f91efc26e5ca700889b72ff2df81a2470c644))
- update node engine requirement to ^20.19.0 || >=22.12.0 (config) ([179b64e](https://codeberg.org/tjdavid/coralite/commit/179b64e7fb20e56a4e68ff5d075fdfb21f341d6e))
- add typescript to workspace (deps) ([68ef5d4](https://codeberg.org/tjdavid/coralite/commit/68ef5d4e741af00fd0226842c34550218437749c))
- remove unused test-e2e and build-html scripts from package.json (config) ([187ba24](https://codeberg.org/tjdavid/coralite/commit/187ba24d92102c7126573c0067cf744d4f6cac73))
- update jsconfig.json module resolution to nodenext and add exclude patterns (config) ([5b96c23](https://codeberg.org/tjdavid/coralite/commit/5b96c23669d581a199f6fbd17a2730202866a29e))

### 🔨 Other Changes

- release: version 0.18.0 ([91a753a](https://codeberg.org/tjdavid/coralite/commit/91a753afa3f7bbf71effcefa4ee5036729c648c3))
- Merge pull request 'remove-config-loader-dep' (#12) from remove-config-loader-dep into main ([#12](https://codeberg.org/tjdavid/coralite/pulls/12)) ([633dc0a](https://codeberg.org/tjdavid/coralite/commit/633dc0a54cfee8ad982bf2499eb2d7a0c9d6ab4c))
- Merge pull request 'create-types' (#11) from create-types into main ([#11](https://codeberg.org/tjdavid/coralite/pulls/11)) ([69cb2b1](https://codeberg.org/tjdavid/coralite/commit/69cb2b17d58ea47552d412a76f63590fe77cd770))

### 🔗 Pull Requests

- [#11](https://codeberg.org/tjdavid/coralite/pull/11)
- [#12](https://codeberg.org/tjdavid/coralite/pull/12)

---

## v0.17.0

> Comparing `v0.16.0` to `v0.17.0`

**Summary:** 56 commits, 2 pull requests

### ✨ Features

- add script template to create templates (create-coralite) ([1a19dcd](https://codeberg.org/tjdavid/coralite/commit/1a19dcdbe26ef719eafb581f06b757d00ef9686e))
- add CSS to CSS template ([5c63280](https://codeberg.org/tjdavid/coralite/commit/5c632805a0308089338ac0f5bffeda5549db7890))
- add CSS build support and improve style handling logic (server) ([432e72d](https://codeberg.org/tjdavid/coralite/commit/432e72de2da71dc72aa93ee5aac4fac4055cc597))
- add CSS building functionality with PostCSS support (coralite-scripts) ([33de412](https://codeberg.org/tjdavid/coralite/commit/33de412519e9be843b28b26d864d2568fa2d0679))
- include post css for development script ([4d23c15](https://codeberg.org/tjdavid/coralite/commit/4d23c1526ac770ca4d770c430f6fa3c16bbf9ee1))
- update CLI to use mode argument instead of dev/build flags (coralite-scripts) ([b1c2b78](https://codeberg.org/tjdavid/coralite/commit/b1c2b789e698889c75def2e76c016489e09c266b))
- add publish-create script for create-coralite package publishing ([c9485e4](https://codeberg.org/tjdavid/coralite/commit/c9485e49d61fa83532d5647138b67d0a4f993390))

### 🐛 Bug Fixes

- update path handling in save method to use relative() function instead of regex replacement ([8c6e7cc](https://codeberg.org/tjdavid/coralite/commit/8c6e7ccf3d28ccb61500c1da02c53d3c1fc1520a))
- update module linker to use file URL for relative paths (core) ([f43feff](https://codeberg.org/tjdavid/coralite/commit/f43feff198db170dc3f5fd142c9a744ae8a96344))
- resolve correct path for module linker (module_linker) ([08cfec7](https://codeberg.org/tjdavid/coralite/commit/08cfec774833da7605f36124469838de84b75cfc))
- simplify config loading error handling in loader.js ([68a0786](https://codeberg.org/tjdavid/coralite/commit/68a0786d1e618dde8ab17a4d38036816977d67be))
- only get item if html file extension if not found (collection) ([1695ee6](https://codeberg.org/tjdavid/coralite/commit/1695ee6f4aba852dd6aa07f626687117ad98c623))
- update config loading to use href instead of toString() for path resolution (config-loader) ([a766b93](https://codeberg.org/tjdavid/coralite/commit/a766b93f7e39dabfbb07be9788d67391ed1e6b85))
- only attempt to create slot components from elements ([516a4f6](https://codeberg.org/tjdavid/coralite/commit/516a4f6b2332031cf09ec2da04a6bd4b1e3e4c0b))
- refactor file path handling in server.js to use pathname instead of filePath variable ([58e4c58](https://codeberg.org/tjdavid/coralite/commit/58e4c58df1f9b9a8b9419704b1ae9262ce6bdd86))
- make config loading with async fs access and URL handling ([6a01252](https://codeberg.org/tjdavid/coralite/commit/6a012528baeb5ef9973ee1bd0f570dc7d7c15877))
- update config loading to use pathToFileURL for ES module support ([bc8cb3b](https://codeberg.org/tjdavid/coralite/commit/bc8cb3bdfda8ee53e072146574f5ad1cfdda8206))
- path resolve for html getter ([fb06faa](https://codeberg.org/tjdavid/coralite/commit/fb06faa53740989663f3bed6d6d2c8d295b62640))
- remove redundant path.join from component warning message (createComponent) ([83fd9c5](https://codeberg.org/tjdavid/coralite/commit/83fd9c5d4e0eb538972a39569d6a5bbb698028ab))
- normalize document paths when saving HTML files (save) ([16e465e](https://codeberg.org/tjdavid/coralite/commit/16e465e40f9c757c5374e767d18c6301aae3a866))
- avoid over formatting the pathname (compile) ([959048b](https://codeberg.org/tjdavid/coralite/commit/959048b10952cfa724f10dd002aa180999138352))
- correct the path separators ([5216bdb](https://codeberg.org/tjdavid/coralite/commit/5216bdb0ac69620c14f7ac4ab1f3534c7ef09c25))
- normalise rootDir ([5dc5d6b](https://codeberg.org/tjdavid/coralite/commit/5dc5d6b77b6f4371500bf72ef6d41ee0ab4fd5e7))
- update create-coralite version from 0.16.1 to 0.16.0 (deps) ([1909b6e](https://codeberg.org/tjdavid/coralite/commit/1909b6e04faeeadd77c1712e21b30d531fdb0970))

### 📚 Documentation

- update type definitions with cssPlugins property for Postcss support ([dd5b03a](https://codeberg.org/tjdavid/coralite/commit/dd5b03a28e3fbc3971d5d3d0b237437345584121))
- update README with new guides and references structure ([d55d636](https://codeberg.org/tjdavid/coralite/commit/d55d636f0a79dae174a06f3906508ff4811c1b1d))
- update definitions for config and options types ([f10e28e](https://codeberg.org/tjdavid/coralite/commit/f10e28e42fc5c134e250e0d96b310c997b551c76))
- update README with new package structure and setup instructions ([2581a53](https://codeberg.org/tjdavid/coralite/commit/2581a533cd762b87d5071fa95e1ae5ddab5ec14c))
- add javascript usage documentation for coralite components ([900e9f7](https://codeberg.org/tjdavid/coralite/commit/900e9f70705d42e54957acb510f62e49a2a8ea02))
- update documentation links to packages/coralite path ([ed591a6](https://codeberg.org/tjdavid/coralite/commit/ed591a607d1d13e4fae12c862918fc741893079a))
- update CHANGELOG.md pull request links to new format v0.15.0 ([587b0f7](https://codeberg.org/tjdavid/coralite/commit/587b0f7565e17691ef7eb741050809774db150b3))

### ♻️ Code Refactoring

- convert buildSass to named function and export default properly (core) ([204d296](https://codeberg.org/tjdavid/coralite/commit/204d296bc4c0c5b47cb3b776f4001c22af81c491))
- use normalize instead of join for template and page paths ([5d5948a](https://codeberg.org/tjdavid/coralite/commit/5d5948a2bffc1067dbf9439b91080b4174e6b6d1))
- update type definitions for module linker path parameter ([8b9484f](https://codeberg.org/tjdavid/coralite/commit/8b9484f275ef057567499695b42da71ddd475f56))
- simplify template path resolution in _evaluate method (core) ([386ab55](https://codeberg.org/tjdavid/coralite/commit/386ab55706f0f4e54f6587211742d4d7878361d3))
- rename css config from `css` to `styles` with type field for both css and scss templates (core) ([2916e89](https://codeberg.org/tjdavid/coralite/commit/2916e89213c00376bf161b71ceb57ed2d3594206))
- move development server with hot-reloading and SASS support to server.js ([83ff4c7](https://codeberg.org/tjdavid/coralite/commit/83ff4c7eb0f53f33877bcbb63d517b136df3b2a7))
- restructure package files and update config types (coralite-scripts) ([e36434f](https://codeberg.org/tjdavid/coralite/commit/e36434f84739bdf88c0500a0db3466846d42fca1))

### 🧹 Chores

- update coralite-scripts commands to remove --dev and --build flags (config) ([5d99018](https://codeberg.org/tjdavid/coralite/commit/5d9901881a05be30c50e957c606516ba64eda8d3))
- correct scss style configuration order ([58fb0e8](https://codeberg.org/tjdavid/coralite/commit/58fb0e80373e62f09b345fe70e7a409adea0a600))
- update coralite-scripts commands to remove --dev and --build flags (config) ([e3cab93](https://codeberg.org/tjdavid/coralite/commit/e3cab9319f5d2175e8145e653e95399e4eab8360))
- update html script to use node with experimental modules flags ([572656d](https://codeberg.org/tjdavid/coralite/commit/572656d455c9ae4308a2a4b561ab3992e35418c6))
- update loadConfig import to fix module resolution (deps) ([51c93dc](https://codeberg.org/tjdavid/coralite/commit/51c93dc621228e3e3ea5710007448efc65bef5f5))
- reorder engine property (deps) ([8c64007](https://codeberg.org/tjdavid/coralite/commit/8c640073d3f2933bee709f214fc002a288f25cd9))
- update coralite-scripts to v0.17.0 and update start/build scripts (deps) ([37ee2ff](https://codeberg.org/tjdavid/coralite/commit/37ee2ff78e67e34b32ef03f916f72a30e79d0ac9))
- update exports path and add commander dependency v14.0.0 (coralite-scripts) ([3ab004a](https://codeberg.org/tjdavid/coralite/commit/3ab004a9d589697c7597fc34d03ca2937ac4f024))
- update commander to v14.0.0 and add coralite-scripts to website importer (deps) ([c110eef](https://codeberg.org/tjdavid/coralite/commit/c110eef512f118e1af8d71744c5c956b3ef7002b))
- add licenses ([9464dc9](https://codeberg.org/tjdavid/coralite/commit/9464dc90803acc4dc0ddfe4dd424ac9e0eb6def5))
- add licenses ([172cfa4](https://codeberg.org/tjdavid/coralite/commit/172cfa4530086b01db21fa40fb7f7c918b1cb3bc))
- update changelog ([4deae2c](https://codeberg.org/tjdavid/coralite/commit/4deae2c1a52289ad0e61e34fbd9d2df9a20afaf4))
- update create-coralite version to 0.16.1 (deps) ([49a7db1](https://codeberg.org/tjdavid/coralite/commit/49a7db10157faea84788a1a3615bd676bec99b82))
- update coralite-scripts to v0.16.0 in templates (deps) ([b0ef816](https://codeberg.org/tjdavid/coralite/commit/b0ef816fa63cee4cd6a0b407caeae560c8955daa))

### 🔨 Other Changes

- release: version 0.17.0 ([a7eb90e](https://codeberg.org/tjdavid/coralite/commit/a7eb90ee01e75f983e14f9b80691bece7a0bed7a))
- Merge pull request 'Fix Windows path resolution' (#10) from fix-windows-path-resolve into main ([#10](https://codeberg.org/tjdavid/coralite/pulls/10)) ([f0cb3a4](https://codeberg.org/tjdavid/coralite/commit/f0cb3a42ab1e0af194b31122b5ac3e3bdd4fb24a))
- Merge pull request 'build-scripts' (#9) from build-scripts into main ([#9](https://codeberg.org/tjdavid/coralite/pulls/9)) ([e6cde4c](https://codeberg.org/tjdavid/coralite/commit/e6cde4c3ac2945f42ccfc4b12e58ba1c61fa7b14))
- Merge remote-tracking branch 'origin/main' into build-scripts ([9a6ff49](https://codeberg.org/tjdavid/coralite/commit/9a6ff494a0dd5d159a240dc0d0f89148d01c5e92))

### 🔗 Pull Requests

- [#9](https://codeberg.org/tjdavid/coralite/pull/9)
- [#10](https://codeberg.org/tjdavid/coralite/pull/10)

---

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

---

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

---


# Changelog

## v0.14.2

> Comparing `v0.14.0` to `v0.14.2`

**Summary:** 7 commits

### ✨ Features

- add continue file to .npmignore ([d72e104](https://codeberg.org/tjdavid/coralite/commit/d72e104550687c8c628d8fff757d6b08ec81291b))

### 🐛 Bug Fixes

- limit token length in getTokensFromString (parse) ([a7d9e7c](https://codeberg.org/tjdavid/coralite/commit/a7d9e7c26ef7771cbeaf50e9b5de8ff8cf8aacd2))
- only parse tokens inside template and not script tags (parse) ([5dd9c57](https://codeberg.org/tjdavid/coralite/commit/5dd9c571201b49b1f80d2683ab61d2036af1e3fa))
- use isValidCustomElementName for validation (tags) ([cb5ce8b](https://codeberg.org/tjdavid/coralite/commit/cb5ce8b24aed5e828dbb2f89da52fcc90d7710dc))
- limit template id and custom element tag names to 1000 characters (parse.js) ([488a9f3](https://codeberg.org/tjdavid/coralite/commit/488a9f3d19c20d009585baae7df1b552ce35f5c0))

### 🧹 Chores

- version bump ([93c5efd](https://codeberg.org/tjdavid/coralite/commit/93c5efd9a89816e17cfa30f42ce31ebf8db6ee19))
- changelog ([9672cd5](https://codeberg.org/tjdavid/coralite/commit/9672cd5604795ee9f874359e51b364d29c80b28c))

---

## v0.14.0

> Comparing `v0.13.0` to `v0.14.0`

**Summary:** 6 commits

### 🐛 Bug Fixes

- check if method is null before validating type (plugin) ([e8efcde](https://codeberg.org/tjdavid/coralite/commit/e8efcdefecb8d2c5960fa8545d7b9f54df49b810))

### ♻️ Code Refactoring

- use _plugins instead of options.plugins (plugin) ([7af76fd](https://codeberg.org/tjdavid/coralite/commit/7af76fdf0b81e997dff8d9123d3ff3368813046f))
- update options and source context references (coralite) ([187b3dd](https://codeberg.org/tjdavid/coralite/commit/187b3dd5076fa9fbc7c13e7a71bd8321c1bc2c49))
- add conditional check for plugin method ([a607a43](https://codeberg.org/tjdavid/coralite/commit/a607a43d713a7990945e7d7a249cd51ed9a3faac))

### 🧹 Chores

- version bump ([6abb375](https://codeberg.org/tjdavid/coralite/commit/6abb3759beaf4737e040db70bf93e61d24af22af))
- update changelog ([ceb18d4](https://codeberg.org/tjdavid/coralite/commit/ceb18d4d4c1be6daf78d22654e734cb985e49b92))

---


## v0.13.0

> Comparing `v0.12.0` to `v0.13.0`

**Summary:** 6 commits

### 🐛 Bug Fixes

- include temp elements for hooks and remove it for compile ([068131e](https://codeberg.org/tjdavid/coralite/commit/068131e2ea99f8f7df52302d9e0150e87c9afbb2))

### ♻️ Code Refactoring

- update hook names to match onPageSet and onTemplateSet ([ff4f4d0](https://codeberg.org/tjdavid/coralite/commit/ff4f4d0786d92143ebf35b4983cfcc8ab5ecf20e))
- update plugin hooks ([fa76692](https://codeberg.org/tjdavid/coralite/commit/fa766923fe21a33192d585b050fe2486d6b7c79d))

### 🧹 Chores

- version bump ([8e2857e](https://codeberg.org/tjdavid/coralite/commit/8e2857e65a69280afa5319bd4f9b67409acb4635))
- version bump ([1e6b9b1](https://codeberg.org/tjdavid/coralite/commit/1e6b9b17cb942050cd808a24c5edbf834b6276a1))

### 🔨 Other Changes

- types: update callback names for page and template events ([0183b90](https://codeberg.org/tjdavid/coralite/commit/0183b90d647064351fd968660088df5a9209ea41))
