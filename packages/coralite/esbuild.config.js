import esbuild from 'esbuild'

/** @type {import('esbuild').BuildOptions} */
export const buildOptions = {
  entryPoints: [
    // Core runtime
    {
      in: './lib/index.js',
      out: 'lib/index'
    },
    {
      in: './lib/client/element.js',
      out: 'lib/coralite-element'
    },
    {
      in: './lib/client/element.js',
      out: 'lib/client/element'
    },
    {
      in: './lib/client/element.js',
      out: 'client/element'
    },
    {
      in: './lib/server/plugin/define.js',
      out: 'lib/plugin'
    },
    {
      in: './lib/server/interactive.js',
      out: 'lib/interactive'
    },

    // Validators & AST Fixers
    {
      in: './lib/server/component/validator.js',
      out: 'lib/component-validator'
    },
    {
      in: './lib/server/component/fixer.js',
      out: 'lib/component-fixer'
    },
    {
      in: './lib/server/plugin/validator.js',
      out: 'lib/plugin-validator'
    },
    {
      in: './lib/server/plugin/fixer.js',
      out: 'lib/plugin-fixer'
    },
    {
      in: './lib/server/page/validator.js',
      out: 'lib/page-validator'
    },

    // Shared & Client Utilities
    {
      in: './lib/shared/core.js',
      out: 'lib/utils/core'
    },
    {
      in: './lib/shared/attributes.js',
      out: 'lib/utils/attributes'
    },
    {
      in: './lib/shared/diagnostics.js',
      out: 'lib/utils/diagnostics'
    },
    {
      in: './lib/shared/index.js',
      out: 'lib/shared/index'
    },
    {
      in: './lib/shared/core.js',
      out: 'lib/shared/core'
    },
    {
      in: './lib/shared/attributes.js',
      out: 'lib/shared/attributes'
    },
    {
      in: './lib/shared/diagnostics.js',
      out: 'lib/shared/diagnostics'
    },
    {
      in: './lib/utils/index.js',
      out: 'lib/utils/index'
    },
    {
      in: './lib/utils/server/index.js',
      out: 'lib/utils/server/index'
    },
    {
      in: './lib/utils/client/index.js',
      out: 'lib/utils/client/index'
    },
    {
      in: './lib/client/utils/dom.js',
      out: 'lib/utils/client/dom'
    },
    {
      in: './lib/client/utils/inject.js',
      out: 'lib/utils/client/inject'
    },
    {
      in: './lib/client/utils/devtools.js',
      out: 'lib/utils/client/devtools'
    },
    {
      in: './lib/client/utils/dom.js',
      out: 'lib/client/utils/dom'
    },
    {
      in: './lib/client/utils/inject.js',
      out: 'lib/client/utils/inject'
    },
    {
      in: './lib/client/utils/devtools.js',
      out: 'lib/client/utils/devtools'
    },
    {
      in: './lib/client/utils/index.js',
      out: 'lib/client/utils/index'
    },

    // Root-relative aliases for runtime import.meta.resolve
    {
      in: './lib/client/utils/inject.js',
      out: 'client/utils/inject'
    },
    {
      in: './lib/client/utils/devtools.js',
      out: 'client/utils/devtools'
    },
    {
      in: './lib/shared/index.js',
      out: 'shared/index'
    }
  ],
  bundle: true,
  target: 'esnext',
  format: 'esm',
  outdir: 'dist',
  platform: 'node',
  sourcemap: true,
  packages: 'external',
  alias: {
    '#lib': './lib/index.js',
    '#plugins': './plugins/index.js'
  },
  logOverride: {
    'unsupported-dynamic-import': 'silent'
  },
  define: {
    'import.meta.env.MODE': 'import.meta.env.MODE',
    'import.meta.env': 'import.meta.env'
  }
}

// Execute build when run directly
if (process.argv[1] && process.argv[1].endsWith('esbuild.config.js')) {
  await esbuild.build(buildOptions)
}
