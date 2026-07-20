import { CheckCircle2, Clock3, Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { sendContactMessage } from '../lib/api'

const blank = { name: '', email: '', phone: '', subject: 'Conseil produit', message: '' }

export function ContactPage() {
  const [form, setForm] = useState(blank)
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const submit = async (event: FormEvent) => { event.preventDefault(); setState('sending'); try { await sendContactMessage(form); setForm(blank); setState('sent') } catch { setState('error') } }
  return <div className="contact-page">
    <section className="contact-hero"><span className="eyebrow"><MessageCircle /> Une question ?</span><h1>Parlons de votre routine.</h1><p>Notre équipe est là pour vous guider, vous renseigner sur une commande ou vous aider à trouver la teinte idéale.</p></section>
    <section className="contact-layout"><aside className="contact-aside"><div><Mail /><h2>Écrivez-nous</h2><a href="mailto:divineglowdz1@gmail.com">divineglowdz1@gmail.com</a></div><div><Phone /><h2>Appelez-nous</h2><a href="tel:+213559764690">+213 55 97 64 690</a></div><div><MapPin /><h2>Notre univers</h2><p>Alger, Algérie</p></div><div className="contact-reply"><Clock3 /><p>Nous répondons généralement dans les 24 à 48 heures ouvrées.</p></div></aside>
      <form className="contact-form" onSubmit={submit}><div className="contact-form-heading"><span className="eyebrow">Message privé</span><h2>Comment pouvons-nous vous aider ?</h2></div>{state === 'sent' ? <div className="contact-success"><CheckCircle2 /><h3>Message envoyé</h3><p>Merci, notre équipe revient vers vous au plus vite.</p><button type="button" className="legacy-btn secondary" onClick={() => setState('idle')}>Envoyer un autre message</button></div> : <><div className="contact-fields"><label>Nom complet<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>E-mail<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label><label>Téléphone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label><label>Sujet<select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}><option>Conseil produit</option><option>Commande et livraison</option><option>Disponibilité d’un produit</option><option>Autre demande</option></select></label></div><label>Votre message<textarea required rows={6} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Dites-nous ce dont vous avez besoin..." /></label>{state === 'error' && <p className="form-error">Envoi impossible. Réessayez dans un instant.</p>}<button className="legacy-btn primary" disabled={state === 'sending'}>{state === 'sending' ? 'Envoi en cours...' : 'Envoyer mon message'}</button></>}</form>
    </section>
  </div>
}
