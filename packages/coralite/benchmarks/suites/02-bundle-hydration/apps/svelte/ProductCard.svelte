<script>
  let price = 100
  let quantity = $state(1)
  let discount = $state(0)
  let promoCode = $state('')

  let totalPrice = $derived(Math.max(0, (price * quantity) - discount).toFixed(2))

  async function handleApplyPromo () {
    const code = promoCode.trim()
    await new Promise(resolve => setTimeout(resolve, 10))
    if (code === 'DISCOUNT20') {
      discount = price * quantity * 0.2
    } else {
      discount = 0
    }
  }

  function inc () {
    quantity = quantity + 1
  }

  function dec () {
    quantity = Math.max(1, quantity - 1)
  }
</script>

<div class="product-card">
  <h2>Pro Wireless Headphones</h2>
  <div class="quantity-controls">
    <button id="dec-qty" type="button" onclick={dec}>-</button>
    <span id="qty-display">{quantity}</span>
    <button id="inc-qty" type="button" onclick={inc}>+</button>
  </div>
  <div class="promo-section">
    <input
      id="promo-code"
      type="text"
      placeholder="Enter promo code"
      bind:value={promoCode}
    />
    <button id="apply-promo" type="button" onclick={handleApplyPromo}>Apply</button>
  </div>
  <div class="price-section">
    Total: $<span id="total-price">{totalPrice}</span>
  </div>
  <button id="buy-btn" type="button">Buy Now</button>
</div>
