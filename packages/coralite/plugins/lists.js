import { fileURLToPath } from 'node:url'
import { definePlugin } from '../lib/server/plugin/define.js'

export const listsPlugin = definePlugin({
  name: 'lists',
  filePath: fileURLToPath(import.meta.url),

  client: {
    // Phase 1: Runs once. Creates the singleton API.
    context: async () => {
      // Inline all helpers and logic here so everything is self-contained in client.context

      /**
       * @param {string} message Error message
       * @param {Object} [options] Error options
       */
      function createCoraliteError (message, options = {}) {
        const err = new Error(message)
        err.name = 'CoraliteError'
        Object.assign(err, {
          code: options.code,
          isCoraliteError: true
        })
        return err
      }

      function createSignal (initialValue) {
        let value = initialValue
        const subscribers = new Set()
        const signal = {
          get value () {
            return value
          },
          set value (nextValue) {
            if (Object.is(value, nextValue)) {
              return
            }
            value = nextValue
            const subs = Array.from(subscribers)
            for (const sub of subs) {
              sub(nextValue)
            }
          }
        }
        return signal
      }

      function createStore ({ key = (item) => item?.id, initial = [] } = {}) {
        const getKey = typeof key === 'function' ? key : (item) => item?.[key]

        if (typeof getKey !== 'function') {
          throw createCoraliteError('lists.createStore: key option must be a function or string property name')
        }

        const itemsMap = new Map()
        const itemsArray = []
        const subscribers = new Set()
        const versionSignal = createSignal(0)

        let pendingChanges = []
        let scheduled = false
        let batchDepth = 0

        function flushChanges () {
          scheduled = false
          if (pendingChanges.length === 0) {
            return
          }

          const changes = pendingChanges
          pendingChanges = []

          versionSignal.value++
          const subs = Array.from(subscribers)
          for (const sub of subs) {
            try {
              sub(changes)
            } catch (err) {
              console.error('Error in lists store subscriber:', err)
            }
          }
        }

        function notifySubscribers (descriptor) {
          pendingChanges.push(descriptor)
          if (batchDepth > 0) {
            return
          }

          if (!scheduled) {
            scheduled = true
            queueMicrotask(flushChanges)
          }
        }

        function addItemInternal (item, position = 'end') {
          const k = getKey(item)
          // eslint-disable-next-line eqeqeq
          if (k == null) {
            throw createCoraliteError('lists.createStore: Item is missing a valid key')
          }

          if (itemsMap.has(k)) {
            const idx = itemsArray.findIndex((it) => getKey(it) === k)
            if (idx !== -1) {
              itemsArray.splice(idx, 1)
            }
          }

          itemsMap.set(k, item)
          if (position === 'start') {
            itemsArray.unshift(item)
          } else {
            itemsArray.push(item)
          }
        }

        if (Array.isArray(initial)) {
          for (const item of initial) {
            addItemInternal(item, 'end')
          }
        }

        const store = {
          getKey,

          batch (fn) {
            batchDepth++
            try {
              fn()
            } finally {
              batchDepth--
              if (batchDepth === 0 && pendingChanges.length > 0 && !scheduled) {
                scheduled = true
                queueMicrotask(flushChanges)
              }
            }
          },

          append (item) {
            addItemInternal(item, 'end')
            notifySubscribers({
              type: 'append',
              items: [item]
            })
            return item
          },

          prepend (item) {
            addItemInternal(item, 'start')
            notifySubscribers({
              type: 'prepend',
              items: [item]
            })
            return item
          },

          appendMany (items = []) {
            if (!Array.isArray(items) || items.length === 0) {
              return
            }
            for (const item of items) {
              addItemInternal(item, 'end')
            }
            notifySubscribers({
              type: 'append',
              items: [...items]
            })
          },

          prependMany (items = []) {
            if (!Array.isArray(items) || items.length === 0) {
              return
            }
            for (let i = items.length - 1; i >= 0; i--) {
              addItemInternal(items[i], 'start')
            }
            notifySubscribers({
              type: 'prepend',
              items: [...items]
            })
          },

          update (id, patch) {
            if (!itemsMap.has(id)) {
              return undefined
            }

            const oldItem = itemsMap.get(id)
            let newItem
            if (typeof patch === 'function') {
              newItem = patch(oldItem)
            } else if (typeof patch === 'object' && patch !== null) {
              newItem = {
                ...oldItem,
                ...patch
              }
            } else {
              newItem = patch
            }

            itemsMap.set(id, newItem)
            const idx = itemsArray.findIndex((it) => getKey(it) === id)
            if (idx !== -1) {
              itemsArray[idx] = newItem
            }

            notifySubscribers({
              type: 'update',
              id,
              patch
            })
            return newItem
          },

          remove (id) {
            if (!itemsMap.has(id)) {
              return false
            }

            itemsMap.delete(id)
            const idx = itemsArray.findIndex((it) => getKey(it) === id)
            if (idx !== -1) {
              itemsArray.splice(idx, 1)
            }

            notifySubscribers({
              type: 'remove',
              id
            })
            return true
          },

          set (items = []) {
            pendingChanges = []
            itemsMap.clear()
            itemsArray.length = 0
            if (Array.isArray(items)) {
              for (const item of items) {
                addItemInternal(item, 'end')
              }
            }
            notifySubscribers({
              type: 'set',
              items: [...itemsArray]
            })
          },

          swap (idA, idB) {
            if (idA === idB) {
              return false
            }
            if (!itemsMap.has(idA) || !itemsMap.has(idB)) {
              return false
            }
            const idxA = itemsArray.findIndex((it) => getKey(it) === idA)
            const idxB = itemsArray.findIndex((it) => getKey(it) === idB)
            if (idxA === -1 || idxB === -1) {
              return false
            }

            const temp = itemsArray[idxA]
            itemsArray[idxA] = itemsArray[idxB]
            itemsArray[idxB] = temp

            notifySubscribers({
              type: 'swap',
              idA,
              idB
            })
            return true
          },

          get (id) {
            void versionSignal.value
            return itemsMap.get(id)
          },

          all () {
            void versionSignal.value
            return [...itemsArray]
          },

          get size () {
            void versionSignal.value
            return itemsArray.length
          },

          clear () {
            if (itemsArray.length === 0) {
              return
            }
            itemsMap.clear()
            itemsArray.length = 0
            notifySubscribers({
              type: 'clear'
            })
          },

          subscribe (callback) {
            if (typeof callback !== 'function') {
              throw createCoraliteError('lists.createStore subscribe: callback must be a function')
            }
            subscribers.add(callback)
            return () => {
              subscribers.delete(callback)
            }
          }
        }

        return store
      }

      function getItemKey (item, keyFn, index) {
        if (item && item.__header && item.key) {
          return item.key
        }
        if (keyFn) {
          return keyFn(item)
        }
        if (item && item.key) {
          return item.key
        }
        return String(index)
      }

      function computeLaneCount (containerWidth, laneWidth, minLaneWidth, maxLanes, gap = 0) {
        if (!containerWidth || containerWidth <= 0) {
          return 1
        }
        const effectiveMinWidth = minLaneWidth || laneWidth || 200
        let computed = Math.floor((containerWidth + gap) / (effectiveMinWidth + gap))
        computed = Math.max(1, computed)
        if (typeof maxLanes === 'number' && maxLanes > 0) {
          computed = Math.min(computed, maxLanes)
        }
        return computed
      }

      function layoutLinear (items, heights, containerWidth, gap = 0, keyFn) {
        const positions = new Array(items.length)
        let currentY = 0

        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          const k = getItemKey(item, keyFn, i)
          const h = heights[i] || 64

          positions[i] = {
            key: k,
            x: 0,
            y: currentY,
            width: containerWidth,
            height: h,
            lane: 0
          }

          currentY += h + gap
        }

        return positions
      }

      function layoutGrid (items, heights, lanes, containerWidth, gap = 0, keyFn) {
        const positions = new Array(items.length)
        const laneHeights = new Array(lanes).fill(0)
        const actualLaneWidth = (containerWidth - (gap * (lanes - 1))) / lanes

        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          const k = getItemKey(item, keyFn, i)
          const h = heights[i] || 64

          if (item && item.__header) {
            let maxCurrentY = 0
            for (let l = 0; l < lanes; l++) {
              if (laneHeights[l] > maxCurrentY) {
                maxCurrentY = laneHeights[l]
              }
            }
            positions[i] = {
              key: k,
              x: 0,
              y: maxCurrentY,
              width: containerWidth,
              height: h,
              lane: 0
            }
            const nextY = maxCurrentY + h + gap
            for (let l = 0; l < lanes; l++) {
              laneHeights[l] = nextY
            }
          } else {
            const targetLane = i % lanes
            const currentY = laneHeights[targetLane]
            const currentX = targetLane * (actualLaneWidth + gap)

            positions[i] = {
              key: k,
              x: currentX,
              y: currentY,
              width: actualLaneWidth,
              height: h,
              lane: targetLane
            }

            laneHeights[targetLane] = currentY + h + gap
          }
        }

        return positions
      }

      function layoutMasonry (items, heights, lanes, containerWidth, gap = 0, keyFn) {
        const positions = new Array(items.length)
        const laneHeights = new Array(lanes).fill(0)
        const actualLaneWidth = (containerWidth - (gap * (lanes - 1))) / lanes

        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          const k = getItemKey(item, keyFn, i)
          const h = heights[i] || 64

          if (item && item.__header) {
            let maxCurrentY = 0
            for (let l = 0; l < lanes; l++) {
              if (laneHeights[l] > maxCurrentY) {
                maxCurrentY = laneHeights[l]
              }
            }
            positions[i] = {
              key: k,
              x: 0,
              y: maxCurrentY,
              width: containerWidth,
              height: h,
              lane: 0
            }
            const nextY = maxCurrentY + h + gap
            for (let l = 0; l < lanes; l++) {
              laneHeights[l] = nextY
            }
          } else {
            let targetLane = 0
            let minLaneY = laneHeights[0]
            for (let l = 1; l < lanes; l++) {
              if (laneHeights[l] < minLaneY) {
                minLaneY = laneHeights[l]
                targetLane = l
              }
            }

            const currentX = targetLane * (actualLaneWidth + gap)

            positions[i] = {
              key: k,
              x: currentX,
              y: minLaneY,
              width: actualLaneWidth,
              height: h,
              lane: targetLane
            }

            laneHeights[targetLane] = minLaneY + h + gap
          }
        }

        return positions
      }

      function layoutTable (items, heights, _columns = [], containerWidth, gap = 0, keyFn) {
        const positions = new Array(items.length)
        let currentY = 0

        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          const k = getItemKey(item, keyFn, i)
          const h = heights[i] || 48

          positions[i] = {
            key: k,
            x: 0,
            y: currentY,
            width: containerWidth,
            height: h,
            lane: 0
          }

          currentY += h + gap
        }

        return positions
      }

      function computePositions (items, keyFn, measurements, defaultSize = 64, layoutOptions = {}) {
        if (!items || items.length === 0) {
          return []
        }

        const {
          layout = 'linear',
          lanes = 1,
          laneWidth = 280,
          minLaneWidth = 200,
          maxLanes = 6,
          gap = 0,
          columns = [],
          containerWidth = 800
        } = layoutOptions

        const activeLanes = lanes === 'auto'
          ? computeLaneCount(containerWidth, laneWidth, minLaneWidth, maxLanes, gap)
          : Math.max(1, Number(lanes) || 1)

        const actualLaneWidth = (layout === 'grid' || layout === 'masonry')
          ? (containerWidth - (gap * (activeLanes - 1))) / activeLanes
          : laneWidth

        const signature = `${activeLanes}:${Math.round(actualLaneWidth)}:${Math.round(containerWidth)}`
        const headerEstimate = typeof layoutOptions.headerHeight === 'number' ? layoutOptions.headerHeight : 40

        const heights = new Array(items.length)
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          const k = getItemKey(item, keyFn, i)
          let measured
          if (measurements && typeof measurements.get === 'function') {
            measured = measurements.get(k, signature)
            if (typeof measured !== 'number') {
              measured = measurements.get(k)
            }
          }
          const fallbackSize = item && item.__header ? headerEstimate : defaultSize
          heights[i] = typeof measured === 'number' && measured > 0 ? measured : fallbackSize
        }

        switch (layout) {
          case 'grid':
            return layoutGrid(items, heights, activeLanes, containerWidth, gap, keyFn)
          case 'masonry':
            return layoutMasonry(items, heights, activeLanes, containerWidth, gap, keyFn)
          case 'table':
            return layoutTable(items, heights, columns, containerWidth, gap, keyFn)
          case 'linear':
          default:
            return layoutLinear(items, heights, containerWidth, gap, keyFn)
        }
      }

      function computeVisibleRange (positions, virtualScrollTop, viewportHeight, overscan = 0) {
        if (!positions || positions.length === 0) {
          return {
            startIndex: 0,
            endIndex: -1
          }
        }

        const scrollTop = Math.max(0, virtualScrollTop)
        const scrollBottom = scrollTop + Math.max(0, viewportHeight)

        let low = 0
        let high = positions.length - 1
        let startIndex = 0

        while (low <= high) {
          const mid = (low + high) >> 1
          if (positions[mid].y <= scrollTop) {
            startIndex = mid
            low = mid + 1
          } else {
            high = mid - 1
          }
        }

        let endIndex = startIndex
        while (endIndex < positions.length - 1 && positions[endIndex].y < scrollBottom) {
          endIndex++
        }

        startIndex = Math.max(0, startIndex - overscan)
        endIndex = Math.min(positions.length - 1, endIndex + overscan)

        return {
          startIndex,
          endIndex
        }
      }

      function computeScrollTopFromAnchor (anchor, positions, anchorTo = 'start', viewportHeight = 0) {
        if (!anchor || !positions || positions.length === 0) {
          return 0
        }

        const item = positions.find((p) => p.key === anchor.key)
        if (!item) {
          return 0
        }

        if (anchorTo === 'end') {
          return ((item.y + item.height) - viewportHeight) + (anchor.offset || 0)
        }

        return item.y + (anchor.offset || 0)
      }

      function reanchorOnRemove (removedKey, anchor, positions, anchorTo = 'start') {
        if (!anchor || anchor.key !== removedKey) {
          return anchor
        }

        if (!positions || positions.length === 0) {
          return null
        }

        const index = positions.findIndex((p) => p.key === removedKey)
        if (index === -1) {
          return null
        }

        if (anchorTo === 'end') {
          const fallbackItem = positions[index - 1] ?? positions[index + 1] ?? positions[0]
          if (!fallbackItem) {
            return null
          }
          return {
            key: fallbackItem.key,
            offset: 0
          }
        }

        const nextItem = positions[index + 1] ?? positions[0]
        if (!nextItem) {
          return null
        }

        return {
          key: nextItem.key,
          offset: 0
        }
      }

      function createMeasurementCache (_defaultSize = 64) {
        const cache = new Map()
        let observer = null
        const observedElements = new Map()

        function initObserver () {
          if (observer || typeof ResizeObserver === 'undefined') {
            return
          }
          observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
              const el = entry.target
              const info = observedElements.get(el)
              if (!info) {
                continue
              }
              const { key, getSignature, onResize } = info
              const height = entry.contentRect ? entry.contentRect.height : el.clientHeight
              if (height > 0) {
                const sig = typeof getSignature === 'function' ? getSignature() : undefined
                let itemMap = cache.get(key)
                if (!itemMap) {
                  itemMap = new Map()
                  cache.set(key, itemMap)
                }
                const oldHeight = sig ? itemMap.get(sig) : itemMap.get('default')
                if (sig) {
                  itemMap.set(sig, height)
                }
                itemMap.set('default', height)

                if (typeof onResize === 'function' && oldHeight !== undefined && Math.abs(oldHeight - height) > 1) {
                  onResize(key, height)
                }
              }
            }
          })
        }

        return {
          get (key, signature) {
            const itemMap = cache.get(key)
            if (!itemMap) {
              return undefined
            }
            if (signature && itemMap.has(signature)) {
              return itemMap.get(signature)
            }
            return itemMap.get('default')
          },

          set (key, height, signature) {
            let itemMap = cache.get(key)
            if (!itemMap) {
              itemMap = new Map()
              cache.set(key, itemMap)
            }
            if (signature) {
              itemMap.set(signature, height)
            }
            itemMap.set('default', height)
          },

          observe (element, key, getSignature, onResize) {
            if (!element || typeof ResizeObserver === 'undefined') {
              return
            }
            initObserver()
            observedElements.set(element, {
              key,
              getSignature,
              onResize
            })
            if (observer) {
              observer.observe(element)
            }
          },

          unobserve (element) {
            if (!element) {
              return
            }
            observedElements.delete(element)
            if (observer) {
              observer.unobserve(element)
            }
          },

          clear () {
            cache.clear()
            if (observer) {
              observer.disconnect()
            }
            observedElements.clear()
          },

          disconnect () {
            this.clear()
          }
        }
      }

      function setupInfiniteScroll ({ container, onReachStart, onReachEnd, reachThreshold = 200 }) {
        if (
          typeof document === 'undefined' ||
          typeof IntersectionObserver === 'undefined' ||
          (!onReachStart && !onReachEnd)
        ) {
          return {
            topSentinel: null,
            bottomSentinel: null,
            disconnect: () => {
            }
          }
        }

        let topSentinel = null
        let bottomSentinel = null
        let observer = null

        if (onReachStart) {
          topSentinel = document.createElement('div')
          topSentinel.className = 'lists-infinite-sentinel lists-infinite-sentinel-top'
          topSentinel.style.cssText = 'height: 1px; width: 100%; pointer-events: none; visibility: hidden;'
        }

        if (onReachEnd) {
          bottomSentinel = document.createElement('div')
          bottomSentinel.className = 'lists-infinite-sentinel lists-infinite-sentinel-bottom'
          bottomSentinel.style.cssText = 'height: 1px; width: 100%; pointer-events: none; visibility: hidden;'
        }

        const marginStr = `${reachThreshold}px 0px`
        observer = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) {
              continue
            }
            if (topSentinel && entry.target === topSentinel && typeof onReachStart === 'function') {
              try {
                onReachStart()
              } catch (err) {
                console.error('Error in lists onReachStart callback:', err)
              }
            } else if (bottomSentinel && entry.target === bottomSentinel && typeof onReachEnd === 'function') {
              try {
                onReachEnd()
              } catch (err) {
                console.error('Error in lists onReachEnd callback:', err)
              }
            }
          }
        }, {
          root: container,
          rootMargin: marginStr,
          threshold: 0
        })

        if (topSentinel) {
          observer.observe(topSentinel)
        }
        if (bottomSentinel) {
          observer.observe(bottomSentinel)
        }

        return {
          topSentinel,
          bottomSentinel,
          disconnect () {
            if (observer) {
              observer.disconnect()
              observer = null
            }
            if (topSentinel && topSentinel.parentNode) {
              topSentinel.remove()
            }
            if (bottomSentinel && bottomSentinel.parentNode) {
              bottomSentinel.remove()
            }
          }
        }
      }

      function groupItems (items = [], groupBy = null) {
        if (typeof groupBy !== 'function' || !Array.isArray(items) || items.length === 0) {
          return {
            flatItems: Array.isArray(items) ? [...items] : [],
            groups: []
          }
        }

        const groupMap = new Map()
        const ungrouped = []

        for (const item of items) {
          let gKey
          try {
            gKey = groupBy(item)
          } catch (err) {
            console.error('Error in lists groupBy callback:', err)
          }

          // eslint-disable-next-line eqeqeq
          if (gKey == null) {
            ungrouped.push(item)
          } else {
            const stringKey = String(gKey)
            let group = groupMap.get(stringKey)
            if (!group) {
              group = {
                key: `header:${stringKey}`,
                groupKey: stringKey,
                __header: true,
                items: []
              }
              groupMap.set(stringKey, group)
            }
            group.items.push(item)
          }
        }

        const flatItems = []
        const groups = Array.from(groupMap.values())

        for (const group of groups) {
          flatItems.push(group)
          for (const item of group.items) {
            flatItems.push(item)
          }
        }

        for (const item of ungrouped) {
          flatItems.push(item)
        }

        return {
          flatItems,
          groups
        }
      }

      function findTopVisibleGroup (groups, positions, scrollTop) {
        if (!groups || groups.length === 0 || !positions || positions.length === 0) {
          return null
        }

        let activeGroup = null

        for (let i = 0; i < groups.length; i++) {
          const group = groups[i]
          const headerPos = positions.find((p) => p.key === group.key)
          if (!headerPos) {
            continue
          }

          const nextGroup = groups[i + 1]
          const nextHeaderPos = nextGroup ? positions.find((p) => p.key === nextGroup.key) : null
          const nextGroupTop = nextHeaderPos ? nextHeaderPos.y : Infinity

          if (headerPos.y <= scrollTop) {
            activeGroup = {
              groupKey: group.groupKey,
              items: group.items,
              headerPos,
              nextGroupTop
            }
          } else {
            if (!activeGroup) {
              activeGroup = {
                groupKey: group.groupKey,
                items: group.items,
                headerPos,
                nextGroupTop
              }
            }
            break
          }
        }

        return activeGroup
      }

      function bindWindow (options = {}) {
        const opts = options || {}
        const {
          container,
          store,
          create,
          update,
          key: customKeyFn,
          size: defaultSize = 64,
          overscan = 3,
          anchorTo = 'start',
          followOnAppend = false,
          scrollEndThreshold = 50,
          signal,
          onReachStart,
          onReachEnd,
          reachThreshold = 200,
          layout = 'linear',
          lanes = 1,
          laneWidth = 280,
          minLaneWidth = 200,
          maxLanes = 6,
          gap = 0,
          columns = [],
          headerHeight = 40,
          groupBy = null,
          createHeader = null,
          stickyGroups = false
        } = opts

        if (!container || typeof container !== 'object' || !container.appendChild) {
          throw createCoraliteError('lists.bind (virtual: window): container must be a DOM element')
        }
        if (!store || typeof store !== 'object' || typeof store.all !== 'function') {
          throw createCoraliteError('lists.bind (virtual: window): store must be a valid lists store instance')
        }
        if (typeof create !== 'function') {
          throw createCoraliteError('lists.bind (virtual: window): create option must be a function returning an HTMLElement')
        }

        let effectiveKey = (item) => item?.id
        if (typeof customKeyFn === 'function') {
          effectiveKey = customKeyFn
        } else if (store && typeof store.getKey === 'function') {
          effectiveKey = store.getKey
        }

        let destroyed = false
        const elementMap = new Map()
        const measurements = createMeasurementCache(defaultSize)

        const isDynamicMeasure = true

        let rawItems = store.all()
        let { flatItems: items, groups } = groupItems(rawItems, groupBy)

        function getContainerWidth () {
          return container.clientWidth || 800
        }

        function getViewportHeight () {
          return container.clientHeight || 400
        }

        function getLayoutOptions () {
          return {
            layout,
            lanes,
            laneWidth,
            minLaneWidth,
            maxLanes,
            gap,
            columns,
            headerHeight,
            containerWidth: getContainerWidth()
          }
        }

        let positions = computePositions(items, effectiveKey, measurements, defaultSize, getLayoutOptions())

        function getTotalHeight () {
          if (positions.length === 0) {
            return 0
          }
          let maxBottom = 0
          for (let i = 0; i < positions.length; i++) {
            const p = positions[i]
            const b = p.y + p.height
            if (b > maxBottom) {
              maxBottom = b
            }
          }
          return maxBottom
        }

        const MAX_SAFE_HEIGHT = 33_000_000
        function getScale () {
          const totalHeight = getTotalHeight()
          if (totalHeight > MAX_SAFE_HEIGHT) {
            return MAX_SAFE_HEIGHT / totalHeight
          }
          return 1
        }

        let anchor = null
        if (anchorTo === 'end' && positions.length > 0) {
          const lastPos = positions[positions.length - 1]
          anchor = {
            key: lastPos.key,
            offset: 0
          }
        }

        function shouldFollow () {
          if (!followOnAppend) {
            return false
          }
          const totalHeight = getTotalHeight()
          const scale = getScale()
          const viewportHeight = getViewportHeight()
          const currentScrollTop = container.scrollTop || 0
          const maxScrollTop = Math.max(0, (totalHeight * scale) - viewportHeight)
          return (maxScrollTop - currentScrollTop) <= scrollEndThreshold
        }

        if (container.style) {
          container.style.overflowAnchor = 'none'
          if (layout !== 'linear' && container.style.position !== 'relative' && container.style.position !== 'absolute' && container.style.position !== 'fixed') {
            container.style.position = 'relative'
          }
        }

        const { topSentinel, bottomSentinel, disconnect: disconnectInfinite } = setupInfiniteScroll({
          container,
          onReachStart,
          onReachEnd,
          reachThreshold
        })

        let topSpacer = null
        let bottomSpacer = null

        topSpacer = document.createElement('div')
        topSpacer.className = 'lists-virtual-spacer lists-virtual-spacer-top'
        topSpacer.style.cssText = 'width: 100%; height: 0px; pointer-events: none;'

        bottomSpacer = document.createElement('div')
        bottomSpacer.className = 'lists-virtual-spacer lists-virtual-spacer-bottom'
        bottomSpacer.style.cssText = 'width: 100%; height: 0px; pointer-events: none;'

        let stickyHeaderEl = null
        let stickyGroupKey = null

        if (stickyGroups && typeof createHeader === 'function') {
          stickyHeaderEl = document.createElement('div')
          stickyHeaderEl.className = 'lists-sticky-header-container'
          stickyHeaderEl.style.cssText = 'position: sticky; top: 0; left: 0; right: 0; z-index: 10; pointer-events: auto;'
        }

        function createElementForItem (item) {
          const k = effectiveKey(item)
          if (elementMap.has(k)) {
            return elementMap.get(k)
          }

          let el
          if (item && item.__header) {
            if (typeof createHeader === 'function') {
              el = createHeader(item.groupKey, item.items)
            } else {
              el = document.createElement('div')
              el.className = 'lists-group-header'
              el.textContent = String(item.groupKey)
            }
          } else {
            el = create(item)
          }

          if (!el || !(el instanceof HTMLElement)) {
            return null
          }

          elementMap.set(k, el)

          if (isDynamicMeasure) {
            measurements.observe(el, k, () => {
              const activeLanes = lanes === 'auto'
                ? computeLaneCount(getContainerWidth(), laneWidth, minLaneWidth, maxLanes, gap)
                : Math.max(1, Number(lanes) || 1)
              const actualLaneWidth = (layout === 'grid' || layout === 'masonry')
                ? (getContainerWidth() - (gap * (activeLanes - 1))) / activeLanes
                : laneWidth
              return `${activeLanes}:${Math.round(actualLaneWidth)}:${Math.round(getContainerWidth())}`
            }, () => {
              if (!destroyed) {
                positions = computePositions(items, effectiveKey, measurements, defaultSize, getLayoutOptions())
                renderVisibleWindow()
              }
            })
          }

          return el
        }

        function renderVisibleWindow () {
          if (destroyed) {
            return
          }

          const viewportHeight = getViewportHeight()
          const scale = getScale()
          const scrollTop = container.scrollTop || 0
          const virtualScrollTop = scrollTop / scale

          const { startIndex, endIndex } = computeVisibleRange(
            positions,
            virtualScrollTop,
            viewportHeight,
            overscan
          )

          if (startIndex > endIndex || positions.length === 0) {
            if (topSpacer) {
              topSpacer.style.height = '0px'
            }
            if (bottomSpacer) {
              bottomSpacer.style.height = '0px'
            }

            const emptyNodes = []
            if (topSentinel) {
              emptyNodes.push(topSentinel)
            }
            if (topSpacer) {
              emptyNodes.push(topSpacer)
            }
            if (bottomSpacer) {
              emptyNodes.push(bottomSpacer)
            }
            if (bottomSentinel) {
              emptyNodes.push(bottomSentinel)
            }
            container.replaceChildren(...emptyNodes)
            return
          }

          const startPos = positions[startIndex]
          const endPos = positions[endIndex]

          const topSpacerHeight = (startPos ? startPos.y : 0) * scale
          const totalHeight = getTotalHeight()
          const bottomSpacerHeight = (totalHeight - (endPos ? (endPos.y + endPos.height) : totalHeight)) * scale

          if (topSpacer) {
            topSpacer.style.height = `${Math.max(0, topSpacerHeight)}px`
          }
          if (bottomSpacer) {
            bottomSpacer.style.height = `${Math.max(0, bottomSpacerHeight)}px`
          }

          const visibleKeys = new Set()
          const newRenderedNodes = []

          if (topSentinel) {
            newRenderedNodes.push(topSentinel)
          }
          if (topSpacer) {
            newRenderedNodes.push(topSpacer)
          }

          for (let i = startIndex; i <= endIndex; i++) {
            const item = items[i]
            if (!item) {
              continue
            }
            const k = effectiveKey(item)
            visibleKeys.add(k)

            const el = createElementForItem(item)
            if (el) {
              const pos = positions[i]
              if (pos && layout !== 'linear' && el.style) {
                el.style.position = 'absolute'
                el.style.left = `${pos.x}px`
                el.style.top = `${pos.y * scale}px`
                el.style.width = `${pos.width}px`
              }
              newRenderedNodes.push(el)
            }
          }

          if (bottomSpacer) {
            newRenderedNodes.push(bottomSpacer)
          }
          if (bottomSentinel) {
            newRenderedNodes.push(bottomSentinel)
          }

          if (stickyHeaderEl) {
            newRenderedNodes.push(stickyHeaderEl)
          }

          for (const [k, el] of elementMap.entries()) {
            if (!visibleKeys.has(k)) {
              if (isDynamicMeasure) {
                measurements.unobserve(el)
              }
              elementMap.delete(k)
            }
          }

          container.replaceChildren(...newRenderedNodes)

          updateStickyHeader(virtualScrollTop, scale)

          if (anchorTo === 'end') {
            const scrollBottom = virtualScrollTop + viewportHeight
            let anchorIdx = endIndex
            for (let i = startIndex; i <= endIndex; i++) {
              if (positions[i]) {
                const itemBottom = positions[i].y + positions[i].height
                if (itemBottom >= scrollBottom) {
                  anchorIdx = i
                  break
                }
              }
            }
            if (positions[anchorIdx]) {
              const anchorItem = positions[anchorIdx]
              const itemBottom = anchorItem.y + anchorItem.height
              anchor = {
                key: anchorItem.key,
                offset: scrollBottom - itemBottom
              }
            }
          } else {
            if (positions[startIndex]) {
              anchor = {
                key: positions[startIndex].key,
                offset: virtualScrollTop - positions[startIndex].y
              }
            }
          }
        }

        function updateStickyHeader (virtualScrollTop, scale) {
          if (!stickyHeaderEl || groups.length === 0) {
            return
          }

          const topVisible = findTopVisibleGroup(groups, positions, virtualScrollTop)
          if (!topVisible) {
            stickyHeaderEl.style.display = 'none'
            return
          }

          stickyHeaderEl.style.display = ''

          if (topVisible.groupKey !== stickyGroupKey) {
            stickyGroupKey = topVisible.groupKey
            stickyHeaderEl.replaceChildren(createHeader(stickyGroupKey, topVisible.items))
          }

          let measuredHeaderH = headerHeight
          if (topVisible.headerPos && topVisible.headerPos.height > 0) {
            measuredHeaderH = topVisible.headerPos.height
          } else if (stickyHeaderEl.clientHeight && stickyHeaderEl.clientHeight > 0) {
            measuredHeaderH = stickyHeaderEl.clientHeight
          }

          const nextGroupTopScaled = topVisible.nextGroupTop !== Infinity ? topVisible.nextGroupTop * scale : Infinity
          const currentScrollTop = container.scrollTop || 0

          const diff = nextGroupTopScaled - currentScrollTop - measuredHeaderH
          const stickyTop = Math.min(0, diff)

          stickyHeaderEl.style.transform = `translateY(${stickyTop}px)`
        }

        let pendingScroll = false
        function onScroll () {
          if (pendingScroll || destroyed) {
            return
          }
          pendingScroll = true
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => {
              pendingScroll = false
              if (!destroyed) {
                renderVisibleWindow()
              }
            })
          } else {
            pendingScroll = false
            renderVisibleWindow()
          }
        }

        container.addEventListener('scroll', onScroll, { passive: true })

        let containerObserver = null
        let lastContainerWidth = getContainerWidth()

        if (typeof ResizeObserver !== 'undefined') {
          containerObserver = new ResizeObserver(() => {
            if (destroyed) {
              return
            }
            const newWidth = getContainerWidth()
            if (Math.abs(newWidth - lastContainerWidth) >= 1) {
              lastContainerWidth = newWidth
              positions = computePositions(items, effectiveKey, measurements, defaultSize, getLayoutOptions())
              if (anchor) {
                const viewportHeight = getViewportHeight()
                const derivedVirtualScrollTop = computeScrollTopFromAnchor(anchor, positions, anchorTo, viewportHeight)
                const scale = getScale()
                container.scrollTop = derivedVirtualScrollTop * scale
              }
              renderVisibleWindow()
            }
          })
          containerObserver.observe(container)
        }

        if (anchorTo === 'end') {
          const totalHeight = getTotalHeight()
          const scale = getScale()
          const viewportHeight = getViewportHeight()
          container.scrollTop = Math.max(container.scrollHeight || 0, (totalHeight * scale) - viewportHeight)
        }

        renderVisibleWindow()

        function handleStoreChange (changes) {
          if (destroyed || !changes || changes.length === 0) {
            return
          }

          let mustFollow = false
          for (const change of changes) {
            if ((change.type === 'append' || change.type === 'appendMany') && anchorTo === 'end' && followOnAppend) {
              if (shouldFollow()) {
                mustFollow = true
              }
            }
          }

          const oldPositions = positions
          rawItems = store.all()
          const { flatItems: nextItems, groups: nextGroups } = groupItems(rawItems, groupBy)
          items = nextItems
          groups = nextGroups
          positions = computePositions(items, effectiveKey, measurements, defaultSize, getLayoutOptions())

          for (const change of changes) {
            switch (change.type) {
              case 'update': {
                const k = change.id
                const el = elementMap.get(k)
                if (el && typeof update === 'function') {
                  const newItem = store.get(k)
                  if (newItem) {
                    update(el, newItem)
                  }
                }
                break
              }

              case 'remove': {
                const removedKey = change.id
                const oldEl = elementMap.get(removedKey)
                if (oldEl) {
                  if (isDynamicMeasure) {
                    measurements.unobserve(oldEl)
                  }
                  elementMap.delete(removedKey)
                }

                if (anchor && anchor.key === removedKey) {
                  anchor = reanchorOnRemove(removedKey, anchor, oldPositions, anchorTo)
                  if (anchor) {
                    const viewportHeight = getViewportHeight()
                    const derivedVirtualScrollTop = computeScrollTopFromAnchor(anchor, positions, anchorTo, viewportHeight)
                    const scale = getScale()
                    container.scrollTop = derivedVirtualScrollTop * scale
                  } else {
                    container.scrollTop = 0
                  }
                }
                break
              }

              case 'clear': {
                anchor = null
                measurements.clear()
                break
              }
            }
          }

          renderVisibleWindow()

          if (mustFollow) {
            const newTotalHeight = getTotalHeight()
            const scale = getScale()
            const viewportHeight = getViewportHeight()
            const targetScrollTop = Math.max(0, (newTotalHeight * scale) - viewportHeight)

            if (followOnAppend === 'smooth' && typeof container.scrollTo === 'function') {
              container.scrollTo({
                top: targetScrollTop,
                behavior: 'smooth'
              })
            } else {
              container.scrollTop = targetScrollTop
            }
          }
        }

        const unsubscribe = store.subscribe(handleStoreChange)

        function scrollToKey (keyToScroll, { align = 'auto' } = {}) {
          if (destroyed) {
            return
          }

          const viewportHeight = getViewportHeight()

          for (let i = 0; i < 2; i++) {
            const pos = positions.find((p) => p.key === keyToScroll)
            if (!pos) {
              return
            }

            const scale = getScale()
            const currentVirtualScrollTop = (container.scrollTop || 0) / scale

            let effectiveAlign = align
            if (align === 'auto') {
              const itemTop = pos.y
              const itemBottom = pos.y + pos.height
              const vTop = currentVirtualScrollTop
              const vBottom = vTop + viewportHeight

              if (itemTop >= vTop && itemBottom <= vBottom) {
                return
              }
              if (itemTop < vTop) {
                effectiveAlign = 'start'
              } else {
                effectiveAlign = 'end'
              }
            }

            let targetVirtual = 0
            if (effectiveAlign === 'start') {
              targetVirtual = pos.y
            } else if (effectiveAlign === 'center') {
              targetVirtual = (pos.y + (pos.height / 2)) - (viewportHeight / 2)
            } else if (effectiveAlign === 'end') {
              targetVirtual = (pos.y + pos.height) - viewportHeight
            }

            const targetScrollTop = Math.max(0, targetVirtual * scale)
            container.scrollTop = targetScrollTop
            renderVisibleWindow()
          }
        }

        function getAnchor () {
          return anchor ? {
            key: anchor.key,
            offset: anchor.offset
          } : null
        }

        function destroy () {
          if (destroyed) {
            return
          }
          destroyed = true

          container.removeEventListener('scroll', onScroll)
          if (containerObserver) {
            containerObserver.disconnect()
            containerObserver = null
          }
          measurements.disconnect()
          disconnectInfinite()

          if (container.style) {
            container.style.overflowAnchor = ''
            if (layout !== 'linear') {
              container.style.position = ''
            }
          }

          if (stickyHeaderEl && stickyHeaderEl.parentNode === container) {
            stickyHeaderEl.remove()
          }
          stickyHeaderEl = null

          if (topSpacer && topSpacer.parentNode === container) {
            topSpacer.remove()
          }
          if (bottomSpacer && bottomSpacer.parentNode === container) {
            bottomSpacer.remove()
          }

          unsubscribe()
        }

        if (signal && typeof signal.addEventListener === 'function') {
          if (signal.aborted) {
            destroy()
          } else {
            signal.addEventListener('abort', destroy, { once: true })
          }
        }

        return {
          destroy,
          scrollToKey,
          getAnchor
        }
      }

      function bind (options = {}) {
        const opts = options || {}
        const {
          virtual = false,
          groupBy = null,
          createHeader = null,
          container,
          store,
          create,
          update,
          key: customKeyFn,
          anchorTo = 'start',
          followOnAppend = false,
          scrollEndThreshold = 50,
          signal,
          onReachStart,
          onReachEnd,
          reachThreshold = 200
        } = opts

        let effectiveVirtual = virtual
        if (effectiveVirtual === 'auto') {
          const count = store && typeof store.all === 'function' ? store.all().length : 0
          if (count >= 100) {
            effectiveVirtual = 'window'
          } else {
            effectiveVirtual = false
          }
        }

        if (effectiveVirtual === 'window') {
          return bindWindow(options)
        }

        if (!container || typeof container !== 'object' || !container.appendChild) {
          throw createCoraliteError('lists.bind: container must be a DOM element')
        }
        if (!store || typeof store !== 'object' || typeof store.all !== 'function') {
          throw createCoraliteError('lists.bind: store must be a valid lists store instance')
        }
        if (typeof create !== 'function') {
          throw createCoraliteError('lists.bind: create option must be a function returning an HTMLElement')
        }

        let effectiveKey = (item) => item?.id
        if (typeof customKeyFn === 'function') {
          effectiveKey = customKeyFn
        } else if (store && typeof store.getKey === 'function') {
          effectiveKey = store.getKey
        }

        let destroyed = false
        const elementMap = new Map()

        let rawItems = store.all()
        let { flatItems: items } = groupItems(rawItems, groupBy)

        function shouldFollow () {
          if (!followOnAppend) {
            return false
          }
          const currentScrollTop = container.scrollTop || 0
          const maxScrollTop = Math.max(0, (container.scrollHeight || 0) - (container.clientHeight || 0))
          return (maxScrollTop - currentScrollTop) <= scrollEndThreshold
        }

        const { topSentinel, bottomSentinel, disconnect: disconnectInfinite } = setupInfiniteScroll({
          container,
          onReachStart,
          onReachEnd,
          reachThreshold
        })

        if (topSentinel && container.firstChild) {
          container.insertBefore(topSentinel, container.firstChild)
        } else if (topSentinel) {
          container.appendChild(topSentinel)
        }

        function createElementForItem (item) {
          const k = effectiveKey(item)
          if (elementMap.has(k)) {
            return elementMap.get(k)
          }

          let el
          if (item && item.__header) {
            if (typeof createHeader === 'function') {
              el = createHeader(item.groupKey, item.items)
            } else {
              el = document.createElement('div')
              el.className = 'lists-group-header'
              el.textContent = String(item.groupKey)
            }
          } else {
            el = create(item)
          }

          if (!el || !(el instanceof HTMLElement)) {
            return null
          }

          elementMap.set(k, el)
          return el
        }

        function renderAll () {
          if (destroyed) {
            return
          }

          const newChildren = []

          if (topSentinel) {
            newChildren.push(topSentinel)
          }

          for (const item of items) {
            const el = createElementForItem(item)
            if (el) {
              newChildren.push(el)
            }
          }

          if (bottomSentinel) {
            newChildren.push(bottomSentinel)
          }

          container.replaceChildren(...newChildren)
        }

        renderAll()

        if (anchorTo === 'end') {
          container.scrollTop = Math.max(0, (container.scrollHeight || 0) - (container.clientHeight || 0))
        }

        function handleStoreChange (changes) {
          if (destroyed || !changes || changes.length === 0) {
            return
          }

          let mustFollow = false
          for (const change of changes) {
            if ((change.type === 'append' || change.type === 'appendMany') && anchorTo === 'end' && followOnAppend) {
              if (shouldFollow()) {
                mustFollow = true
              }
            }
          }

          rawItems = store.all()
          const regroup = groupItems(rawItems, groupBy)
          items = regroup.flatItems

          if (groupBy) {
            for (const change of changes) {
              if (change.type === 'clear') {
                elementMap.clear()
              }
            }
            renderAll()
          } else {
            for (const change of changes) {
              switch (change.type) {
                case 'append': {
                  for (const item of change.items) {
                    const el = createElementForItem(item)
                    if (el) {
                      if (bottomSentinel && bottomSentinel.parentNode === container) {
                        container.insertBefore(el, bottomSentinel)
                      } else {
                        container.appendChild(el)
                      }
                    }
                  }
                  break
                }

                case 'prepend': {
                  const insertBeforeNode = topSentinel && topSentinel.parentNode === container
                    ? topSentinel.nextSibling
                    : container.firstChild

                  for (const item of change.items) {
                    const el = createElementForItem(item)
                    if (el) {
                      if (insertBeforeNode) {
                        container.insertBefore(el, insertBeforeNode)
                      } else if (bottomSentinel && bottomSentinel.parentNode === container) {
                        container.insertBefore(el, bottomSentinel)
                      } else {
                        container.appendChild(el)
                      }
                    }
                  }
                  break
                }

                case 'update': {
                  const k = change.id
                  const el = elementMap.get(k)
                  if (el && typeof update === 'function') {
                    const newItem = store.get(k)
                    if (newItem) {
                      update(el, newItem)
                    }
                  }
                  break
                }

                case 'remove': {
                  const k = change.id
                  const el = elementMap.get(k)
                  if (el) {
                    if (el.parentNode === container) {
                      el.remove()
                    }
                    elementMap.delete(k)
                  }
                  break
                }

                case 'swap': {
                  const elA = elementMap.get(change.idA)
                  const elB = elementMap.get(change.idB)

                  if (elA && elB && elA.parentNode === container && elB.parentNode === container) {
                    const nextA = elA.nextSibling
                    const nextB = elB.nextSibling

                    if (nextA === elB) {
                      container.insertBefore(elB, elA)
                    } else if (nextB === elA) {
                      container.insertBefore(elA, elB)
                    } else {
                      container.insertBefore(elA, nextB)
                      container.insertBefore(elB, nextA)
                    }
                  } else {
                    renderAll()
                  }
                  break
                }

                case 'set':
                case 'clear':
                default: {
                  if (change.type === 'clear') {
                    elementMap.clear()
                  }
                  renderAll()
                  break
                }
              }
            }
          }

          if (mustFollow) {
            const targetScrollTop = Math.max(0, (container.scrollHeight || 0) - (container.clientHeight || 0))
            if (followOnAppend === 'smooth' && typeof container.scrollTo === 'function') {
              container.scrollTo({
                top: targetScrollTop,
                behavior: 'smooth'
              })
            } else {
              container.scrollTop = targetScrollTop
            }
          }
        }

        const unsubscribe = store.subscribe(handleStoreChange)

        function destroy () {
          if (destroyed) {
            return
          }
          destroyed = true

          disconnectInfinite()
          unsubscribe()
          elementMap.clear()
        }

        if (signal && typeof signal.addEventListener === 'function') {
          if (signal.aborted) {
            destroy()
          } else {
            signal.addEventListener('abort', destroy, { once: true })
          }
        }

        return {
          destroy
        }
      }

      const listsApi = {
        createStore,
        bind
      }

      // Phase 2: Runs per component. Returns the API directly.
      return () => listsApi
    }
  }
})

export const lists = listsPlugin
export default listsPlugin
