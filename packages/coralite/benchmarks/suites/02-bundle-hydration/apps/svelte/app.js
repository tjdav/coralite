import { hydrate } from 'svelte'
import ProductCard from './ProductCard.svelte'

export { ProductCard }

if (typeof document !== 'undefined') {
  const container = document.getElementById('root')
  if (container) {
    performance.mark('hydration:start')
    hydrate(ProductCard, { target: container })
    performance.mark('hydration:end')
    performance.measure('hydration', 'hydration:start', 'hydration:end')
  }
}
