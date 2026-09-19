import esbuild from 'esbuild'

/** @type {import('esbuild').BuildOptions} */
export const buildOptions = {
  entryPoints: [
    // Core runtime & elements
    './lib/index.js',
    './lib/coralite-element.js',
    './lib/plugin.js',
    './lib/interactive.js',

    // Validators & AST Fixers
    './lib/component-validator.js',
    './lib/component-fixer.js',
    './lib/plugin-validator.js',
    './lib/plugin-fixer.js',
    './lib/page-validator.js',

    // Utilities & Shared Helpers
    './lib/utils/core.js',
    './lib/utils/attributes.js',
    './lib/utils/diagnostics.js',
    './lib/utils/index.js',
    './lib/utils/server/index.js',
    './lib/utils/client/index.js',
    './lib/utils/client/dom.js',
    './lib/utils/client/inject.js',
    './lib/utils/client/devtools.js'
  ],
  bundle: true,
  target: 'esnext',
  format: 'esm',
  outdir: 'dist/lib',
  outbase: './lib',
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
