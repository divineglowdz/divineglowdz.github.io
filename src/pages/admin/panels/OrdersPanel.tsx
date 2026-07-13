import { Edit3, Eye, Search, ShoppingBag, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { formatPrice } from '../../../components/ProductCard'
import { deleteOrder, getCachedOrders, getOrders, saveOrder } from '../../../lib/api'
import { isSupabaseConfigured } from '../../../lib/supabase'
import type { Order, OrderStatus } from '../../../types'

const statuses: OrderStatus[] = ['nouvelle', 'confirmee', 'preparee', 'expediee', 'livree', 'annulee']

export function OrdersPanel() {
  const [orders, setOrders] = useState<Order[]>(() => getCachedOrders())
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('toutes')
  const [selected, setSelected] = useState<Order | null>(null)
  const load = async () => { if (isSupabaseConfigured) setOrders(await getOrders()) }
  useEffect(() => { void load() }, [])
  const filtered = useMemo(() => orders.filter((order) => {
    const matches = `${order.order_number} ${order.customer_name} ${order.phone} ${order.wilaya_name}`.toLowerCase().includes(query.toLowerCase())
    return matches && (status === 'toutes' || order.status === status)
  }), [orders, query, status])
  const quickStatus = async (order: Order, nextStatus: OrderStatus) => { await saveOrder(order.id, { status: nextStatus }); await load() }
  const remove = async (order: Order) => { if (!confirm(`Supprimer definitivement la commande ${order.order_number} ?`)) return; await deleteOrder(order.id); await load() }
  return <div className="admin-panel-stack"><div className="panel-intro"><div><h2>Commandes</h2><p>Consultez, modifiez et suivez toutes les commandes.</p></div></div>
    <section className="admin-surface no-padding"><div className="table-toolbar"><div className="search-field admin-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nom, telephone ou numero" /></div><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="toutes">Tous les statuts</option>{statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div className="admin-table-wrap"><table className="admin-table orders-table"><thead><tr><th>Commande</th><th>Client</th><th>Wilaya</th><th>Total</th><th>Statut</th><th>Date</th><th /></tr></thead><tbody>{filtered.map((order) => <tr key={order.id}><td><b>{order.order_number}</b><small>{order.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0} article(s)</small></td><td><b>{order.customer_name}</b><small>{order.phone}</small></td><td>{order.wilaya_name}<small>{order.delivery_type === 'home' ? 'Domicile' : 'Bureau'}</small></td><td><b>{formatPrice(order.total)}</b></td><td><select className={`status-select ${order.status}`} value={order.status} onChange={(event) => void quickStatus(order, event.target.value as OrderStatus)}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></td><td>{new Date(order.created_at).toLocaleDateString('fr-DZ')}</td><td><div className="row-actions"><button className="table-icon" onClick={() => setSelected(order)} title="Voir et modifier"><Edit3 /></button><button className="table-icon danger" onClick={() => void remove(order)} title="Supprimer"><Trash2 /></button></div></td></tr>)}</tbody></table></div>{!filtered.length && <div className="surface-empty"><ShoppingBag /><p>Aucune commande trouvee.</p></div>}</section>
    {selected && <OrderModal order={selected} onClose={() => setSelected(null)} onSaved={async () => { setSelected(null); await load() }} />}
  </div>
}

function OrderModal({ order, onClose, onSaved }: { order: Order; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState(order)
  const submit = async (event: FormEvent) => { event.preventDefault(); await saveOrder(order.id, { customer_name: form.customer_name, phone: form.phone, commune: form.commune, address: form.address, status: form.status, notes: form.notes }); await onSaved() }
  return <div className="modal-backdrop"><form className="admin-modal order-modal" onSubmit={submit}><div className="modal-heading"><div><span className="eyebrow">{order.order_number}</span><h2>Details de la commande</h2></div><button type="button" onClick={onClose}><X /></button></div><div className="order-modal-grid"><label>Client<input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></label><label>Telephone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label><label>Commune<input value={form.commune} onChange={(e) => setForm({ ...form, commune: e.target.value })} /></label><label>Statut<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as OrderStatus })}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></label></div><label>Adresse<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label><label>Notes<textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label><div className="order-lines"><h3>Articles</h3>{order.order_items?.map((item) => <div key={item.id || `${item.product_name}-${item.variant_name}`}><span><b>{item.product_name}</b><small>{item.variant_name || 'Sans option'} · x{item.quantity}</small></span><strong>{formatPrice(item.unit_price * item.quantity)}</strong></div>)}</div><div className="order-modal-total"><span>Total</span><strong>{formatPrice(order.total)}</strong></div><div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Fermer</button><button className="button primary">Enregistrer</button></div></form></div>
}
