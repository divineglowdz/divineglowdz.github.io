import { ArrowUpRight, Eye, MousePointerClick, PackageSearch, ScanEye, ShoppingCart, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatPrice } from '../../../components/ProductCard'
import { getAnalytics, getOrders, getProducts } from '../../../lib/api'
import { isSupabaseConfigured } from '../../../lib/supabase'
import type { AnalyticsSummary, Order, Product } from '../../../types'

const emptySummary: AnalyticsSummary = { views: 0, productViews: 0, addToCart: 0, orders: 0, revenue: 0, lowStock: 0 }

export function DashboardPanel() {
  const [summary, setSummary] = useState(emptySummary)
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  useEffect(() => { void (async () => { const nextProducts = await getProducts(true); setProducts(nextProducts); if (isSupabaseConfigured) { const [nextOrders, nextSummary] = await Promise.all([getOrders(), getAnalytics(nextProducts)]); setOrders(nextOrders.slice(0, 5)); setSummary(nextSummary) } })() }, [])
  const cards = [
    { label: 'Visites (30 j)', value: summary.views.toLocaleString('fr-DZ'), icon: Eye, tone: 'green' },
    { label: 'Fiches consultees', value: summary.productViews.toLocaleString('fr-DZ'), icon: ScanEye, tone: 'pink' },
    { label: 'Ajouts au panier', value: summary.addToCart.toLocaleString('fr-DZ'), icon: MousePointerClick, tone: 'gold' },
    { label: 'Commandes', value: summary.orders.toLocaleString('fr-DZ'), icon: ShoppingCart, tone: 'gold' },
    { label: 'Chiffre d’affaires', value: formatPrice(summary.revenue), icon: TrendingUp, tone: 'pink' },
    { label: 'Stock faible', value: String(summary.lowStock), icon: PackageSearch, tone: 'red' },
  ]
  return <div className="admin-panel-stack">
    {!isSupabaseConfigured && <div className="setup-banner"><div><b>Mode apercu actif</b><p>Connectez Supabase pour activer les donnees en direct, les commandes et les utilisateurs.</p></div></div>}
    <section className="metric-grid">{cards.map(({ label, value, icon: Icon, tone }) => <article className="metric-card" key={label}><span className={`metric-icon ${tone}`}><Icon /></span><div><p>{label}</p><strong>{value}</strong></div></article>)}</section>
    <div className="dashboard-grid"><section className="admin-surface"><div className="surface-heading"><div><h2>Commandes recentes</h2><p>Les dernieres activites de la boutique.</p></div><Link to="/admin/commandes">Tout voir <ArrowUpRight /></Link></div>{orders.length ? <div className="compact-orders">{orders.map((order) => <div key={order.id}><span className="order-avatar">{order.customer_name.slice(0, 1)}</span><div><b>{order.customer_name}</b><small>{order.order_number} · {order.wilaya_name}</small></div><strong>{formatPrice(order.total)}</strong><span className={`status ${order.status}`}>{order.status}</span></div>)}</div> : <div className="surface-empty"><ShoppingCart /><p>Aucune commande pour le moment.</p></div>}</section>
      <section className="admin-surface"><div className="surface-heading"><div><h2>Etat du stock</h2><p>{products.length} produits au catalogue.</p></div><Link to="/admin/produits">Gerer <ArrowUpRight /></Link></div><div className="stock-overview">{products.map((product) => <div key={product.id}><span style={{ background: product.accent }} /><div><b>{product.name}</b><small>{product.brand}</small></div><strong className={product.stock <= 5 ? 'low' : ''}>{product.stock} pcs</strong></div>)}</div></section></div>
  </div>
}
