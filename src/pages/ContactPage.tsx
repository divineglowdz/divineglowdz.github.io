import { CheckCircle2, Clock3, Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { sendContactMessage } from '../lib/api'
import { checkSubmission, cleanText } from '../lib/formProtection'

const blank = { name: '', email: '', phone: '', subject: 'Conseil produit', message: '' }

export function ContactPage() {
  const [form, setForm] = useState(blank)
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [startedAt] = useState(() => Date.now())
  const [website, setWebsite] = useState('')
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setState('sending')
    setError('')
    try {
      checkSubmission('contact', startedAt, website)
      await sendContactMessage({
        name: cleanText(form.name, 80),
        email: cleanText(form.email, 120),
        phone: cleanText(form.phone, 30),
        subject: cleanText(form.subject, 80),
        message: cleanText(form.message, 1500),
      })
      setForm(blank)
      setState('sent')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Envoi impossible. Reessayez dans un instant.')
      setState('error')
    }
  }

  return <div className="contact-page">
    <section className="contact-hero"><span className="eyebrow"><MessageCircle /> Une question ?</span><h1>Parlons de votre routine.</h1><p>Notre equipe est la pour vous guider, vous renseigner sur une commande ou vous aider a trouver la teinte ideale.</p></section>
    <section className="contact-layout"><aside className="contact-aside"><div><Mail /><h2>Ecrivez-nous</h2><a href="mailto:divineglowdz1@gmail.com">divineglowdz1@gmail.com</a></div><div><Phone /><h2>Appelez-nous</h2><a href="tel:+213564012589">0564 01 25 89</a></div><div><MapPin /><h2>Notre univers</h2><p>Alger, Algerie</p></div><div className="contact-reply"><Clock3 /><p>Nous repondons generalement dans les 24 a 48 heures ouvrees.</p></div></aside>
      <form className="contact-form" onSubmit={submit}>
        <label className="spam-trap" aria-hidden="true">Site web<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
        <div className="contact-form-heading"><span className="eyebrow">Message prive</span><h2>Comment pouvons-nous vous aider ?</h2></div>
        {state === 'sent' ? <div className="contact-success"><CheckCircle2 /><h3>Message envoye</h3><p>Merci, notre equipe revient vers vous au plus vite.</p><button type="button" className="legacy-btn secondary" onClick={() => setState('idle')}>Envoyer un autre message</button></div> : <>
          <div className="contact-fields"><label>Nom complet<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>E-mail<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Telephone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label>Sujet<select value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })}><option>Conseil produit</option><option>Commande et livraison</option><option>Disponibilite d'un produit</option><option>Autre demande</option></select></label></div>
          <label>Votre message<textarea required rows={6} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="Dites-nous ce dont vous avez besoin..." /></label>
          {state === 'error' && <p className="form-error">{error}</p>}
          <button className="legacy-btn primary" disabled={state === 'sending'}>{state === 'sending' ? 'Envoi en cours...' : 'Envoyer mon message'}</button>
        </>}
      </form>
    </section>
  </div>
}
