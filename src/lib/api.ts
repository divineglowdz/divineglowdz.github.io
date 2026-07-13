import { defaultDeliveryRates } from '../data/algeria'
import { seedProducts } from '../data/seed'
import type { AnalyticsSummary, DeliveryRate, Order, Product, Profile } from '../types'
import { isSupabaseConfigured, supabase } from './supabase'

const normalizeProduct = (row: Record<string, unknown>) => ({
  ...row,
  product_images: Array.isArray(row.product_images) ? row.product_images : [],
  product_variants: Array.isArray(row.product_variants) ? row.product_variants : [],
}) as Product

export async function getProducts(admin = false): Promise<Product[]> {
  if (!isSupabaseConfigured) return seedProducts
  let query = supabase.from('products').select('*, product_images(*), product_variants(*)').order('created_at')
  if (!admin) query = query.eq('active', true)
  const { data, error } = await query
  if (error) throw error
  return (data || []).map((row) => normalizeProduct(row))
}

export async function getProduct(slug: string): Promise<Product | null> {
  if (!isSupabaseConfigured) return seedProducts.find((product) => product.slug === slug) || null
  const { data, error } = await supabase
    .from('products').select('*, product_images(*), product_variants(*)').eq('slug', slug).eq('active', true).maybeSingle()
  if (error) throw error
  return data ? normalizeProduct(data) : null
}

export async function getDeliveryRates(): Promise<DeliveryRate[]> {
  if (!isSupabaseConfigured) return defaultDeliveryRates
  const { data, error } = await supabase.from('delivery_rates').select('*').order('wilaya_code')
  if (error) throw error
  return data?.length ? data : defaultDeliveryRates
}

export async function trackEvent(eventType: string, metadata: Record<string, unknown> = {}) {
  if (!isSupabaseConfigured) return
  await supabase.from('analytics_events').insert({
    event_type: eventType,
    path: window.location.pathname,
    session_id: getSessionId(),
    metadata,
  })
}

function getSessionId() {
  const key = 'divine-glow-session'
  let value = sessionStorage.getItem(key)
  if (!value) {
    value = crypto.randomUUID()
    sessionStorage.setItem(key, value)
  }
  return value
}

export async function placeOrder(payload: Record<string, unknown>): Promise<{ order_number: string }> {
  if (!isSupabaseConfigured) return { order_number: `DG-${Date.now().toString().slice(-6)}` }
  const { data, error } = await supabase.rpc('place_order', { payload })
  if (error) throw error
  return data as { order_number: string }
}

export async function getOrders(): Promise<Order[]> {
  const { data, error } = await supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as Order[]
}

export async function saveOrder(id: string, updates: Partial<Order>) {
  const { error } = await supabase.from('orders').update(updates).eq('id', id)
  if (error) throw error
}

export async function deleteOrder(id: string) {
  const { error } = await supabase.from('orders').delete().eq('id', id)
  if (error) throw error
}

export async function saveProduct(product: Partial<Product>) {
  const payload = {
    id: product.id || undefined, slug: product.slug, name: product.name, brand: product.brand,
    category: product.category, description: product.description, details: product.details,
    price: product.price, stock: product.stock, accent: product.accent, active: product.active, featured: product.featured,
  }
  const { data, error } = await supabase.from('products').upsert(payload).select().single()
  if (error) throw error
  if (product.product_variants) {
    await supabase.from('product_variants').delete().eq('product_id', data.id)
    if (product.product_variants.length) {
      const { error: variantError } = await supabase.from('product_variants').insert(
        product.product_variants.map((variant) => ({ ...variant, id: undefined, product_id: data.id })),
      )
      if (variantError) throw variantError
    }
  }
  return data as Product
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
}

export async function uploadProductImages(productId: string, files: File[]) {
  for (const [index, file] of files.entries()) {
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-')
    const path = `${productId}/${crypto.randomUUID()}-${safeName}`
    const { error: uploadError } = await supabase.storage.from('product-images').upload(path, file)
    if (uploadError) throw uploadError
    const { data } = supabase.storage.from('product-images').getPublicUrl(path)
    const { error } = await supabase.from('product_images').insert({
      product_id: productId, path, url: data.publicUrl, alt: file.name, position: index,
    })
    if (error) throw error
  }
}

export async function deleteProductImage(image: { id?: string; path?: string | null }) {
  if (image.path) await supabase.storage.from('product-images').remove([image.path])
  if (image.id) {
    const { error } = await supabase.from('product_images').delete().eq('id', image.id)
    if (error) throw error
  }
}

export async function saveDeliveryRates(rates: DeliveryRate[]) {
  const { error } = await supabase.from('delivery_rates').upsert(rates, { onConflict: 'wilaya_code' })
  if (error) throw error
}

export async function getProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as Profile[]
}

export async function manageUser(action: 'create' | 'update' | 'delete', payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body: { action, ...payload } })
  if (error) throw error
  return data
}

export async function getAnalytics(products: Product[]): Promise<AnalyticsSummary> {
  const since = new Date(Date.now() - 30 * 86400000).toISOString()
  const [{ data: events }, { data: orders }] = await Promise.all([
    supabase.from('analytics_events').select('event_type').gte('created_at', since),
    supabase.from('orders').select('total,status').gte('created_at', since),
  ])
  const eventList = events || []
  const orderList = orders || []
  return {
    views: eventList.filter((event) => event.event_type === 'page_view').length,
    productViews: eventList.filter((event) => event.event_type === 'product_view').length,
    addToCart: eventList.filter((event) => event.event_type === 'add_to_cart').length,
    orders: orderList.length,
    revenue: orderList.filter((order) => order.status !== 'annulee').reduce((sum, order) => sum + Number(order.total), 0),
    lowStock: products.filter((product) => product.stock <= 5).length,
  }
}
