import { defaultDeliveryRates } from '../data/algeria'
import { seedProducts } from '../data/seed'
import type { AnalyticsSummary, ContactMessage, DeliveryRate, Order, Product, Profile } from '../types'
import { isCloudinaryPath, uploadProductImage } from './cloudinary'
import { firebaseAuth, firebaseConfig, firebaseDb, isFirebaseActive } from './firebase'
import { isSupabaseConfigured, supabase } from './supabase'
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query as firebaseQuery, runTransaction, setDoc, updateDoc, where } from 'firebase/firestore'
import { getApp, getApps, initializeApp } from 'firebase/app'
import { createUserWithEmailAndPassword, getAuth, signInAnonymously, signOut as firebaseSignOut } from 'firebase/auth'

const cacheKeys = {
  publicProducts: 'divine-glow-products-public-v5',
  adminProducts: 'divine-glow-products-admin-v5',
  deliveryRates: 'divine-glow-delivery-rates-v1',
  orders: 'divine-glow-orders-v1',
  profiles: 'divine-glow-profiles-v1',
}

const cacheLifetime = {
  products: 15 * 60 * 1000,
  deliveryRates: 24 * 60 * 60 * 1000,
}

function readCache<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) as T : fallback
  } catch { return fallback }
}

function writeCache(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    localStorage.setItem(`${key}:updated-at`, String(Date.now()))
  } catch { /* Storage can be unavailable in private mode. */ }
}

function isCacheFresh(key: string, lifetime: number) {
  try {
    const updatedAt = Number(localStorage.getItem(`${key}:updated-at`) || 0)
    return Boolean(localStorage.getItem(key)) && updatedAt > 0 && Date.now() - updatedAt < lifetime
  } catch {
    return false
  }
}

function withoutUndefined<T>(value: T): T {
  if (value === undefined) return null as T
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((item) => withoutUndefined(item)) as T
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, withoutUndefined(item)]),
  ) as T
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

const publicCatalogReference = () => doc(requireFirebase(), 'public_catalog', 'main')

type PublicCatalog = { products: Product[]; deliveryRates: DeliveryRate[] }

async function getPublicCatalog(): Promise<PublicCatalog | null> {
  try {
    const snapshot = await getDoc(publicCatalogReference())
    const data = snapshot.data()
    if (!Array.isArray(data?.products)) return null
    return {
      products: data.products.map((product) => normalizeProduct(product as Record<string, unknown>)),
      deliveryRates: Array.isArray(data.delivery_rates)
        ? data.delivery_rates.map((rate) => rate as DeliveryRate)
        : [],
    }
  } catch {
    return null
  }
}

async function syncPublicCatalog(products: Product[]) {
  const ratesSnapshot = await getDocs(collection(requireFirebase(), 'delivery_rates'))
  const delivery_rates = ratesSnapshot.docs.map((item) => firebaseRecord<DeliveryRate>(item.id, item.data()))
  await setDoc(publicCatalogReference(), withoutUndefined({
    products,
    delivery_rates,
    updated_at: new Date().toISOString(),
  }))
}

async function syncPublicCatalogFromDatabase() {
  const snapshot = await getDocs(firebaseQuery(collection(requireFirebase(), 'products'), orderBy('created_at')))
  await syncPublicCatalog(snapshot.docs.map((item) => firebaseProduct(item.data(), item.id)))
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
    const key = admin ? cacheKeys.adminProducts : cacheKeys.publicProducts
    if (!admin && isCacheFresh(key, cacheLifetime.products)) return getCachedProducts()
    try {
      if (!admin) {
        const catalog = await getPublicCatalog()
        if (catalog) {
          const products = catalog.products.filter((product) => product.active)
          writeCache(cacheKeys.publicProducts, products)
          return products
        }
        return getCachedProducts()
      }
      const source = collection(requireFirebase(), 'products')
      const snapshot = await getDocs(admin ? firebaseQuery(source, orderBy('created_at')) : firebaseQuery(source, where('active', '==', true)))
      const products = snapshot.docs.map((item) => firebaseProduct(item.data(), item.id)).filter((product) => admin || product.active).sort((left, right) => String(left.created_at || '').localeCompare(String(right.created_at || '')))
      writeCache(admin ? cacheKeys.adminProducts : cacheKeys.publicProducts, products)
      if (admin) writeCache(cacheKeys.publicProducts, products.filter((product) => product.active))
      if (admin) void syncPublicCatalog(products).catch(() => undefined)
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
    const cachedProduct = getCachedProduct(slug)
    if (cachedProduct && isCacheFresh(cacheKeys.publicProducts, cacheLifetime.products)) return cachedProduct
    try {
      const catalog = await getPublicCatalog()
      if (catalog) {
        writeCache(cacheKeys.publicProducts, catalog.products.filter((product) => product.active))
        return catalog.products.find((product) => product.slug === slug && product.active) || null
      }
      return cachedProduct
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

export async function getDeliveryRates(admin = false): Promise<DeliveryRate[]> {
  if (isFirebaseActive) {
    if (!admin && isCacheFresh(cacheKeys.deliveryRates, cacheLifetime.deliveryRates)) return getCachedDeliveryRates()
    try {
      if (!admin) {
        const catalog = await getPublicCatalog()
        if (catalog?.deliveryRates.length) {
          const rates = catalog.deliveryRates.filter((rate) => rate.active).sort((left, right) => left.wilaya_code.localeCompare(right.wilaya_code))
          writeCache(cacheKeys.deliveryRates, rates)
          return rates
        }
        return getCachedDeliveryRates()
      }
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
  if (eventType !== 'contact_message') return
  if (isFirebaseActive) {
    try {
      await addDoc(collection(requireFirebase(), 'analytics_events'), {
        event_type: eventType, path: window.location.pathname, session_id: getSessionId(), metadata: withoutUndefined(metadata), created_at: new Date().toISOString(),
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
    try {
      const items = Array.isArray(payload.items) ? payload.items : []
      const result = await reserveFirestoreOrder(withoutUndefined({ ...payload, items }))
      localStorage.removeItem(cacheKeys.publicProducts)
      localStorage.removeItem(cacheKeys.adminProducts)
      return result
    } catch (reason) {
      const code = String((reason as { code?: string })?.code || '')
      if (code === 'resource-exhausted' || code === 'auth/quota-exceeded') {
        throw new Error('La boutique est momentanement tres sollicitee. Reessayez un peu plus tard.')
      }
      throw reason
    }
  }
  if (!isSupabaseConfigured) return { order_number: `DG-${Date.now().toString().slice(-6)}` }
  const { data, error } = await supabase.rpc('place_order', { payload })
  if (error) throw error
  return data as { order_number: string }
}

async function reserveFirestoreOrder(payload: Record<string, unknown>): Promise<{ order_number: string }> {
  const rawItems = Array.isArray(payload.items) ? payload.items : []
  if (!rawItems.length || rawItems.length > 20) throw new Error('Votre panier est invalide.')

  const requests = new Map<string, { productId: string; variantId: string | null; quantity: number }>()
  for (const rawItem of rawItems) {
    const item = rawItem as Record<string, unknown>
    const productId = String(item.product_id || '')
    const variantId = item.variant_id ? String(item.variant_id) : null
    const quantity = Number(item.quantity || 0)
    if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error('Une quantite est invalide.')
    const key = `${productId}:${variantId || 'product'}`
    const current = requests.get(key)
    requests.set(key, { productId, variantId, quantity: (current?.quantity || 0) + quantity })
  }

  if (!firebaseAuth) throw new Error('Le service de commande n est pas configure.')
  if (!firebaseAuth.currentUser) await signInAnonymously(firebaseAuth)
  const database = requireFirebase()
  const result = await runTransaction(database, async (transaction) => {
    const grouped = new Map<string, { total: number; variants: Map<string, number> }>()
    for (const request of requests.values()) {
      const current = grouped.get(request.productId) || { total: 0, variants: new Map<string, number>() }
      current.total += request.quantity
      if (request.variantId) current.variants.set(request.variantId, (current.variants.get(request.variantId) || 0) + request.quantity)
      grouped.set(request.productId, current)
    }

    const entries = [...grouped.entries()]
    const references = entries.map(([productId]) => doc(database, 'products', productId))
    const snapshots = await Promise.all(references.map((reference) => transaction.get(reference)))
    const orderItems: NonNullable<Order['order_items']> = []
    let subtotal = 0

    for (const [index, [productId, requested]] of entries.entries()) {
      const snapshot = snapshots[index]
      if (!snapshot.exists()) throw new Error('Un produit de votre panier n est plus disponible.')
      const product = firebaseProduct(snapshot.data(), productId)
      if (!product.active || product.stock < requested.total) throw new Error(`${product.name} n a plus assez de stock.`)
      const variants = product.product_variants.map((variant) => ({ ...variant }))
      if (variants.length && requested.variants.size !== requestsForProduct(requests, productId).length) throw new Error(`Choisissez une teinte pour ${product.name}.`)

      for (const [variantId, quantity] of requested.variants) {
        const variant = variants.find((candidate) => candidate.id === variantId)
        if (!variant || variant.active === false || variant.stock < quantity) throw new Error(`La teinte choisie pour ${product.name} est epuisee.`)
        variant.stock -= quantity
      }

      for (const request of requestsForProduct(requests, productId)) {
        const variant = request.variantId ? variants.find((candidate) => candidate.id === request.variantId) : undefined
        const unitPrice = variant?.price == null ? product.price : variant.price
        orderItems.push({ product_id: product.id, product_name: product.name, variant_id: variant?.id || undefined, variant_name: variant?.value || undefined, quantity: request.quantity, unit_price: unitPrice })
        subtotal += unitPrice * request.quantity
      }

      transaction.update(references[index], { stock: product.stock - requested.total, product_variants: variants })
    }

    const deliveryPrice = Math.max(0, Number(payload.delivery_price || 0))
    const order = withoutUndefined({ ...payload, items: orderItems, order_number: orderNumber(), subtotal, total: subtotal + deliveryPrice, status: 'nouvelle', created_at: new Date().toISOString(), order_items: orderItems })
    const orderReference = doc(collection(database, 'orders'))
    transaction.set(orderReference, order)
    return { order_number: order.order_number }
  })

  return result
}

function requestsForProduct(requests: Map<string, { productId: string; variantId: string | null; quantity: number }>, productId: string) {
  return [...requests.values()].filter((request) => request.productId === productId)
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
    const cleanUpdates = withoutUndefined(updates)
    await updateDoc(doc(requireFirebase(), 'orders', id), cleanUpdates)
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
    await updateDoc(doc(requireFirebase(), 'orders', orderId), withoutUndefined({ order_items: items, subtotal, total }))
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

async function validateFirebaseOrderStock(items: unknown[]) {
  const requested = new Map<string, { quantity: number; variantId: string | null; productName: string }>()
  for (const item of items) {
    const row = item as Record<string, unknown>
    const productId = String(row.product_id || '')
    const variantId = row.variant_id ? String(row.variant_id) : null
    const quantity = Number(row.quantity || 0)
    if (!productId || !Number.isInteger(quantity) || quantity < 1) throw new Error('La quantité d’un article est invalide.')
    const key = `${productId}:${variantId || 'product'}`
    const current = requested.get(key)
    requested.set(key, { quantity: (current?.quantity || 0) + quantity, variantId, productName: String(row.product_name || 'Ce produit') })
  }

  const database = requireFirebase()
  await Promise.all([...requested.entries()].map(async ([key, item]) => {
    const productId = key.slice(0, key.indexOf(':'))
    const snapshot = await getDoc(doc(database, 'products', productId))
    if (!snapshot.exists()) throw new Error(`${item.productName} n’est plus disponible.`)
    const product = firebaseProduct(snapshot.data(), snapshot.id)
    if (!product.active) throw new Error(`${product.name} n’est plus disponible.`)
    const variant = item.variantId ? product.product_variants.find((candidate) => candidate.id === item.variantId) : undefined
    if (item.variantId && (!variant || variant.active === false)) throw new Error(`L’option sélectionnée pour ${product.name} n’est plus disponible.`)
    const stock = variant ? variant.stock : product.stock
    if (stock < item.quantity) throw new Error(`${product.name} n’a plus assez de stock. Ajustez votre panier puis réessayez.`)
  }))
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
    await setDoc(doc(requireFirebase(), 'products', id), withoutUndefined({ ...payload, product_images, product_variants, created_at }), { merge: true })
    await syncPublicCatalogFromDatabase().catch(() => undefined)
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
    await syncPublicCatalogFromDatabase().catch(() => undefined)
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
    await syncPublicCatalogFromDatabase().catch(() => undefined)
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
    await syncPublicCatalogFromDatabase().catch(() => undefined)
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
    await syncPublicCatalogFromDatabase().catch(() => undefined)
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
    await syncPublicCatalogFromDatabase().catch(() => undefined)
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
