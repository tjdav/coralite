import { createHash } from 'node:crypto'
import { definePlugin } from 'coralite'
import { createCoraliteElement, findHeadAndBody, relinkChildren } from 'coralite/utils/server'

/**
 * @typedef {Object} SwetrixOptions
 * @property {string} projectId - Swetrix project ID.
 * @property {string} scriptSrc - Self-hosted Swetrix tracker URL.
 * @property {string} apiUrl - Self-hosted Swetrix API URL, e.g. `https://stats.example.com/backend/v1/log`.
 * @property {boolean} [trackLocalhost=false] - Send pageviews from localhost.
 * @property {boolean} [respectDnt=true] - Skip tracking when Do Not Track is enabled.
 * @property {boolean} [respectGpc=true] - Skip tracking when Global Privacy Control is enabled.
 * @property {string[]} [exclude=[]] - Path prefixes or exact paths to exclude. A trailing `*` matches a prefix.
 */

/**
 * Creates the self-hosted Swetrix bootstrap.
 *
 * The bootstrap is an external asset so it runs on static pages that do not
 * load the Coralite client runtime.
 *
 * @param {SwetrixOptions} options - Analytics configuration.
 * @returns {string} Bootstrap source.
 */
function createBootstrap (options) {
  const config = JSON.stringify({
    projectId: options.projectId,
    scriptSrc: options.scriptSrc,
    apiUrl: options.apiUrl,
    trackLocalhost: Boolean(options.trackLocalhost),
    respectDnt: options.respectDnt !== false,
    respectGpc: options.respectGpc !== false,
    exclude: Array.isArray(options.exclude) ? options.exclude : []
  })

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
  var ready = false;
  var api = {
    track: function (name, meta) {
      if (disabled || typeof name !== 'string' || !name) {
        return;
      }
      if (ready && window.swetrix) {
        window.swetrix.track({ ev: name, meta: meta || {} });
        return;
      }
      queue.push({ name: name, meta: meta || {} });
    }
  };

  var namespace = window.__coralite__ || (window.__coralite__ = {});
  namespace.plugins = namespace.plugins || {};
  namespace.plugins.analytics = api;

  if (disabled) {
    return;
  }

  function initialize () {
    if (!window.swetrix) {
      return;
    }

    try {
      window.swetrix.init(config.projectId, {
        apiURL: config.apiUrl,
        devMode: config.trackLocalhost,
        respectDNT: config.respectDnt
      });
      window.swetrix.trackViews({
        search: false,
        hash: false,
        callback: function (payload) {
          if (!payload || isExcluded(payload.pg)) {
            return false;
          }
          return payload;
        }
      });
      ready = true;
      while (queue.length > 0) {
        var item = queue.shift();
        window.swetrix.track({ ev: item.name, meta: item.meta });
      }
    } catch (error) {
      // Analytics must never break the page.
    }
  }

  if (window.swetrix) {
    initialize();
    return;
  }

  var script = document.createElement('script');
  script.src = config.scriptSrc;
  script.defer = true;
  script.addEventListener('load', initialize);
  document.head.appendChild(script);
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
 * @param {SwetrixOptions} config - Swetrix plugin configuration.
 * @returns {string} Stable configuration key.
 */
function configKey (config) {
  return JSON.stringify(config)
}

/**
 * Website self-hosted Swetrix analytics plugin.
 *
 * The website is static, so the tracker is loaded through a generated
 * self-origin bootstrap rather than the Coralite client runtime.
 */
export const swetrixPlugin = definePlugin({
  name: 'swetrix-analytics',
  config: {
    projectId: {
      type: String,
      required: true
    },
    scriptSrc: {
      type: String,
      required: true
    },
    apiUrl: {
      type: String,
      required: true
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
      const filename = `swetrix-${createHash('sha256').update(source).digest('hex').slice(0, 8)}.js`
      const assetPath = `assets/js/${filename}`
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

export default swetrixPlugin

