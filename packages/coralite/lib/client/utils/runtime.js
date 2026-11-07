/**
 * Generates the client-side runtime script for Coralite pages.
 *
 * @param {Object} options - The options used to configure the client-side runtime.
 * @param {string} options.base - The base URL for assets.
 * @param {string} options.sharedChunkPath - The filename of the shared chunk.
 * @param {string[]} [options.declarativeTags=[]] - The declarative tags used.
 * @param {string} [options.hydrationData='{}'] - Serialized component instance hydration data.
 * @param {string} [options.routeData='undefined'] - Serialized active route object.
 * @param {boolean} [options.viewTransitions=false] - Whether View Transitions are enabled for SPA navigation.
 * @param {string} [options.pageConfig='null'] - Serialized page configuration object.
 * @param {string} [options.mode='production'] - Build mode.
 * @param {'full' | 'minimal'} [options.reconcile='full'] - Legacy reconcile mode fallback.
 * @param {'full' | 'minimal'} [options.listStrategy='full'] - List reconciliation strategy.
 * @param {string} [options.instanceCounters='{}'] - Serialized instance counters map.
 * @param {string} [options.inlinedStyles='[]'] - Serialized inlined styles array.
 * @param {boolean} [options.preserveTestId=false] - Whether to preserve data-testid in production.
 * @returns {string} The generated JavaScript runtime.
 */
export function generateClientRuntime ({
  base,
  sharedChunkPath,
  declarativeTags = [],
  hydrationData = '{}',
  routeData = 'undefined',
  viewTransitions = false,
  pageConfig = 'null',
  mode = 'production',
  reconcile = 'full',
  listStrategy,
  instanceCounters = '{}',
  inlinedStyles = '[]',
  preserveTestId = false
}) {
  const effectiveStrategy = listStrategy || reconcile || 'full'
  const shouldStripTestId = mode === 'production' && !preserveTestId && process.env.CORALITE_PRESERVE_TESTID !== 'true'
  const isProd = mode === 'production'
  const sharedImports = isProd
    ? 'getClientContext, createCoraliteClass, globalClientHooks, initPlugins, setupPageRuntime, createImportCSS, formatCoraliteHTML'
    : 'getClientContext, createCoraliteClass, globalClientHooks, setupDevTools, registerDevToolsComponent, initPlugins, setupPageRuntime, createImportCSS, formatCoraliteHTML'

  return `
(async () => {
  if (!window.__coralite__) {
    Object.defineProperty(window, '__coralite__', {
      value: {},
      writable: true,
      configurable: true,
      enumerable: false
    });
  }
  const coralite = window.__coralite__;
  coralite.config = coralite.config || {};
  coralite.state = coralite.state || {};
  coralite.dom = coralite.dom || {};
  coralite.plugins = coralite.plugins || {};

  coralite.config.listStrategy = coralite.config.listStrategy || ${JSON.stringify(effectiveStrategy)};
  if (coralite.config.viewTransitions === undefined) {
    coralite.config.viewTransitions = ${Boolean(viewTransitions)};
  }
  coralite.config.page = Object.assign(
    {},
    coralite.config.page || {},
    ${pageConfig}
  );

  coralite.state.counters = Object.assign(
    {},
    coralite.state.counters || {},
    ${instanceCounters}
  );
  coralite.state.hydration = Object.assign(
    {},
    coralite.state.hydration || {},
    ${hydrationData}
  );
  ${routeData !== 'undefined' ? `coralite.state.route = ${routeData};` : ''}
  coralite.state.stylesLoaded = coralite.state.stylesLoaded || new Set(${inlinedStyles});

  if (typeof coralite.state.getHydration !== 'function') {
    coralite.state.getHydration = () => coralite.state.hydration;
    coralite.state.mergeHydration = (next) => {
      if (next && typeof next === 'object') {
        Object.assign(coralite.state.hydration, next);
      }
    };
    coralite.state.replaceHydration = (next) => {
      coralite.state.hydration = next && typeof next === 'object' ? next : {};
    };
  }

  const [
    { ${sharedImports} },
    { default: componentManifest }
  ] = await Promise.all([
    import('${base}assets/js/${sharedChunkPath}'),
    import('${base}assets/js/manifest.js')
  ]);

  const declarativeTags = ${JSON.stringify(declarativeTags)};
  if (typeof createImportCSS === 'function') {
    coralite.dom.importCSS = createImportCSS({
      base: ${JSON.stringify(base)},
      manifest: componentManifest
    });
  }

  const loadCache = {};

  const loadComponent = (componentId) => {
    if (typeof customElements !== 'undefined' && customElements.get && customElements.get(componentId)) {
      return Promise.resolve();
    }
    const entry = componentManifest[componentId];
    if (!entry) return Promise.resolve();
    if (loadCache[componentId]) return loadCache[componentId];

    loadCache[componentId] = (async () => {
      const jsPath = typeof entry === 'string' ? entry : entry.js;
      const cssPath = typeof entry === 'object' ? entry.css : null;

      if (cssPath) {
        const fullCssPath = '${base}assets/css/' + cssPath;
        const isLoaded = coralite.state.stylesLoaded && coralite.state.stylesLoaded.has(componentId);

        if (!document.querySelector('link[href="' + fullCssPath + '"]') && !isLoaded) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = fullCssPath;
          if (document.head) document.head.appendChild(link);
          if (coralite.state.stylesLoaded) coralite.state.stylesLoaded.add(componentId);
        }
      }

      const module = await import('${base}assets/js/' + jsPath);
      if (module.default && module.default.componentId) {
        const id = module.default.componentId;
        if (!customElements.get(id)) {
          if (module.default.styles && !cssPath) {
            const styleId = 'coralite-style-' + id;
            const isLoaded = coralite.state.stylesLoaded && coralite.state.stylesLoaded.has(id);

            if (!document.getElementById(styleId) && !isLoaded) {
              const style = document.createElement('style');
              style.id = styleId;
              const cssContent = module.default.styles;
              const isAtRule = /^\\s*@(scope|layer|media|supports|keyframes|font-face|container)\\b/i.test(cssContent);
              style.textContent = isAtRule ? cssContent : id + ' {\\n' + cssContent + '\\n}';
              if (document.head) document.head.appendChild(style);
              if (coralite.state.stylesLoaded) coralite.state.stylesLoaded.add(id);
            }
          }
          customElements.define(id, createCoraliteClass(module.default, getClientContext, globalClientHooks));
          ${!isProd ? 'if (typeof registerDevToolsComponent === \'function\') { registerDevToolsComponent(id); }' : ''}
          if (coralite.lifecycle) coralite.lifecycle._markDefined(id);
        }
      }
    })();
    return loadCache[componentId];
  };

  const upgrade = async (root) => {
    if (!root || (root.nodeType !== 1 && !root.tagName && !root.tag)) return;

    const tagsToLoad = new Set();
    const collectTag = (el) => {
      if (!el) return;
      const rawTag = el.tagName || el.tag || el.nodeName || el.localName;
      if (typeof rawTag === 'string') {
        const tag = rawTag.toLowerCase();
        if (tag.includes('-') && (typeof customElements === 'undefined' || !customElements.get || !customElements.get(tag)) && componentManifest[tag]) {
          tagsToLoad.add(tag);
        }
      }
    };

    collectTag(root);
    if (typeof root.querySelectorAll === 'function') {
      const descendants = root.querySelectorAll('*');
      for (let i = 0; i < descendants.length; i++) {
        collectTag(descendants[i]);
      }
    }

    const upgradeElement = (el) => {
      if (typeof customElements !== 'undefined' && typeof customElements.upgrade === 'function') {
        customElements.upgrade(el);
      }
    };

    if (tagsToLoad.size > 0) {
      const uniqueTags = Array.from(tagsToLoad);
      const results = await Promise.allSettled(uniqueTags.map(tag => loadComponent(tag)));

      upgradeElement(root);
      if (typeof root.querySelectorAll === 'function') {
        const all = root.querySelectorAll('*');
        for (let i = 0; i < all.length; i++) {
          const el = all[i];
          const rawTag = el.tagName || el.tag || el.nodeName || el.localName;
          if (typeof rawTag === 'string' && rawTag.includes('-')) {
            upgradeElement(el);
          }
        }
      }

      const upgradedElements = [];
      const checkElement = (el) => {
        if (el && typeof el.updateComplete !== 'undefined') {
          upgradedElements.push(el);
        }
      };
      checkElement(root);
      if (typeof root.querySelectorAll === 'function') {
        const all = root.querySelectorAll('*');
        for (let i = 0; i < all.length; i++) {
          checkElement(all[i]);
        }
      }
      if (upgradedElements.length > 0) {
        await Promise.all(upgradedElements.map(el => Promise.resolve(el.updateComplete)));
      }

      const errors = results.filter(r => r.status === 'rejected').map(r => r.reason);
      if (errors.length > 0) {
        throw errors[0];
      }
    } else {
      upgradeElement(root);
      if (typeof root.querySelectorAll === 'function') {
        const all = root.querySelectorAll('*');
        for (let i = 0; i < all.length; i++) {
          const el = all[i];
          const rawTag = el.tagName || el.tag || el.nodeName || el.localName;
          if (typeof rawTag === 'string' && rawTag.includes('-')) {
            upgradeElement(el);
          }
        }
      }
    }
  };

  coralite.dom.loadComponent = loadComponent;
  coralite.dom.upgrade = upgrade;
  coralite.dom.createElement = (tag, options) => {
    const el = document.createElement(tag, options);
    if (componentManifest[tag]) {
      upgrade(el);
    }
    return el;
  };
  coralite.dom.processHTML = (html, instanceId) => {
    if (typeof html !== 'string') return html;
    const processed = typeof formatCoraliteHTML === 'function'
      ? formatCoraliteHTML(html, instanceId, ${shouldStripTestId})
      : html;
    const matches = processed.matchAll(/<([a-zA-Z0-9-]+)/g);
    for (const match of matches) {
      const tag = match[1].toLowerCase();
      if (componentManifest[tag]) {
        loadComponent(tag);
      }
    }
    return processed;
  };

  if (typeof getClientContext === 'function') {
    coralite.plugins.getClientContext = getClientContext;
  }

${!isProd ? `
  if (typeof setupDevTools === 'function') {
    setupDevTools();
  }
  if (typeof registerDevToolsComponent === 'function') {
    declarativeTags.forEach(tag => registerDevToolsComponent(tag));
  }

  const resolveInstanceId = (node) => {
    if (!node) return undefined;
    if (node._instanceId !== undefined) return node._instanceId;
    if (typeof node.getAttribute === 'function') {
      const owner = node.getAttribute('data-coralite-owner');
      if (owner) return owner;
    }
    if (typeof node.closest === 'function') {
      const ownerEl = node.closest('[data-coralite-owner]');
      if (ownerEl) return ownerEl.getAttribute('data-coralite-owner');
      const cidEl = node.closest('[data-cid]');
      if (cidEl) return cidEl.getAttribute('data-cid');
    }
    if (node.host) {
      return resolveInstanceId(node.host);
    }
    return undefined;
  };

  const getCustomElementTags = (html) => {
    if (typeof html !== 'string') return [];
    const tags = new Set();
    const matches = html.matchAll(/<([a-zA-Z0-9-]+)/g);
    for (const match of matches) {
      const tag = match[1].toLowerCase();
      if (componentManifest[tag]) {
        tags.add(tag);
      }
    }
    return Array.from(tags);
  };

  const upgradeMatchingElements = (container, tags) => {
    if (!container || !tags || tags.length === 0) return;
    upgrade(container);
  };

  const nativeInnerHTMLDesc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  const nativeOuterHTMLDesc = Object.getOwnPropertyDescriptor(Element.prototype, 'outerHTML');
  const nativeInsertAdjacentHTML = Element.prototype.insertAdjacentHTML;
  const shadowRootInnerHTMLDesc = typeof ShadowRoot !== 'undefined'
    ? Object.getOwnPropertyDescriptor(ShadowRoot.prototype, 'innerHTML')
    : null;
  const originalCreateElement = document.createElement;

  document.createElement = function (tag, options) {
    const tagName = (typeof tag === 'string') ? tag.toLowerCase() : tag;
    const element = originalCreateElement.call(document, tag, options);
    if (componentManifest[tagName]) {
      upgrade(element);
    }
    return element;
  };

  if (nativeInnerHTMLDesc && nativeInnerHTMLDesc.set) {
    Object.defineProperty(Element.prototype, 'innerHTML', {
      configurable: nativeInnerHTMLDesc.configurable,
      enumerable: nativeInnerHTMLDesc.enumerable,
      get () {
        return nativeInnerHTMLDesc.get.call(this);
      },
      set (html) {
        if (typeof html !== 'string' || !html.includes('<')) {
          return nativeInnerHTMLDesc.set.call(this, html);
        }
        const instanceId = resolveInstanceId(this);
        const processedHtml = coralite.dom.processHTML ? coralite.dom.processHTML(html, instanceId) : html;
        nativeInnerHTMLDesc.set.call(this, processedHtml);
        const tags = getCustomElementTags(html);
        upgradeMatchingElements(this, tags);
      }
    });
  }

  if (shadowRootInnerHTMLDesc && shadowRootInnerHTMLDesc.set) {
    Object.defineProperty(ShadowRoot.prototype, 'innerHTML', {
      configurable: shadowRootInnerHTMLDesc.configurable,
      enumerable: shadowRootInnerHTMLDesc.enumerable,
      get () {
        return shadowRootInnerHTMLDesc.get.call(this);
      },
      set (html) {
        if (typeof html !== 'string' || !html.includes('<')) {
          return shadowRootInnerHTMLDesc.set.call(this, html);
        }
        const instanceId = resolveInstanceId(this);
        const processedHtml = coralite.dom.processHTML ? coralite.dom.processHTML(html, instanceId) : html;
        shadowRootInnerHTMLDesc.set.call(this, processedHtml);
        const tags = getCustomElementTags(html);
        upgradeMatchingElements(this, tags);
      }
    });
  }

  if (nativeOuterHTMLDesc && nativeOuterHTMLDesc.set) {
    Object.defineProperty(Element.prototype, 'outerHTML', {
      configurable: nativeOuterHTMLDesc.configurable,
      enumerable: nativeOuterHTMLDesc.enumerable,
      get () {
        return nativeOuterHTMLDesc.get.call(this);
      },
      set (html) {
        if (typeof html !== 'string' || !html.includes('<')) {
          return nativeOuterHTMLDesc.set.call(this, html);
        }
        const parent = this.parentElement || this.parentNode || (typeof this.getRootNode === 'function' ? this.getRootNode() : null);
        const instanceId = resolveInstanceId(this);
        const processedHtml = coralite.dom.processHTML ? coralite.dom.processHTML(html, instanceId) : html;
        nativeOuterHTMLDesc.set.call(this, processedHtml);
        const tags = getCustomElementTags(html);
        if (parent) {
          upgradeMatchingElements(parent, tags);
        }
      }
    });
  }

  if (typeof nativeInsertAdjacentHTML === 'function') {
    Element.prototype.insertAdjacentHTML = function (position, html) {
      if (typeof html !== 'string' || !html.includes('<')) {
        return nativeInsertAdjacentHTML.call(this, position, html);
      }
      const pos = (typeof position === 'string') ? position.toLowerCase() : position;
      const instanceId = resolveInstanceId(this);
      const processedHtml = coralite.dom.processHTML ? coralite.dom.processHTML(html, instanceId) : html;
      nativeInsertAdjacentHTML.call(this, position, processedHtml);
      const tags = getCustomElementTags(html);
      const container = (pos === 'afterbegin' || pos === 'beforeend')
        ? this
        : (this.parentElement || this.parentNode || (typeof this.getRootNode === 'function' ? this.getRootNode() : null));
      if (container) {
        upgradeMatchingElements(container, tags);
      }
    };
  }
` : ''}

  if (typeof initPlugins === 'function') {
    await initPlugins();
  }
  if (typeof setupPageRuntime === 'function' && coralite.config.page) {
    await setupPageRuntime(coralite.config.page, getClientContext);
  }

  const initialElements = Array.from(document.querySelectorAll('[data-cid]'))
    .filter(el => {
      const tagName = el.tagName.toLowerCase();
      const isDeclarative = declarativeTags.includes(tagName);
      const isInitial = el.hasAttribute('data-coralite-initial');
      ${mode === 'testing' ? `
      if (isDeclarative && isInitial) {
        const cid = el.getAttribute('data-cid');
        const store = coralite.state.hydration || {};
        if (cid && !store[cid]) {
          const error = new Error('Coralite Hydration Mismatch: Component with data-cid "' + cid + '" (' + tagName + ') has no matching server hydration data.');
          console.error(error);
          if (coralite.devtools && typeof coralite.devtools.showError === 'function') {
            coralite.devtools.showError(error, 'Coralite Hydration Mismatch');
          }
          throw error;
        }
      }
      ` : ''}
      return isDeclarative && isInitial;
    });
  if (coralite.lifecycle) {
    coralite.lifecycle._start(initialElements.length, declarativeTags.length);
  }

  const loadPromises = declarativeTags.map(tagName => loadComponent(tagName));
  await Promise.all(loadPromises);
  document.documentElement.setAttribute('data-coralite-ready', 'true');
})();
`.trim()
}
