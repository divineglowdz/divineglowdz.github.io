import { createClient } from '@supabase/supabase-js'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { doc, getFirestore, setDoc } from 'firebase/firestore'

const required = (name) => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required.`)
  return value
}

const supabase = createClient(required('SUPABASE_URL'), required('SUPABASE_ANON_KEY'))
const app = initializeApp({
  apiKey: required('FIREBASE_API_KEY'),
  authDomain: required('FIREBASE_AUTH_DOMAIN'),
  projectId: required('FIREBASE_PROJECT_ID'),
  appId: required('FIREBASE_APP_ID'),
})
const auth = getAuth(app)
const database = getFirestore(app)

function clean(value) {
  if (Array.isArray(value)) return value.map(clean)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, clean(item)]))
  return value
}

async function copyCollection(name, rows, idFor) {
  for (const row of rows) {
    await setDoc(doc(database, name, idFor(row)), clean(row))
  }
}

await signInWithEmailAndPassword(auth, required('FIREBASE_ADMIN_EMAIL'), required('FIREBASE_ADMIN_PASSWORD'))

const [{ data: products, error: productsError }, { data: deliveryRates, error: deliveryError }] = await Promise.all([
  supabase.from('products').select('*, product_images(*), product_variants(*)').order('created_at'),
  supabase.from('delivery_rates').select('*').order('wilaya_code'),
])

if (productsError) throw productsError
if (deliveryError) throw deliveryError

await copyCollection('products', products || [], (row) => row.id)
await copyCollection('delivery_rates', deliveryRates || [], (row) => row.wilaya_code)

console.log(JSON.stringify({ products: products?.length || 0, delivery_rates: deliveryRates?.length || 0 }))
