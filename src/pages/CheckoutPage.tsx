import { CheckCircle2, Minus, Plus, ShieldCheck, Trash2, Truck } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatPrice } from '../components/ProductCard'
import { ProductVisual } from '../components/ProductVisual'
import { useCart } from '../contexts/CartContext'
import { getCachedDeliveryRates, getDeliveryRates, placeOrder } from '../lib/api'
import { checkSubmission, cleanText } from '../lib/formProtection'
import { getVariantPrice } from '../lib/pricing'
import type { DeliveryRate } from '../types'

type CheckoutForm = { customer_name: string; phone: string; wilaya_code: string; commune: string; address: string; delivery_type: 'home' | 'office'; notes: string }
const initialForm: CheckoutForm = { customer_name: '', phone: '', wilaya_code: '16', commune: '', address: '', delivery_type: 'home', notes: '' }

export function CheckoutPage() {
  const cart = useCart()
  const navigate = useNavigate()
  const [rates, setRates] = useState<DeliveryRate[]>(() => getCachedDeliveryRates())
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [startedAt] = useState(() => Date.now())
  const [website, setWebsite] = useState('')
  useEffect(() => { void getDeliveryRates().then(setRates) }, [])
  const selectedRate = useMemo(() => rates.find((rate) => rate.wilaya_code === form.wilaya_code), [rates, form.wilaya_code])
  const deliveryPrice = selectedRate ? (form.delivery_type === 'home' ? selectedRate.home_price : selectedRate.office_price) : 0
  const total = cart.subtotal + deliveryPrice

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSubmitting(true); setError('')
    try {
      checkSubmission('order', startedAt, website)
      const result = await placeOrder({
        customer_name: cleanText(form.customer_name, 80), phone: cleanText(form.phone, 30), wilaya_code: form.wilaya_code, commune: cleanText(form.commune, 80), address: cleanText(form.address, 180), delivery_type: form.delivery_type, notes: cleanText(form.notes, 500), wilaya_name: selectedRate?.wilaya_name || '', delivery_price: deliveryPrice,
        items: cart.items.map((item) => ({ product_id: item.product.id, product_name: item.product.name, variant_id: item.variant?.id || null, variant_name: item.variant?.value || null, quantity: item.quantity, unit_price: getVariantPrice(item.product, item.variant) })),
      })
      cart.clear()
      navigate('/merci', { state: result })
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible de valider la commande.') } finally { setSubmitting(false) }
  }

  if (!cart.items.length) return <section className="empty-state page-empty"><div className="empty-icon"><CheckCircle2 /></div><h1>Votre panier est vide</h1><p>Votre prochaine trouvaille est peut-etre a un clic.</p><Link className="button primary" to="/boutique">Explorer la boutique</Link></section>
  return (
    <section className="checkout-page content-section">
      <div className="checkout-heading"><span className="eyebrow">Finaliser</span><h1>Votre commande</h1></div>
      <form className="checkout-layout" onSubmit={submit}>
        <label className="spam-trap" aria-hidden="true">Site web<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
        <div className="checkout-form-panel">
          <div className="form-section"><div className="form-section-title"><span>1</span><div><h2>Vos coordonnees</h2><p>Pour confirmer et livrer votre commande.</p></div></div>
            <div className="form-grid"><label>Nom complet<input required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></label><label>Telephone<input required inputMode="tel" placeholder="05 00 00 00 00" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label></div>
          </div>
          <div className="form-section"><div className="form-section-title"><span>2</span><div><h2>Livraison</h2><p>Choisissez la wilaya et le mode.</p></div></div>
            <div className="form-grid"><label>Wilaya<select value={form.wilaya_code} onChange={(e) => setForm({ ...form, wilaya_code: e.target.value })}>{rates.filter((rate) => rate.active).map((rate) => <option key={rate.wilaya_code} value={rate.wilaya_code}>{rate.wilaya_code} - {rate.wilaya_name}</option>)}</select></label><label>Commune<input required value={form.commune} onChange={(e) => setForm({ ...form, commune: e.target.value })} /></label></div>
            <div className="delivery-options"><button type="button" className={form.delivery_type === 'home' ? 'active' : ''} onClick={() => setForm({ ...form, delivery_type: 'home' })}><Truck /><span><b>A domicile</b><small>{selectedRate ? formatPrice(selectedRate.home_price) : '-'}</small></span></button><button type="button" className={form.delivery_type === 'office' ? 'active' : ''} onClick={() => setForm({ ...form, delivery_type: 'office' })}><ShieldCheck /><span><b>Au bureau</b><small>{selectedRate ? formatPrice(selectedRate.office_price) : '-'}</small></span></button></div>
            <label>Adresse complete<input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label><label>Note <span className="optional">facultatif</span><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Point de repere, horaire..." /></label>
          </div>
        </div>
        <aside className="order-summary"><h2>Recapitulatif</h2><div className="summary-items">{cart.items.map((item, index) => <div className="summary-item" key={`${item.product.id}-${item.variant?.value || ''}`}><div className="summary-thumb"><ProductVisual product={item.product} variant={item.variant} compact /></div><div><b>{item.product.name}</b>{item.variant && <small>{item.variant.value}</small>}<strong>{formatPrice(getVariantPrice(item.product, item.variant))}</strong><div className="mini-quantity"><button type="button" onClick={() => cart.updateQuantity(index, item.quantity - 1)}><Minus /></button><span>{item.quantity}</span><button type="button" onClick={() => cart.updateQuantity(index, item.quantity + 1)}><Plus /></button></div></div><button type="button" className="remove-button" onClick={() => cart.removeItem(index)} aria-label="Supprimer"><Trash2 /></button></div>)}</div>
          <div className="summary-totals"><p><span>Sous-total</span><b>{formatPrice(cart.subtotal)}</b></p><p><span>Livraison</span><b>{formatPrice(deliveryPrice)}</b></p><p className="grand-total"><span>Total</span><b>{formatPrice(total)}</b></p></div>
          {error && <p className="form-error">{error}</p>}<button className="button primary checkout-submit" disabled={submitting}>{submitting ? 'Validation...' : 'Confirmer la commande'}</button><p className="secure-note"><ShieldCheck /> Paiement a la livraison</p>
        </aside>
      </form>
    </section>
  )
}
