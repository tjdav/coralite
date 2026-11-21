import { definePlugin } from 'coralite'
import { createCoraliteElement, findHeadAndBody, relinkChildren } from 'coralite/utils/server'

/**
 * @typedef {Object} GoatCounterOptions
 * @property {string} site - GoatCounter origin, e.g. `https://stats.example.com`.
 * @property {string} [scriptSrc] - Tracker script URL. Defaults to `<site>/count.js`.
 * @property {boolean} [trackLocalhost=false] - Send pageviews from localhost.
 * @property {boolean} [respectDnt=true] - Skip tracking when Do Not Track is enabled.
 * @property {boolean} [respectGpc=true] - Skip tracking when Global Privacy Control is enabled.
 * @property {string[]} [exclude=[]] - Path prefixes or exact paths to exclude. A trailing `*` matches a prefix.
 */

/**
 * Resolves the tracker configuration derived from plugin options.
 *
 * @param {GoatCounterOptions} options - Analytics configuration.
 * @returns {{scriptSrc: string, endpoint: string, trackLocalhost: boolean, respectDnt: boolean, respectGpc: boolean, exclude: string[]}} Resolved configuration.
 */
function resolveOptions (options) {
  const site = String(options.site).replace(/\/+$/, '')

  return {
    scriptSrc: options.scriptSrc || `${site}/count.js`,
    endpoint: `${site}/count`,
    trackLocalhost: Boolean(options.trackLocalhost),
    respectDnt: options.respectDnt !== false,
    respectGpc: options.respectGpc !== false,
    exclude: Array.isArray(options.exclude) ? options.exclude : []
  }
}

/**
 * Creates the self-hosted GoatCounter bootstrap.
 *
 * The bootstrap is an external asset so it runs on static pages that do not
 * load the Coralite client runtime, and it loads the tracker itself so the
 * settings object is always defined before `count.js` executes.
 *
 * @param {GoatCounterOptions} options - Analytics configuration.
 * @returns {string} Bootstrap source.
 */
function createBootstrap (options) {
  const config = JSON.stringify(resolveOptions(options))

  return `(function () {
  var config = ${config};
  var nav = window.navigator || {};
  var disabled = false;

  if (config.respectDnt && (nav.doNotTrack === '1' || window.doNotTrack === '1' || nav.msDoNotTrack === '1')) {
    disabled = true;
  }
  if (config.respectGpc && nav.globalPrivacyControl === true) {
    disabled = true;
  }
  if (!config.trackLocalhost && /^(localhost|127\\.0\\.0\\.1|\\[::1\\])(?::\\d+)?$/.test(window.location.hostname)) {
    disabled = true;
  }

  function isExcluded (path) {
    if (!path) {
      return false;
    }
    for (var i = 0; i < config.exclude.length; i++) {
      var rule = config.exclude[i];
      if (typeof rule !== 'string') {
        continue;
      }
      if (rule.endsWith('*')) {
        if (path.indexOf(rule.slice(0, -1)) === 0) {
          return true;
        }
      } else if (path === rule) {
        return true;
      }
    }
    return false;
  }

  var queue = [];
  var api = {
    track: function (name, meta) {
      if (disabled || typeof name !== 'string' || !name) {
        return;
      }
      var vars = { path: name, event: true };
      if (meta && typeof meta.title === 'string') {
        vars.title = meta.title;
      }
      if (!send(vars)) {
        queue.push(vars);
      }
    }
  };

  var namespace = window.__coralite__ || (window.__coralite__ = {});
  namespace.plugins = namespace.plugins || {};
  namespace.plugins.analytics = api;

  if (disabled) {
    return;
  }

  function send (vars) {
    var goatcounter = window.goatcounter;
    if (!goatcounter || typeof goatcounter.count !== 'function') {
      return false;
    }
    goatcounter.count(vars);
    return true;
  }

  function flush () {
    if (!window.goatcounter || typeof window.goatcounter.count !== 'function') {
      return;
    }
    while (queue.length > 0) {
      send(queue.shift());
    }
  }

  function load () {
    if (window.goatcounter && typeof window.goatcounter.count === 'function') {
      flush();
      return;
    }
    window.goatcounter = {
      allow_local: config.trackLocalhost,
      path: function (path) {
        if (isExcluded(path)) {
          return null;
        }
        return path;
      }
    };
    var script = document.createElement('script');
    script.async = true;
    script.src = config.scriptSrc;
    script.setAttribute('data-goatcounter', config.endpoint);
    script.addEventListener('load', flush);
    document.head.appendChild(script);
  }

  window.addEventListener('coralite:navigated', function () {
    queue.push({});
    flush();
  });

  load();
})();`
}

/**
 * Checks whether the bootstrap has already been inserted into a page.
 *
 * @param {object} root - Page root AST.
 * @returns {boolean} Whether the bootstrap script exists.
 */
function hasBootstrap (root) {
  const stack = [root]
  while (stack.length > 0) {
    const node = stack.pop()
    if (!node) {
      continue
    }
    if (node.type === 'tag' && node.name === 'script' && node.attribs?.['data-coralite-analytics'] !== undefined) {
      return true
    }
    if (Array.isArray(node.children)) {
      stack.push(...node.children)
    }
  }
  return false
}

/**
 * Inserts the bootstrap script into the document head.
 *
 * @param {object} component - Rendered page component.
 * @param {string} src - Bootstrap asset URL.
 */
function injectBootstrap (component, src) {
  if (!component?.root || hasBootstrap(component.root)) {
    return
  }

  const { head, body } = findHeadAndBody(component.root)
  const container = head || body || component.root
  const script = createCoraliteElement({
    type: 'tag',
    name: 'script',
    attribs: {
      src,
      defer: '',
      'data-coralite-analytics': ''
    },
    children: []
  })
  script.parent = container
  container.children = container.children || []
  container.children.push(script)
  relinkChildren(container)
}

const bootstrapPaths = new Map()

/**
 * Gets a stable key for a plugin configuration.
 *
 * @param {GoatCounterOptions} config - GoatCounter plugin configuration.
 * @returns {string} Stable configuration key.
 */
function configKey (config) {
  return JSON.stringify(config)
}

/**
 * Website GoatCounter analytics plugin.
 *
 * The website is static, so the tracker is loaded through a generated
 * self-origin bootstrap rather than the Coralite client runtime.
 */
export const goatCounterPlugin = definePlugin({
  name: 'goatcounter-analytics',
  config: {
    site: {
      type: String,
      required: true
    },
    scriptSrc: {
      type: String
    },
    trackLocalhost: {
      type: Boolean,
      default: false
    },
    respectDnt: {
      type: Boolean,
      default: true
    },
    respectGpc: {
      type: Boolean,
      default: true
    },
    exclude: {
      type: Array,
      default: []
    }
  },
  server: {
    async onBeforeBuild ({ app, config }) {
      const source = createBootstrap(config)
      const assetPath = 'assets/js/goatcounter.js'
      const base = (app.options.baseURL || '/').endsWith('/') ? app.options.baseURL : `${app.options.baseURL}/`

      await app.writeFile(assetPath, source)
      bootstrapPaths.set(configKey(config), `${base}${assetPath}`)
    },
    onBeforePageRender ({ component, config }) {
      const bootstrapPath = bootstrapPaths.get(configKey(config))
      if (bootstrapPath) {
        injectBootstrap(component, bootstrapPath)
      }
    }
  },
  client: {
    context: () => () => ({
      analytics: {
        track (name, meta) {
          const coralite = window['__coralite__']
          const api = coralite && coralite.plugins ? coralite.plugins.analytics : null
          if (api) {
            api.track(name, meta)
          }
        }
      }
    })
  }
})

export default goatCounterPlugin
