/**
 * Renders the pre-rendered HTML document for SSR hydration benchmarking.
 * @returns {string} The pre-rendered HTML document string.
 */
export function renderHTML () {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Coralite Static Benchmark</title>
</head>
<body>
  <product-card no-hydration data-cid="product-card-0">
    <div class="product-card">
      <h2>Pro Wireless Headphones</h2>
      <div class="quantity-controls">
        <button id="dec-qty" type="button">-</button>
        <span id="qty-display">1</span>
        <button id="inc-qty" type="button">+</button>
      </div>
      <div class="promo-section">
        <input id="promo-code" type="text" placeholder="Enter promo code" value="" />
        <button id="apply-promo" type="button">Apply</button>
      </div>
      <div class="price-section">
        Total: $<span id="total-price">100.00</span>
      </div>
      <button id="buy-btn" type="button">Buy Now</button>
    </div>
  </product-card>
</body>
</html>`
}
