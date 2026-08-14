import { createHash, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const required = (name) => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

const url = required('SUPABASE_URL').replace(/\/$/, '')
const anonKey = required('SUPABASE_ANON_KEY')
const email = required('SUPABASE_ADMIN_EMAIL')
const password = required('SUPABASE_ADMIN_PASSWORD')
const oldOrders = JSON.parse((await readFile(process.env.ORDERS_FILE || 'tmp/old-supabase-orders.json', 'utf8')).replace(/^\uFEFF/, ''))

const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
})
if (!login.ok) throw new Error(`Admin authentication failed: ${login.status}`)
const { access_token: accessToken } = await login.json()
const headers = { apikey: anonKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
const request = async (path, options = {}) => {
  const response = await fetch(`${url}${path}`, { ...options, headers: { ...headers, ...options.headers } })
  if (!response.ok) throw new Error(`${path} failed: ${response.status} ${await response.text()}`)
  const text = await response.text()
  return text ? JSON.parse(text) : null
}
const archiveSlug = (value) => `historique-${createHash('sha256').update(value).digest('hex').slice(0, 24)}`

const existing = await request('/rest/v1/orders?select=order_number')
const existingNumbers = new Set(existing.map((order) => order.order_number))
const ordersToRestore = oldOrders.filter((order) => !existingNumbers.has(order.order_number))
const allItems = ordersToRestore.flatMap((order) => order.order_items || [])
const names = [...new Set(allItems.map((item) => item.product_name))]
const productMap = new Map()

for (const name of names) {
  const slug = archiveSlug(name)
  let [product] = await request(`/rest/v1/products?select=id&slug=eq.${encodeURIComponent(slug)}&limit=1`)
  if (!product) {
    const inserted = await request('/rest/v1/products', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ id: randomUUID(), slug, name, brand: 'Archive Divine Glow', category: 'Historique', description: '', details: '', price: 0, stock: 100000, accent: '#6f6a63', active: false, featured: false }),
    })
    product = inserted[0]
  }
  productMap.set(name, product.id)
}

const variantMap = new Map()
for (const item of allItems.filter((entry) => entry.variant_name)) {
  const key = `${item.product_name}\u0000${item.variant_name}`
  if (variantMap.has(key)) continue
  const productId = productMap.get(item.product_name)
  let [variant] = await request(`/rest/v1/product_variants?select=id&product_id=eq.${productId}&value=eq.${encodeURIComponent(item.variant_name)}&limit=1`)
  if (!variant) {
    const inserted = await request('/rest/v1/product_variants', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ id: randomUUID(), product_id: productId, name: 'Teinte', value: item.variant_name, stock: 100000, active: true }),
    })
    variant = inserted[0]
  }
  variantMap.set(key, variant.id)
}

const dummyId = 'f0000000-0000-4000-8000-000000000001'
const [dummy] = await request(`/rest/v1/products?select=id&slug=eq.historique-commande-temporaire&limit=1`)
if (!dummy) {
  await request('/rest/v1/products', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ id: dummyId, slug: 'historique-commande-temporaire', name: 'Archive commande', brand: 'Archive Divine Glow', category: 'Historique', description: '', details: '', price: 0, stock: 100000, accent: '#6f6a63', active: true, featured: false }),
  })
}

for (const order of ordersToRestore) {
  const payload = {
    customer_name: order.customer_name, phone: order.phone, wilaya_code: order.wilaya_code, wilaya_name: order.wilaya_name,
    commune: order.commune, address: order.address, delivery_type: order.delivery_type, notes: order.notes || '',
    items: [{ product_id: dummyId, quantity: 1 }],
  }
  const created = await request('/rest/v1/rpc/place_order', { method: 'POST', body: JSON.stringify({ payload }) })
  const replacementItems = (order.order_items || []).map((item) => ({
    product_id: productMap.get(item.product_name),
    variant_id: item.variant_name ? variantMap.get(`${item.product_name}\u0000${item.variant_name}`) : null,
    quantity: item.quantity,
    unit_price: item.unit_price,
  }))
  await request('/rest/v1/rpc/admin_update_order_items', { method: 'POST', body: JSON.stringify({ target_order_id: created.id, items: replacementItems }) })
  await request(`/rest/v1/orders?id=eq.${created.id}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ order_number: order.order_number, customer_name: order.customer_name, phone: order.phone, wilaya_code: order.wilaya_code, wilaya_name: order.wilaya_name, commune: order.commune, address: order.address, delivery_type: order.delivery_type, delivery_price: order.delivery_price, subtotal: order.subtotal, total: order.total, status: order.status, notes: order.notes || '', created_at: order.created_at }),
  })
}

await request('/rest/v1/products?slug=eq.historique-commande-temporaire', { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ active: false }) })
console.log(JSON.stringify({ restored: ordersToRestore.length, items: allItems.length }))
