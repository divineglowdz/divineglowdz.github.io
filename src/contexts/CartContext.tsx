import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { seedProducts } from '../data/seed'
import { getVariantPrice } from '../lib/pricing'
import { isSupabasePaused } from '../lib/supabase'
import type { CartItem, Product, ProductVariant } from '../types'
import { trackEvent } from '../lib/api'

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

function readInitialItems(): CartItem[] {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '[]') as CartItem[]
    if (!isSupabasePaused) return stored
    const localProducts = new Map(seedProducts.map((product) => [product.id, product]))
    return stored.flatMap((item) => {
      const product = localProducts.get(item.product.id)
      if (!product) return []
      const variant = item.variant
        ? product.product_variants.find((candidate) => candidate.id === item.variant?.id || candidate.value === item.variant?.value)
        : undefined
      if (item.variant && !variant) return []
      return [{ ...item, product, variant }]
    })
  } catch { return [] }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(readInitialItems)
  useEffect(() => localStorage.setItem(storageKey, JSON.stringify(items)), [items])

  const value = useMemo<CartContextValue>(() => ({
    items,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + getVariantPrice(item.product, item.variant) * item.quantity, 0),
    addItem(product, variant, quantity = 1) {
      setItems((current) => {
        const index = current.findIndex((item) => item.product.id === product.id && item.variant?.value === variant?.value)
        if (index < 0) return [...current, { product, variant, quantity }]
        return current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Math.min(item.quantity + quantity, variant?.stock ?? product.stock) } : item)
      })
      void trackEvent('add_to_cart', { product_id: product.id, variant: variant?.value })
    },
    updateQuantity(index, quantity) { setItems((current) => current.map((item, i) => i === index ? { ...item, quantity: Math.max(1, quantity) } : item)) },
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
