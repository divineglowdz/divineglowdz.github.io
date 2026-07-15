import { defaultDeliveryRates } from '../data/algeria'
import { seedProducts } from '../data/seed'
import type { AnalyticsSummary, DeliveryRate, Order, Product, Profile } from '../types'
import { isSupabaseConfigured, supabase } from './supabase'

const cacheKeys = {
  publicProducts: 'divine-glow-products-public-v5',
  adminProducts: 'divine-glow-products-admin-v5',
  deliveryRates: 'divine-glow-delivery-rates-v1',
  orders: 'divine-glow-orders-v1',
  profiles: 'divine-glow-profiles-v1',
}

function readCache<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) as T : fallback
  } catch { return fallback }
}

function writeCache(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Storage can be unavailable in private mode. */ }
}

const normalizeProduct = (row: Record<string, unknown>) => ({
  ...row,
  category: row.category === 'Primer' || row.category === 'Fixateur' ? 'Teint' : row.category,
  compare_at_price: row.compare_at_price == null ? null : Number(row.compare_at_price),
  product_images: Array.isArray(row.product_images) ? row.product_images : [],
  product_variants: Array.isArray(row.product_variants)
    ? row.product_variants.map((variant) => {
      const item = variant as Record<string, unknown>
      return { ...item, price: item.price == null ? null : Number(item.price), stock: Number(item.stock || 0) }
    })
    : [],
}) as Product

export function getCachedProducts(admin = false): Product[] {
  const fallback = admin ? readCache<Product[]>(cacheKeys.publicProducts, seedProducts) : seedProducts
  const products = readCache<Product[]>(admin ? cacheKeys.adminProducts : cacheKeys.publicProducts, fallback)
  return products.map((product) => normalizeProduct(product as unknown as Record<string, unknown>)).filter((product) => admin || product.active)
}

export function getCachedProduct(slug: string): Product | null {
  return getCachedProducts(true).find((product) => product.slug === slug && product.active) || null
}

export async function getProducts(admin = false): Promise<Product[]> {
  if (!isSupabaseConfigured) return getCachedProducts(admin)
  let query = supabase.from('products').select('*, product_images(*), product_variants(*)').order('created_at')
  if (!admin) query = query.eq('active', true)
  const { data, error } = await query
  if (error) return getCachedProducts(admin)
  const products = (data || []).map((row) => normalizeProduct(row))
  writeCache(admin ? cacheKeys.adminProducts : cacheKeys.publicProducts, products)
  if (admin) writeCache(cacheKeys.publicProducts, products.filter((product) => product.active))
  return products
}

export async function getProduct(slug: string): Promise<Product | null> {
  if (!isSupabaseConfigured) return getCachedProduct(slug)
  const { data, error } = await supabase
    .from('products').select('*, product_images(*), product_variants(*)').eq('slug', slug).eq('active', true).maybeSingle()
  if (error) return getCachedProduct(slug)
  if (!data) return null
  const product = normalizeProduct(data)
  const cached = getCachedProducts().filter((item) => item.id !== product.id)
  writeCache(cacheKeys.publicProducts, [...cached, product])
  return product
}

export async function getDeliveryRates(): Promise<DeliveryRate[]> {
  if (!isSupabaseConfigured) return getCachedDeliveryRates()
  const { data, error } = await supabase.from('delivery_rates').select('*').order('wilaya_code')
  if (error) return getCachedDeliveryRates()
  const rates = data?.length ? data : defaultDeliveryRates
  writeCache(cacheKeys.deliveryRates, rates)
  return rates
}

export function getCachedDeliveryRates(): DeliveryRate[] {
  return readCache<DeliveryRate[]>(cacheKeys.deliveryRates, defaultDeliveryRates)
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
  if (error) return getCachedOrders()
  const orders = (data || []) as Order[]
  writeCache(cacheKeys.orders, orders)
  return orders
}

export function getCachedOrders(): Order[] {
  return readCache<Order[]>(cacheKeys.orders, [])
}

export async function saveOrder(id: string, updates: Partial<Order>) {
  const { error } = await supabase.from('orders').update(updates).eq('id', id)
  if (error) throw error
  writeCache(cacheKeys.orders, getCachedOrders().map((order) => order.id === id ? { ...order, ...updates } : order))
}

export async function saveOrderItems(orderId: string, items: NonNullable<Order['order_items']>) {
  const payload = items.map((item) => ({
    product_id: item.product_id,
    variant_id: item.variant_id || null,
    quantity: item.quantity,
    unit_price: item.unit_price,
  }))
  const { data, error } = await supabase.rpc('admin_update_order_items', { target_order_id: orderId, items: payload })
  if (error) throw error
  localStorage.removeItem(cacheKeys.orders)
  localStorage.removeItem(cacheKeys.publicProducts)
  localStorage.removeItem(cacheKeys.adminProducts)
  return data as { subtotal: number; total: number }
}

export async function deleteOrder(id: string) {
  const { error } = await supabase.from('orders').delete().eq('id', id)
  if (error) throw error
  writeCache(cacheKeys.orders, getCachedOrders().filter((order) => order.id !== id))
}

export async function saveProduct(product: Partial<Product>) {
  const payload = {
    slug: product.slug, name: product.name, brand: product.brand,
    category: product.category, description: product.description, details: product.details,
    price: product.price, compare_at_price: product.compare_at_price, stock: product.stock, accent: product.accent, active: product.active, featured: product.featured,
  }
  const request = product.id
    ? supabase.from('products').update(payload).eq('id', product.id)
    : supabase.from('products').insert(payload)
  const { data, error } = await request.select().single()
  if (error) throw error

  if (product.product_variants) {
    const { error: deleteError } = await supabase.from('product_variants').delete().eq('product_id', data.id)
    if (deleteError) throw deleteError
    const variants = product.product_variants.map((variant) => ({
      product_id: data.id,
      name: variant.name || 'Teinte',
      value: variant.value.trim(),
      color_hex: variant.color_hex || null,
      image_url: variant.image_url || null,
      image_path: variant.image_path || null,
      price: variant.price ?? null,
      stock: Number(variant.stock) || 0,
      active: variant.active !== false,
    }))
    if (variants.length) {
      const { error: variantError } = await supabase.from('product_variants').insert(
        variants,
      )
      if (variantError) throw variantError
    }
  }
  localStorage.removeItem(cacheKeys.publicProducts)
  localStorage.removeItem(cacheKeys.adminProducts)
  return data as Product
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
  localStorage.removeItem(cacheKeys.publicProducts)
  localStorage.removeItem(cacheKeys.adminProducts)
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

export async function uploadProductVariantImage(productId: string, variantValue: string, file: File, previousPath?: string | null) {
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-')
  const path = `${productId}/variants/${crypto.randomUUID()}-${safeName}`
  const { error: uploadError } = await supabase.storage.from('product-images').upload(path, file)
  if (uploadError) throw uploadError
  const { data } = supabase.storage.from('product-images').getPublicUrl(path)
  const { error } = await supabase.from('product_variants').update({ image_url: data.publicUrl, image_path: path }).eq('product_id', productId).eq('value', variantValue)
  if (error) {
    await supabase.storage.from('product-images').remove([path])
    throw error
  }
  if (previousPath) await supabase.storage.from('product-images').remove([previousPath])
  return { image_url: data.publicUrl, image_path: path }
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
  writeCache(cacheKeys.deliveryRates, rates)
}

export async function getProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
  if (error) return getCachedProfiles()
  const profiles = (data || []) as Profile[]
  writeCache(cacheKeys.profiles, profiles)
  return profiles
}

export function getCachedProfiles(): Profile[] {
  return readCache<Profile[]>(cacheKeys.profiles, [])
}

export async function manageUser(action: 'create' | 'update' | 'delete', payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body: { action, ...payload } })
  if (error) {
    let message = error.message
    const response = (error as { context?: Response }).context
    if (response) {
      try {
        const body = await response.clone().json() as { error?: string }
        if (body.error) message = body.error
      } catch { /* Keep the original function error. */ }
    }
    throw new Error(message)
  }
  localStorage.removeItem(cacheKeys.profiles)
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
