import { Check, MapPin, Save, Search, Truck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { getCachedDeliveryRates, getDeliveryRates, saveDeliveryRates } from '../../../lib/api'
import { isFirebaseActive } from '../../../lib/firebase'
import { isSupabaseConfigured } from '../../../lib/supabase'
import type { DeliveryRate } from '../../../types'

export function DeliveryPanel() {
  const isDataConfigured = isFirebaseActive || isSupabaseConfigured
  const [rates, setRates] = useState<DeliveryRate[]>(() => getCachedDeliveryRates())
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  useEffect(() => { void getDeliveryRates().then(setRates) }, [])
  const visible = useMemo(() => rates.filter((rate) => `${rate.wilaya_code} ${rate.wilaya_name}`.toLowerCase().includes(query.toLowerCase())), [rates, query])
  const update = (code: string, field: keyof DeliveryRate, value: number | boolean) => setRates((current) => current.map((rate) => rate.wilaya_code === code ? { ...rate, [field]: value } : rate))
  const save = async () => { if (!isDataConfigured) return; setSaving(true); await saveDeliveryRates(rates); setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000) }
  return <div className="admin-panel-stack"><div className="panel-intro"><div><h2>Tarifs de livraison</h2><p>Personnalisez le prix domicile et bureau pour chaque wilaya.</p></div><button className="button primary small" onClick={save} disabled={saving || !isDataConfigured}>{saved ? <Check /> : <Save />}{saved ? 'Enregistre' : saving ? 'Enregistrement...' : 'Enregistrer'}</button></div>
    <div className="delivery-summary"><div><MapPin /><span><b>58 wilayas</b><small>Couverture nationale</small></span></div><div><Truck /><span><b>2 modes</b><small>Domicile et bureau</small></span></div></div>
    <section className="admin-surface no-padding"><div className="table-toolbar"><div className="search-field admin-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une wilaya" /></div><small>Prix en dinars algeriens</small></div><div className="admin-table-wrap"><table className="admin-table delivery-table"><thead><tr><th>Wilaya</th><th>Domicile</th><th>Bureau</th><th>Active</th></tr></thead><tbody>{visible.map((rate) => <tr key={rate.wilaya_code}><td><b>{rate.wilaya_code}</b><span>{rate.wilaya_name}</span></td><td><div className="price-input"><input type="number" min="0" value={rate.home_price} onChange={(event) => update(rate.wilaya_code, 'home_price', Number(event.target.value))} /><span>DA</span></div></td><td><div className="price-input"><input type="number" min="0" value={rate.office_price} onChange={(event) => update(rate.wilaya_code, 'office_price', Number(event.target.value))} /><span>DA</span></div></td><td><label className="switch"><input type="checkbox" checked={rate.active} onChange={(event) => update(rate.wilaya_code, 'active', event.target.checked)} /><span /></label></td></tr>)}</tbody></table></div></section>
  </div>
}
