import { readFile } from 'node:fs/promises'

const required = (name) => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

const sourceFile = process.env.ORDERS_FILE || 'tmp/old-supabase-orders.json'
const url = required('SUPABASE_URL').replace(/\/$/, '')
const anonKey = required('SUPABASE_ANON_KEY')
const email = required('SUPABASE_ADMIN_EMAIL')
const password = required('SUPABASE_ADMIN_PASSWORD')
const oldOrders = JSON.parse((await readFile(sourceFile, 'utf8')).replace(/^\uFEFF/, ''))

const authResponse = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: anonKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
})
if (!authResponse.ok) throw new Error(`Admin authentication failed: ${authResponse.status}`)
const { access_token: accessToken } = await authResponse.json()
const headers = {
  apikey: anonKey,
  Authorization: `Bearer ${accessToken}`,
  Prefer: 'resolution=merge-duplicates,return=minimal',
  'Content-Type': 'application/json',
}

const orders = oldOrders.map(({ order_items: _items, ...order }) => order)
const items = oldOrders.flatMap((order) => (order.order_items || []).map(({ product_id: _productId, variant_id: _variantId, ...item }) => ({
  ...item,
  order_id: order.id,
  product_id: null,
  variant_id: null,
})))

const insert = async (table, records) => {
  const response = await fetch(`${url}/rest/v1/${table}?on_conflict=id`, {
    method: 'POST', headers, body: JSON.stringify(records),
  })
  if (!response.ok) throw new Error(`${table} import failed: ${response.status} ${await response.text()}`)
}

await insert('orders', orders)
await insert('order_items', items)
console.log(JSON.stringify({ orders: orders.length, items: items.length }))
