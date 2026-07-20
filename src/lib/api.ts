import { defaultDeliveryRates } from '../data/algeria'
import { seedProducts } from '../data/seed'
import type { AnalyticsSummary, ContactMessage, DeliveryRate, Order, Product, Profile } from '../types'
import { isCloudinaryPath, uploadProductImage } from './cloudinary'
import { firebaseConfig, firebaseDb, isFirebaseActive } from './firebase'
import { isSupabaseConfigured, supabase } from './supabase'
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query as firebaseQuery, setDoc, updateDoc, where } from 'firebase/firestore'
import { getApp, getApps, initializeApp } from 'firebase/app'
import { createUserWithEmailAndPassword, getAuth, signOut as firebaseSignOut } from 'firebase/auth'

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

function normalizeCategory(value: unknown) {
  const category = String(value || '')
  if (category === 'Primer' || category === 'Fixateur') return 'Teint'

  // Older imported records lost the accented character in "Lèvres".
  if (category.replace(/\s+/g, '').toLowerCase() === 'lvres') return 'Lèvres'

  return category
}

const normalizeProduct = (row: Record<string, unknown>) => ({
  ...row,
  category: normalizeCategory(row.category),
  compare_at_price: row.compare_at_price == null ? null : Number(row.compare_at_price),
  product_images: Array.isArray(row.product_images) ? row.product_images : [],
  product_variants: Array.isArray(row.product_variants)
    ? row.product_variants.map((variant) => {
      const item = variant as Record<string, unknown>
      return { ...item, price: item.price == null ? null : Number(item.price), stock: Number(item.stock || 0) }
    })
    : [],
}) as Product

function firebaseRecord<T>(id: string, value: Record<string, unknown>): T {
  return { ...value, id } as T
}

function requireFirebase() {
  if (!firebaseDb) throw new Error('Firebase n’est pas configure.')
  return firebaseDb
}

function firebaseProduct(row: Record<string, unknown>, id: string): Product {
  return normalizeProduct(firebaseRecord<Record<string, unknown>>(id, row))
}

function orderNumber() {
  return `DG-${Date.now().toString().slice(-6)}`
}

export function getCachedProducts(admin = false): Product[] {
  const fallback = admin ? readCache<Product[]>(cacheKeys.publicProducts, seedProducts) : seedProducts
  const products = readCache<Product[]>(admin ? cacheKeys.adminProducts : cacheKeys.publicProducts, fallback)
  return products.map((product) => normalizeProduct(product as unknown as Record<string, unknown>)).filter((product) => admin || product.active)
}

export function getCachedProduct(slug: string): Product | null {
  return getCachedProducts(true).find((product) => product.slug === slug && product.active) || null
}

export async function getProducts(admin = false): Promise<Product[]> {
  if (isFirebaseActive) {
    try {
      const source = collection(requireFirebase(), 'products')
      const snapshot = await getDocs(admin ? firebaseQuery(source, orderBy('created_at')) : firebaseQuery(source, where('active', '==', true)))
      const products = snapshot.docs.map((item) => firebaseProduct(item.data(), item.id)).filter((product) => admin || product.active).sort((left, right) => String(left.created_at || '').localeCompare(String(right.created_at || '')))
      writeCache(admin ? cacheKeys.adminProducts : cacheKeys.publicProducts, products)
      if (admin) writeCache(cacheKeys.publicProducts, products.filter((product) => product.active))
      return products
    } catch { return getCachedProducts(admin) }
  }
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
  if (isFirebaseActive) {
    try {
      const snapshot = await getDocs(firebaseQuery(collection(requireFirebase(), 'products'), where('slug', '==', slug), where('active', '==', true), limit(1)))
      const item = snapshot.docs[0]
      if (!item) return null
      const product = firebaseProduct(item.data(), item.id)
      if (!product.active) return null
      const cached = getCachedProducts().filter((entry) => entry.id !== product.id)
      writeCache(cacheKeys.publicProducts, [...cached, product])
      return product
    } catch { return getCachedProduct(slug) }
  }
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
  if (isFirebaseActive) {
    try {
      const snapshot = await getDocs(firebaseQuery(collection(requireFirebase(), 'delivery_rates'), where('active', '==', true)))
      const rates = snapshot.docs.map((item) => firebaseRecord<DeliveryRate>(item.id, item.data())).filter((rate) => rate.active).sort((left, right) => left.wilaya_code.localeCompare(right.wilaya_code))
      const result = rates.length ? rates : defaultDeliveryRates
      writeCache(cacheKeys.deliveryRates, result)
      return result
    } catch { return getCachedDeliveryRates() }
  }
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
  if (isFirebaseActive) {
    try {
      await addDoc(collection(requireFirebase(), 'analytics_events'), {
        event_type: eventType, path: window.location.pathname, session_id: getSessionId(), metadata, created_at: new Date().toISOString(),
      })
    } catch { /* Analytics never blocks a customer action. */ }
    return
  }
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
  if (isFirebaseActive) {
    const items = Array.isArray(payload.items) ? payload.items : []
    const subtotal = items.reduce((sum, item) => sum + Number((item as Record<string, unknown>).unit_price || 0) * Number((item as Record<string, unknown>).quantity || 0), 0)
    const deliveryPrice = Number(payload.delivery_price || 0)
    const result = { ...payload, order_number: orderNumber(), subtotal, total: subtotal + deliveryPrice, status: 'nouvelle', created_at: new Date().toISOString(), order_items: items }
    const reference = await addDoc(collection(requireFirebase(), 'orders'), result)
    writeCache(cacheKeys.orders, [{ ...result, id: reference.id } as Order, ...getCachedOrders()])
    return { order_number: result.order_number }
  }
  if (!isSupabaseConfigured) return { order_number: `DG-${Date.now().toString().slice(-6)}` }
  const { data, error } = await supabase.rpc('place_order', { payload })
  if (error) throw error
  return data as { order_number: string }
}

export async function getOrders(): Promise<Order[]> {
  if (isFirebaseActive) {
    try {
      const snapshot = await getDocs(firebaseQuery(collection(requireFirebase(), 'orders'), orderBy('created_at', 'desc')))
      const orders = snapshot.docs.map((item) => firebaseRecord<Order>(item.id, item.data()))
      writeCache(cacheKeys.orders, orders)
      return orders
    } catch { return getCachedOrders() }
  }
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
  if (isFirebaseActive) {
    await updateDoc(doc(requireFirebase(), 'orders', id), updates)
    writeCache(cacheKeys.orders, getCachedOrders().map((order) => order.id === id ? { ...order, ...updates } : order))
    return
  }
  const { error } = await supabase.from('orders').update(updates).eq('id', id)
  if (error) throw error
  writeCache(cacheKeys.orders, getCachedOrders().map((order) => order.id === id ? { ...order, ...updates } : order))
}

export async function saveOrderItems(orderId: string, items: NonNullable<Order['order_items']>) {
  if (isFirebaseActive) {
    const subtotal = items.reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0)
    const current = getCachedOrders().find((order) => order.id === orderId)
    const total = subtotal + Number(current?.delivery_price || 0)
    await updateDoc(doc(requireFirebase(), 'orders', orderId), { order_items: items, subtotal, total })
    writeCache(cacheKeys.orders, getCachedOrders().map((order) => order.id === orderId ? { ...order, order_items: items, subtotal, total } : order))
    return { subtotal, total }
  }
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
  if (isFirebaseActive) {
    await deleteDoc(doc(requireFirebase(), 'orders', id))
    writeCache(cacheKeys.orders, getCachedOrders().filter((order) => order.id !== id))
    return
  }
  const { error } = await supabase.from('orders').delete().eq('id', id)
  if (error) throw error
  writeCache(cacheKeys.orders, getCachedOrders().filter((order) => order.id !== id))
}

export async function sendContactMessage(message: Omit<ContactMessage, 'id' | 'created_at'>) {
  await trackEvent('contact_message', message as unknown as Record<string, unknown>)
}

export async function getContactMessages(): Promise<ContactMessage[]> {
  if (isFirebaseActive) {
    const snapshot = await getDocs(collection(requireFirebase(), 'analytics_events'))
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Record<string, unknown>))
      .filter((item) => item.event_type === 'contact_message')
      .map((item) => ({ id: String(item.id), created_at: String(item.created_at || ''), ...(item.metadata as Omit<ContactMessage, 'id' | 'created_at'>) }))
      .sort((left, right) => right.created_at.localeCompare(left.created_at))
  }
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase.from('analytics_events').select('id,created_at,metadata').eq('event_type', 'contact_message').order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map((item) => ({ id: item.id, created_at: item.created_at, ...(item.metadata as Omit<ContactMessage, 'id' | 'created_at'>) }))
}

async function getAvailableProductSlug(baseSlug: string | undefined, productId?: string) {
  const base = baseSlug?.trim() || 'produit-' + Date.now().toString().slice(-6)
  let candidate = base
  let suffix = 2

  while (true) {
    if (isFirebaseActive) {
      const snapshot = await getDocs(firebaseQuery(collection(requireFirebase(), 'products'), where('slug', '==', candidate), limit(1)))
      const existing = snapshot.docs[0]
      if (!existing || existing.id === productId) return candidate
      candidate = base + '-' + suffix
      suffix += 1
      continue
    }
    const { data, error } = await supabase.from('products').select('id').eq('slug', candidate).maybeSingle()
    if (error) throw error
    if (!data || data.id === productId) return candidate
    candidate = base + '-' + suffix
    suffix += 1
  }
}

export async function saveProduct(product: Partial<Product>) {
  const slug = await getAvailableProductSlug(product.slug, product.id)
  const payload = {
    slug, name: product.name, brand: product.brand,
    category: product.category, description: product.description, details: product.details,
    price: product.price, compare_at_price: product.compare_at_price, stock: product.stock, accent: product.accent, active: product.active, featured: product.featured,
  }
  if (isFirebaseActive) {
    const id = product.id || crypto.randomUUID()
    const existing = product.id ? await getDoc(doc(requireFirebase(), 'products', id)) : null
    const product_images = product.product_images || (existing?.data()?.product_images as Product['product_images'] | undefined) || []
    const product_variants = (product.product_variants || []).map((variant) => ({ ...variant, id: variant.id || crypto.randomUUID() }))
    const created_at = existing?.data()?.created_at || new Date().toISOString()
    await setDoc(doc(requireFirebase(), 'products', id), { ...payload, product_images, product_variants, created_at }, { merge: true })
    localStorage.removeItem(cacheKeys.publicProducts)
    localStorage.removeItem(cacheKeys.adminProducts)
    return { ...payload, id, product_images, product_variants, created_at } as Product
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
  if (isFirebaseActive) {
    await deleteDoc(doc(requireFirebase(), 'products', id))
    localStorage.removeItem(cacheKeys.publicProducts)
    localStorage.removeItem(cacheKeys.adminProducts)
    return
  }
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
  localStorage.removeItem(cacheKeys.publicProducts)
  localStorage.removeItem(cacheKeys.adminProducts)
}

export async function uploadProductImages(productId: string, files: File[]) {
  if (isFirebaseActive) {
    const reference = doc(requireFirebase(), 'products', productId)
    const existing = await getDoc(reference)
    const current = (existing.data()?.product_images || []) as Product['product_images']
    const images = await Promise.all(files.map(async (file, index) => {
      const image = await uploadProductImage(file)
      return { id: crypto.randomUUID(), path: image.path, url: image.url, alt: file.name, position: current.length + index }
    }))
    await updateDoc(reference, { product_images: [...current, ...images] })
    return
  }
  for (const [index, file] of files.entries()) {
    const image = await uploadProductImage(file)
    const { error } = await supabase.from('product_images').insert({
      product_id: productId, path: image.path, url: image.url, alt: file.name, position: index,
    })
    if (error) throw error
  }
}

export async function uploadProductVariantImage(productId: string, variantValue: string, file: File, previousPath?: string | null) {
  const image = await uploadProductImage(file)
  if (isFirebaseActive) {
    const reference = doc(requireFirebase(), 'products', productId)
    const existing = await getDoc(reference)
    const variants = ((existing.data()?.product_variants || []) as Product['product_variants']).map((variant) => variant.value === variantValue ? { ...variant, image_url: image.url, image_path: image.path } : variant)
    await updateDoc(reference, { product_variants: variants })
    return { image_url: image.url, image_path: image.path }
  }
  const { error } = await supabase.from('product_variants').update({ image_url: image.url, image_path: image.path }).eq('product_id', productId).eq('value', variantValue)
  if (error) {
    throw error
  }
  if (previousPath && !isCloudinaryPath(previousPath)) {
    await supabase.storage.from('product-images').remove([previousPath]).catch(() => undefined)
  }
  return { image_url: image.url, image_path: image.path }
}

export async function deleteProductImage(productId: string, image: { id?: string; path?: string | null }) {
  if (isFirebaseActive) {
    const reference = doc(requireFirebase(), 'products', productId)
    const existing = await getDoc(reference)
    const images = ((existing.data()?.product_images || []) as Product['product_images']).filter((item) => item.id !== image.id && item.url !== (image as Product['product_images'][number]).url)
    await updateDoc(reference, { product_images: images })
    return
  }
  if (image.id) {
    const { error } = await supabase.from('product_images').delete().eq('id', image.id)
    if (error) throw error
  }
  if (image.path && !isCloudinaryPath(image.path)) {
    await supabase.storage.from('product-images').remove([image.path]).catch(() => undefined)
  }
}

export async function saveDeliveryRates(rates: DeliveryRate[]) {
  if (isFirebaseActive) {
    await Promise.all(rates.map((rate) => setDoc(doc(requireFirebase(), 'delivery_rates', rate.wilaya_code), rate)))
    writeCache(cacheKeys.deliveryRates, rates)
    return
  }
  const { error } = await supabase.from('delivery_rates').upsert(rates, { onConflict: 'wilaya_code' })
  if (error) throw error
  writeCache(cacheKeys.deliveryRates, rates)
}

export async function getProfiles(): Promise<Profile[]> {
  if (isFirebaseActive) {
    try {
      const snapshot = await getDocs(firebaseQuery(collection(requireFirebase(), 'profiles'), orderBy('created_at', 'desc')))
      const profiles = snapshot.docs.map((item) => firebaseRecord<Profile>(item.id, item.data()))
      writeCache(cacheKeys.profiles, profiles)
      return profiles
    } catch { return getCachedProfiles() }
  }
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
  if (isFirebaseActive) {
    const database = requireFirebase()
    if (action === 'create') {
      const user = payload.user as { email: string; password: string; full_name: string; role: Profile['role'] }
      const name = `divine-glow-user-creation-${Date.now()}`
      const secondary = getApps().find((app) => app.name === name) || initializeApp(firebaseConfig, name)
      const secondaryAuth = getAuth(secondary)
      const credential = await createUserWithEmailAndPassword(secondaryAuth, user.email.trim(), user.password)
      await firebaseSignOut(secondaryAuth)
      const profile: Profile = { id: credential.user.uid, email: user.email.trim(), full_name: user.full_name.trim(), role: user.role, active: true, created_at: new Date().toISOString() }
      await setDoc(doc(database, 'profiles', profile.id), profile)
      localStorage.removeItem(cacheKeys.profiles)
      return profile
    }
    const userId = String(payload.user_id || '')
    if (!userId) throw new Error('Utilisateur introuvable.')
    if (action === 'delete') await deleteDoc(doc(database, 'profiles', userId))
    else await updateDoc(doc(database, 'profiles', userId), payload.user || {})
    localStorage.removeItem(cacheKeys.profiles)
    return { id: userId }
  }
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
  if (isFirebaseActive) {
    try {
      const since = new Date(Date.now() - 30 * 86400000).toISOString()
      const [eventSnapshot, orderSnapshot] = await Promise.all([
        getDocs(firebaseQuery(collection(requireFirebase(), 'analytics_events'), where('created_at', '>=', since))),
        getDocs(firebaseQuery(collection(requireFirebase(), 'orders'), where('created_at', '>=', since))),
      ])
      const events = eventSnapshot.docs.map((item) => item.data())
      const orders = orderSnapshot.docs.map((item) => item.data() as Order)
      return {
        views: events.filter((event) => event.event_type === 'page_view').length,
        productViews: events.filter((event) => event.event_type === 'product_view').length,
        addToCart: events.filter((event) => event.event_type === 'add_to_cart').length,
        orders: orders.length,
        revenue: orders.filter((order) => order.status !== 'annulee').reduce((sum, order) => sum + Number(order.total), 0),
        lowStock: products.filter((product) => product.stock <= 5).length,
      }
    } catch { return { views: 0, productViews: 0, addToCart: 0, orders: 0, revenue: 0, lowStock: products.filter((product) => product.stock <= 5).length } }
  }
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
