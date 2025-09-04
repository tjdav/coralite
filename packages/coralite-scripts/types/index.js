/**
 * @import {CoraliteConfig} from 'coralite/types'
 * @import {Options} from 'sass'
 */

/**
 * @typedef {Object} CoraliteScriptBaseConfig
 * @property {string} public - The path to the directory containing static assets.
 * @property {Object} [server] - Server configuration options.
 * @property {number} server.port - The port number on which the development server will run.
 * @property {Object} [sass] - Sass compilation configuration.
 * @property {string} sass.input - The path to the input Sass file or directory.
 * @property {Options<'async'>} [sass.options] - Additional options passed to the Sass compiler.
 */

/**
 * @typedef {CoraliteScriptBaseConfig & CoraliteConfig} CoraliteScriptConfig
 */
