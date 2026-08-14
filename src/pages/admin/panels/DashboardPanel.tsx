import { ArrowUpRight, PackageSearch, ShoppingCart, TrendingUp } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatPrice } from '../../../components/ProductCard'
import { getCachedOrders, getCachedProducts, getOrders, getProducts } from '../../../lib/api'
import { isFirebaseActive } from '../../../lib/firebase'
import { isSupabaseConfigured } from '../../../lib/supabase'
import type { Order, Product } from '../../../types'

const cachedProducts = getCachedProducts(true)
const cachedOrders = getCachedOrders()
type DashboardSummary = { orders: number; revenue: number; lowStock: number }
const makeSummary = (orders: Order[], products: Product[]): DashboardSummary => ({ orders: orders.length, revenue: orders.filter((order) => order.status !== 'annulee').reduce((sum, order) => sum + Number(order.total), 0), lowStock: products.filter((product) => product.stock <= 5).length })
const emptySummary = makeSummary(cachedOrders, cachedProducts)

export function DashboardPanel() {
  const [summary, setSummary] = useState(emptySummary)
  const [products, setProducts] = useState<Product[]>(cachedProducts)
  const [orders, setOrders] = useState<Order[]>(cachedOrders.slice(0, 5))
  const refresh = useCallback(async () => {
    const nextProducts = await getProducts(true)
    setProducts(nextProducts)
    if (!isFirebaseActive && !isSupabaseConfigured) return
    const nextOrders = await getOrders()
    setOrders(nextOrders.slice(0, 5))
    setSummary(makeSummary(nextOrders, nextProducts))
  }, [])

  useEffect(() => {
    void refresh()
    const refreshOnFocus = () => void refresh()
    window.addEventListener('focus', refreshOnFocus)
    return () => {
      window.removeEventListener('focus', refreshOnFocus)
    }
  }, [refresh])
  const cards = [
    { label: 'Commandes', value: summary.orders.toLocaleString('fr-DZ'), icon: ShoppingCart, tone: 'gold' },
    { label: 'Chiffre d’affaires', value: formatPrice(summary.revenue), icon: TrendingUp, tone: 'pink' },
    { label: 'Stock faible', value: String(summary.lowStock), icon: PackageSearch, tone: 'red' },
  ]
  return <div className="admin-panel-stack">
    {!isFirebaseActive && !isSupabaseConfigured && <div className="setup-banner"><div><b>Mode apercu actif</b><p>Connectez une base de donnees pour activer les donnees en direct, les commandes et les utilisateurs.</p></div></div>}
    <section className="metric-grid">{cards.map(({ label, value, icon: Icon, tone }) => <article className="metric-card" key={label}><span className={`metric-icon ${tone}`}><Icon /></span><div><p>{label}</p><strong>{value}</strong></div></article>)}</section>
    <div className="dashboard-grid"><section className="admin-surface"><div className="surface-heading"><div><h2>Commandes recentes</h2><p>Les dernieres activites de la boutique.</p></div><Link to="/admin/commandes">Tout voir <ArrowUpRight /></Link></div>{orders.length ? <div className="compact-orders">{orders.map((order) => <div key={order.id}><span className="order-avatar">{order.customer_name.slice(0, 1)}</span><div><b>{order.customer_name}</b><small>{order.order_number} · {order.wilaya_name}</small></div><strong>{formatPrice(order.total)}</strong><span className={`status ${order.status}`}>{order.status}</span></div>)}</div> : <div className="surface-empty"><ShoppingCart /><p>Aucune commande pour le moment.</p></div>}</section>
      <section className="admin-surface"><div className="surface-heading"><div><h2>Etat du stock</h2><p>{products.length} produits au catalogue.</p></div><Link to="/admin/produits">Gerer <ArrowUpRight /></Link></div><div className="stock-overview">{products.map((product) => <div key={product.id}><span style={{ background: product.accent }} /><div><b>{product.name}</b><small>{product.brand}</small></div><strong className={product.stock <= 5 ? 'low' : ''}>{product.stock} pcs</strong></div>)}</div></section></div>
  </div>
}
