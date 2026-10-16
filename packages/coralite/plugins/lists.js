import { definePlugin } from '../lib/server/plugin/define.js'
import { createStore } from './lists/store.js'
import { bind } from './lists/bind.js'

export const listsPlugin = definePlugin({
  name: 'lists',

  config: {
    overscan: {
      type: Number,
      default: 5
    },
    anchorTo: {
      type: String,
      default: 'start'
    },
    followOnAppend: {
      type: Boolean,
      default: false
    },
    scrollEndThreshold: {
      type: Number,
      default: 80
    },
    reachThreshold: {
      type: Number,
      default: 200
    },
    headerHeight: {
      type: Number,
      default: 40
    }
  },

  client: {
    context: (_pluginContext) => (_instanceContext) => ({
      lists: {
        createStore,
        bind
      }
    })
  }
})

export const lists = listsPlugin

export default listsPlugin
