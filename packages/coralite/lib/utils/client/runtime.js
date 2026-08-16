/**
 * @import { InstanceContext, CoraliteConfig } from '../../../types/index.js'
 */

/**
 * Generates the client-side runtime script for Coralite pages.
 *
 * @param {Object} options - The options used to configure the client-side runtime.
 * @param {string} options.base - The base URL for assets.
 * @param {string} options.sharedChunkPath - The filename of the shared chunk.
 * @param {string[]} [options.declarativeTags=[]] - The declarative tags used.
 * @param {string} [options.hydrationData='{}'] - Serialized hydration data.
 * @param {string} [options.mode='production'] - Build mode.
 * @param {string} [options.instanceCounters='{}'] - Serialized instance counters map.
 * @returns {string} The generated JavaScript runtime.
 */
export function generateClientRuntime ({
  base,
  sharedChunkPath,
  declarativeTags = [],
  hydrationData = '{}',
  mode = 'production',
  instanceCounters = '{}'
}) {
  return `
(async () => {
  const [
    { getClientContext, createCoraliteClass, globalClientHooks, setupDevTools, registerDevToolsComponent },
    { default: componentManifest }
  ] = await Promise.all([
    import('${base}assets/js/${sharedChunkPath}'),
    import('${base}assets/js/manifest.js')
  ]);

  window.__coralite_instanceCounters = window.__coralite_instanceCounters || ${instanceCounters};
  const hydrationData = ${hydrationData};
  const declarativeTags = ${JSON.stringify(declarativeTags)};

  if (typeof setupDevTools === 'function') {
    setupDevTools();
  }
  if (typeof registerDevToolsComponent === 'function') {
    declarativeTags.forEach(tag => registerDevToolsComponent(tag));
  }

  const initialElements = Array.from(document.querySelectorAll('[data-cid]'))
    .filter(el => {
      const tagName = el.tagName.toLowerCase();
      const isDeclarative = declarativeTags.includes(tagName);
      const isInitial = el.hasAttribute('data-coralite-initial');

      if ('${mode}' === 'testing' && isInitial) {
        const cid = el.getAttribute('data-cid');
        if (cid && !hydrationData[cid]) {
          const error = new Error('Coralite Hydration Mismatch: Component with data-cid "' + cid + '" (' + tagName + ') has no matching server hydration data.');
          if (typeof window['showCoraliteError'] === 'function') {
            window['showCoraliteError'](error);
          } else {
            console.error(error);
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.backgroundColor = 'rgba(255,0,0,0.9)';
            overlay.style.color = 'white';
            overlay.style.padding = '20px';
            overlay.style.zIndex = '10000';
            overlay.style.fontFamily = 'monospace';
            overlay.style.whiteSpace = 'pre-wrap';
            overlay.style.overflow = 'auto';

            const heading = document.createElement('h1');
            heading.textContent = 'Coralite Hydration Mismatch';
            const desc = document.createElement('p');
            desc.textContent = error.message;

            overlay.appendChild(heading);
            overlay.appendChild(desc);
            document.body.appendChild(overlay);
          }
          throw error;
        }
      }

      return isDeclarative && isInitial;
    });
  if (window.__coralite__ && window.__coralite__.lifecycle) {
    window.__coralite__.lifecycle._start(initialElements.length, declarativeTags.length);
  }
  globalThis.executableScripts = [];
  globalThis.globalAbortController = new AbortController();

  const loadCache = {};

  const loadComponent = (componentId) => {
    const entry = componentManifest[componentId];
    if (!entry) return Promise.resolve();
    if (loadCache[componentId]) return loadCache[componentId];

    loadCache[componentId] = (async () => {
      const isDev = typeof entry === 'string' && entry.includes('-runtime');
      const jsPath = typeof entry === 'string' ? entry : entry.js;
      const cssPath = typeof entry === 'object' ? entry.css : null;

      if (cssPath) {
        const fullCssPath = '${base}assets/css/' + cssPath;
        const inlineStyles = document.getElementById('coralite-inline-styles');
        const hasStyleInInline = inlineStyles && inlineStyles.textContent.includes('[data-style-selector="' + componentId + '"]');

        if (!document.querySelector('link[href="' + fullCssPath + '"]') && !hasStyleInInline) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = fullCssPath;
          document.head.appendChild(link);
        }
      }

      const module = await import('${base}assets/js/' + jsPath);
      if (module.default && module.default.componentId) {
        const id = module.default.componentId;
        if (!customElements.get(id)) {
          if (module.default.styles && !cssPath) {
            const styleId = 'coralite-style-' + id;
            const inlineStyles = document.getElementById('coralite-inline-styles');
            const hasStyleInInline = inlineStyles && inlineStyles.textContent.includes('[data-style-selector="' + id + '"]');

            if (!document.getElementById(styleId) && !hasStyleInInline) {
              const style = document.createElement('style');
              style.id = styleId;
              style.textContent = '[data-style-selector="' + id + '"] {\\n' + module.default.styles + '\\n}';
              document.head.appendChild(style);
            }
          }
          customElements.define(id, createCoraliteClass(module.default, getClientContext, globalClientHooks, hydrationData));
          if (typeof registerDevToolsComponent === 'function') {
            registerDevToolsComponent(id);
          }
          if (window.__coralite__ && window.__coralite__.lifecycle) window.__coralite__.lifecycle._markDefined(id);
        }
      }
    })();
    return loadCache[componentId];
  };

  const loadPromises = declarativeTags.map(tagName => loadComponent(tagName));
  await Promise.all(loadPromises);
  document.documentElement.setAttribute('data-coralite-ready', 'true');

  window.createCoraliteElement = (tag, options) => {
    const el = document.createElement(tag, options);
    if (componentManifest[tag]) {
      loadComponent(tag).then(() => {
        if (el.constructor === HTMLElement || el.constructor === HTMLUnknownElement) {
          if (typeof customElements.upgrade === 'function') {
            customElements.upgrade(el);
          }
        }
      });
    }
    return el;
  };

  const originalCreateElement = document.createElement;
  document.createElement = function (tag, options) {
    const tagName = (typeof tag === 'string') ? tag.toLowerCase() : tag;
    const element = originalCreateElement.call(document, tag, options);
    if (componentManifest[tagName]) {
      loadComponent(tagName).then(() => {
        if (element.constructor === HTMLElement || element.constructor === HTMLUnknownElement) {
          if (typeof customElements.upgrade === 'function') {
            customElements.upgrade(element);
          }
        }
      });
    }
    return element;
  };

  // Rewrites HTML strings for imperative custom element insertion and template stamping.
  // Mirrored by fallback in inject.js:processHTML when window.processHTML is unavailable.
  // Note: Tag matching uses /<([a-zA-Z0-9-]+)([^>]*)>/g assuming well-formed attributes without raw '>' in attribute values.
  window.processHTML = (html, instanceId) => {
    if (typeof html !== 'string') return html;

    const mode = '${mode}';
    const isDevOrTest = mode === 'development' || mode === 'testing';
    const isProduction = mode === 'production';

    if (isDevOrTest || isProduction) {
      html = html.replace(/<([a-zA-Z0-9-]+)([^>]*)>/g, (match, tagName, attrs) => {
        let newAttrs = attrs;

        // Strip deprecated 'test' attribute
        newAttrs = newAttrs.replace(/\\s+test\\s*=\\s*(['"]).*?\\1/g, '');

        // Handle data-testid
        const testIdRegex = /\\s+data-testid\\s*=\\s*(['"])(.*?)\\1/g;
        if (isProduction) {
          newAttrs = newAttrs.replace(testIdRegex, '');
        } else if (isDevOrTest) {
          const prefix = instanceId ? instanceId + '__' : '';
          if (prefix) {
            newAttrs = newAttrs.replace(testIdRegex, (attrMatch, quote, testValue) => {
              if (testValue.startsWith(prefix)) return attrMatch;
              return ' data-testid="' + prefix + testValue + '"';
            });
          }
        }

        // Handle ref & data-coralite-owner
        if (instanceId) {
          const prefix = instanceId + '__';
          const refRegex = /\\s+ref\\s*=\\s*(['"])(.*?)\\1/g;
          newAttrs = newAttrs.replace(refRegex, (attrMatch, quote, refValue) => {
            const prefixedRef = refValue.startsWith(prefix) ? refValue : prefix + refValue;
            let ownerAttr = '';
            if (!newAttrs.includes('data-coralite-owner=')) {
              ownerAttr = ' data-coralite-owner="' + instanceId + '"';
            }
            return ' ref="' + prefixedRef + '"' + ownerAttr;
          });
        }

        return '<' + tagName + newAttrs + '>';
      });
    }

    const matches = html.matchAll(/<([a-zA-Z0-9-]+)/g);
    for (const match of matches) {
      const tag = match[1].toLowerCase();
      if (componentManifest[tag]) {
        loadComponent(tag);
      }
    }
    return html;
  };
})();
`.trim()
}
