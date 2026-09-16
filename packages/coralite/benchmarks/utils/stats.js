/**
 * Statistics calculation utilities for Coralite benchmark suites.
 */

/**
 * Calculates the median of an array of numbers.
 * Uses all provided samples without silently dropping initial items.
 *
 * @param {number[]} numbers - Array of numeric samples.
 * @returns {number} The median value rounded to 2 decimal places.
 */
export function calculateMedian (numbers) {
  if (!numbers || numbers.length === 0) {
    return 0
  }
  const sorted = [...numbers].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return +((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2)
  }
  return +sorted[mid].toFixed(2)
}

/**
 * Calculates comprehensive descriptive statistics (median, mean, stddev, p95, min, max).
 *
 * @param {number[]} numbers - Array of numeric samples.
 * @returns {{ median: number, mean: number, stddev: number, p95: number, min: number, max: number, count: number }}
 */
export function calculateStats (numbers) {
  if (!numbers || numbers.length === 0) {
    return {
      median: 0,
      mean: 0,
      stddev: 0,
      p95: 0,
      min: 0,
      max: 0,
      count: 0
    }
  }

  const sorted = [...numbers].sort((a, b) => a - b)
  const count = sorted.length
  const mid = Math.floor(count / 2)
  const median = count % 2 === 0
    ? +((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2)
    : +sorted[mid].toFixed(2)

  const sum = numbers.reduce((acc, val) => acc + val, 0)
  const mean = +(sum / count).toFixed(2)

  let stddev = 0
  if (count > 1) {
    const variance = numbers.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (count - 1)
    stddev = +Math.sqrt(variance).toFixed(2)
  }

  // 95th percentile
  const p95Index = Math.min(count - 1, Math.floor(count * 0.95))
  const p95 = +sorted[p95Index].toFixed(2)

  return {
    median,
    mean,
    stddev,
    p95,
    min: +sorted[0].toFixed(2),
    max: +sorted[count - 1].toFixed(2),
    count
  }
}
