import { ArrowRight, Check, MessageCircle } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

export function ThankYouPage() {
  const location = useLocation()
  const orderNumber = (location.state as { order_number?: string } | null)?.order_number
  return (
    <section className="thank-you-page">
      <div className="success-mark"><Check /></div><span className="eyebrow">Commande enregistree</span><h1>Merci pour votre confiance.</h1><p>Votre selection est reservee. Notre equipe vous contactera rapidement pour confirmer la livraison.</p>{orderNumber && <div className="order-number"><span>Numero de commande</span><b>{orderNumber}</b></div>}
      <div className="thank-actions"><Link className="button primary" to="/boutique">Continuer mes achats <ArrowRight /></Link><a className="button secondary" href="https://wa.me/213559764690"><MessageCircle /> Nous contacter</a></div>
    </section>
  )
}
