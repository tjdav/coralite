import { createSSRApp, ref, computed, h } from 'vue'

export const ProductCard = {
  setup () {
    const price = ref(100)
    const quantity = ref(1)
    const discount = ref(0)
    const promoCode = ref('')

    const totalPrice = computed(() => {
      return Math.max(0, (price.value * quantity.value) - discount.value).toFixed(2)
    })

    const incQty = () => {
      quantity.value += 1
    }

    const decQty = () => {
      if (quantity.value > 1) {
        quantity.value -= 1
      }
    }

    const applyPromo = async () => {
      const code = promoCode.value.trim()
      await new Promise(resolve => setTimeout(resolve, 10))
      if (code === 'DISCOUNT20') {
        discount.value = price.value * quantity.value * 0.2
      } else {
        discount.value = 0
      }
    }

    const buy = () => {
    }

    return () => h('div', { class: 'product-card' }, [
      h('h2', null, 'Pro Wireless Headphones'),
      h('div', { class: 'quantity-controls' }, [
        h('button', {
          id: 'dec-qty',
          type: 'button',
          onClick: decQty
        }, '-'),
        h('span', { id: 'qty-display' }, quantity.value),
        h('button', {
          id: 'inc-qty',
          type: 'button',
          onClick: incQty
        }, '+')
      ]),
      h('div', { class: 'promo-section' }, [
        h('input', {
          id: 'promo-code',
          type: 'text',
          placeholder: 'Enter promo code',
          value: promoCode.value,
          onInput: (e) => {
            promoCode.value = e.target.value
          }
        }),
        h('button', {
          id: 'apply-promo',
          type: 'button',
          onClick: applyPromo
        }, 'Apply')
      ]),
      h('div', { class: 'price-section' }, [
        ' Total: $',
        h('span', { id: 'total-price' }, totalPrice.value)
      ]),
      h('button', {
        id: 'buy-btn',
        type: 'button',
        onClick: buy
      }, 'Buy Now')
    ])
  }
}

if (typeof document !== 'undefined') {
  const container = document.getElementById('app')
  if (container) {
    performance.mark('hydration:start')
    const app = createSSRApp(ProductCard)
    app.mount('#app')
    performance.mark('hydration:end')
    performance.measure('hydration', 'hydration:start', 'hydration:end')
  }
}
