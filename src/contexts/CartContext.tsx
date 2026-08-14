import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getVariantPrice } from '../lib/pricing'
import type { CartItem, Product, ProductVariant } from '../types'

type CartContextValue = {
  items: CartItem[]
  count: number
  subtotal: number
  addItem: (product: Product, variant?: ProductVariant, quantity?: number) => void
  updateQuantity: (index: number, quantity: number) => void
  removeItem: (index: number) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)
const storageKey = 'divine-glow-cart-v3'

function availableStock(item: Pick<CartItem, 'product' | 'variant'>) {
  return Math.max(0, Number(item.variant?.stock ?? item.product.stock) || 0)
}

function normalizeCart(items: CartItem[]) {
  return items.flatMap((item) => {
    const stock = availableStock(item)
    const quantity = Math.min(Math.max(0, Number(item.quantity) || 0), stock)
    return quantity > 0 ? [{ ...item, quantity }] : []
  })
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try { return normalizeCart(JSON.parse(localStorage.getItem(storageKey) || '[]') as CartItem[]) } catch { return [] }
  })
  useEffect(() => localStorage.setItem(storageKey, JSON.stringify(items)), [items])

  const value = useMemo<CartContextValue>(() => ({
    items,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + getVariantPrice(item.product, item.variant) * item.quantity, 0),
    addItem(product, variant, quantity = 1) {
      setItems((current) => {
        const stock = Math.max(0, Number(variant?.stock ?? product.stock) || 0)
        if (!stock) return current
        const index = current.findIndex((item) => item.product.id === product.id && item.variant?.value === variant?.value)
        if (index < 0) return [...current, { product, variant, quantity: Math.min(Math.max(1, quantity), stock) }]
        return current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Math.min(item.quantity + quantity, stock) } : item)
      })
    },
    updateQuantity(index, quantity) {
      setItems((current) => current.flatMap((item, i) => {
        if (i !== index) return [item]
        const stock = availableStock(item)
        const nextQuantity = Math.min(Math.max(0, quantity), stock)
        return nextQuantity > 0 ? [{ ...item, quantity: nextQuantity }] : []
      }))
    },
    removeItem(index) { setItems((current) => current.filter((_, i) => i !== index)) },
    clear() { setItems([]) },
  }), [items])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used inside CartProvider')
  return context
}
