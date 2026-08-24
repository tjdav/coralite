import React, { useState } from 'react'
import { hydrateRoot } from 'react-dom/client'

/**
 * Product Card component for React 19 benchmark.
 * @returns {React.ReactElement} The React element tree.
 */
export function ProductCard () {
  const [price] = useState(100)
  const [quantity, setQuantity] = useState(1)
  const [discount, setDiscount] = useState(0)
  const [promoCode, setPromoCode] = useState('')

  const totalPrice = Math.max(0, (price * quantity) - discount).toFixed(2)

  const handleApplyPromo = async () => {
    const code = promoCode.trim()
    await new Promise(resolve => setTimeout(resolve, 10))
    if (code === 'DISCOUNT20') {
      setDiscount(price * quantity * 0.2)
    } else {
      setDiscount(0)
    }
  }

  return React.createElement(
    'div',
    { className: 'product-card' },
    React.createElement('h2', null, 'Pro Wireless Headphones'),
    React.createElement(
      'div',
      { className: 'quantity-controls' },
      React.createElement(
        'button',
        {
          id: 'dec-qty',
          type: 'button',
          onClick: () => setQuantity(q => Math.max(1, q - 1))
        },
        '-'
      ),
      React.createElement('span', { id: 'qty-display' }, quantity),
      React.createElement(
        'button',
        {
          id: 'inc-qty',
          type: 'button',
          onClick: () => setQuantity(q => q + 1)
        },
        '+'
      )
    ),
    React.createElement(
      'div',
      { className: 'promo-section' },
      React.createElement('input', {
        id: 'promo-code',
        type: 'text',
        placeholder: 'Enter promo code',
        value: promoCode,
        onChange: (e) => setPromoCode(e.target.value)
      }),
      React.createElement(
        'button',
        {
          id: 'apply-promo',
          type: 'button',
          onClick: handleApplyPromo
        },
        'Apply'
      )
    ),
    React.createElement(
      'div',
      { className: 'price-section' },
      'Total: $',
      React.createElement('span', { id: 'total-price' }, totalPrice)
    ),
    React.createElement(
      'button',
      {
        id: 'buy-btn',
        type: 'button',
        onClick: () => {
        }
      },
      'Buy Now'
    )
  )
}

if (typeof document !== 'undefined') {
  const container = document.getElementById('root')
  if (container) {
    performance.mark('hydration:start')
    hydrateRoot(container, React.createElement(ProductCard))
    performance.mark('hydration:end')
    performance.measure('hydration', 'hydration:start', 'hydration:end')
  }
}
