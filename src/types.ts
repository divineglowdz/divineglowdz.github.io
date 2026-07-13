export type ProductImage = { id?: string; url: string; path?: string | null; alt: string; position: number }
export type ProductVariant = { id?: string; name: string; value: string; color_hex?: string | null; stock: number; active?: boolean }

export type Product = {
  id: string
  slug: string
  name: string
  brand: string
  description: string
  details: string
  price: number
  compare_at_price: number | null
  stock: number
  category: string
  accent: string
  active: boolean
  featured: boolean
  created_at?: string
  product_images: ProductImage[]
  product_variants: ProductVariant[]
}

export type CartItem = { product: Product; quantity: number; variant?: ProductVariant }
export type DeliveryRate = { id?: string; wilaya_code: string; wilaya_name: string; home_price: number; office_price: number; active: boolean }
export type OrderStatus = 'nouvelle' | 'confirmee' | 'preparee' | 'expediee' | 'livree' | 'annulee'

export type Order = {
  id: string
  order_number: string
  customer_name: string
  phone: string
  wilaya_code: string
  wilaya_name: string
  commune: string
  address: string
  delivery_type: 'home' | 'office'
  delivery_price: number
  subtotal: number
  total: number
  status: OrderStatus
  notes?: string
  created_at: string
  order_items?: Array<{ id?: string; product_id?: string; product_name: string; variant_name?: string; quantity: number; unit_price: number }>
}

export type Profile = { id: string; email: string; full_name: string; role: 'admin' | 'staff'; active: boolean; created_at: string }
export type AnalyticsSummary = { views: number; productViews: number; addToCart: number; orders: number; revenue: number; lowStock: number }
