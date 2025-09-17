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
 * @property {'css' | 'sass' | 'scss'} styles.type - The style processing type to use for styling files.
 * @property {string} styles.input - The path to the main stylesheet file to process.
 * @property {Options<'async'>} [sassOptions] - Additional options passed to the Sass compiler.
 * @property {import('postcss').AcceptedPlugin[]} [cssPlugins] - Postcss plugins.
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
