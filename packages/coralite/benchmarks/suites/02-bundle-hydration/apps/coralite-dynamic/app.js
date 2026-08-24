import { createCoraliteClass } from '../../../../../lib/coralite-element.js'

performance.mark('hydration:start')

const ProductCard = createCoraliteClass({
  componentId: 'product-card',
  defaultValues: {
    price: 100,
    quantity: 1,
    discount: 0,
    promoCode: ''
  },
  getters: {
    totalPrice (state) {
      return Math.max(0, (state.price * state.quantity) - state.discount).toFixed(2)
    }
  },
  client ({ state, root, observe }) {
    const incBtn = root.querySelector('#inc-qty')
    const decBtn = root.querySelector('#dec-qty')
    const qtyDisplay = root.querySelector('#qty-display')
    const promoInput = root.querySelector('#promo-code')
    const applyBtn = root.querySelector('#apply-promo')
    const totalPriceEl = root.querySelector('#total-price')
    const buyBtn = root.querySelector('#buy-btn')

    observe('quantity', (qty) => {
      if (qtyDisplay) {
        qtyDisplay.textContent = String(qty)
      }
    })

    observe('totalPrice', (price) => {
      if (totalPriceEl) {
        totalPriceEl.textContent = String(price)
      }
    })

    if (incBtn) {
      incBtn.addEventListener('click', () => {
        state.quantity += 1
      })
    }
    if (decBtn) {
      decBtn.addEventListener('click', () => {
        if (state.quantity > 1) {
          state.quantity -= 1
        }
      })
    }
    if (promoInput) {
      promoInput.addEventListener('input', (e) => {
        state.promoCode = e.target.value
      })
    }
    if (applyBtn) {
      applyBtn.addEventListener('click', async () => {
        const code = (state.promoCode || promoInput.value || '').trim()
        await new Promise(resolve => setTimeout(resolve, 10))
        if (code === 'DISCOUNT20') {
          state.discount = state.price * state.quantity * 0.2
        } else {
          state.discount = 0
        }
      })
    }
    if (buyBtn) {
      buyBtn.addEventListener('click', () => {
      })
    }
  }
})

if (!customElements.get('product-card')) {
  customElements.define('product-card', ProductCard)
}

performance.mark('hydration:end')
performance.measure('hydration', 'hydration:start', 'hydration:end')
