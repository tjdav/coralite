/**
 * @import {CoraliteConfig} from 'coralite/types'
 * @import {Options} from 'sass'
 */

/**
 * @typedef {Object} CoraliteScriptBaseConfig
 * @property {string} public - The path to the directory containing static assets.
 * @property {Object} [server] - Server configuration options.
 * @property {number} server.port - The port number on which the development server will run.
 * @property {Object} [styles]
 * @property {string[]} [styles.input] - Array of inputs, mixing scss and css
 * @property {Object} [styles.processors]
 * @property {Options<'async'>} [styles.processors.scss] - Native Dart Sass options
 * @property {Object} [styles.processors.postcss]
 * @property {import('postcss').AcceptedPlugin[]} [styles.processors.postcss.plugins] - Native PostCSS plugins
 * @property {'production' | 'development'} [mode='production'] - Set build mode for the coralite instance.
 */

/**
 * @typedef {CoraliteScriptBaseConfig & CoraliteConfig} CoraliteScriptConfig
 */

/**
 * @typedef {Object} CoraliteScriptOptions
 * @property {boolean} [dev] - Start development server with hot-reloading
 * @property {boolean} [build] - Build coralite site for production deployment
 * @property {boolean} [verbose] - Enable verbose logging output
 */

export default {}
