/**
 *
 */
export function getMemoryUsage () {
  const usage = process.memoryUsage()
  return {
    rssMB: +(usage.rss / (1024 * 1024)).toFixed(2),
    heapTotalMB: +(usage.heapTotal / (1024 * 1024)).toFixed(2),
    heapUsedMB: +(usage.heapUsed / (1024 * 1024)).toFixed(2),
    externalMB: +(usage.external / (1024 * 1024)).toFixed(2)
  }
}

/**
 *
 */
export function triggerGC () {
  if (typeof global.gc === 'function') {
    global.gc()
  } else {
    console.warn('⚠️ Warning: global.gc() not available. Run node with --expose-gc.')
  }
}
