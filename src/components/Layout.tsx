import { ShoppingCart, X } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'
import { useCart } from '../contexts/CartContext'

export function Layout() {
  const { count } = useCart()
  return (
    <div className="site-shell">
      <header className="legacy-header">
        <nav className="legacy-nav">
          <Link className="legacy-logo" to="/">
            <img src="https://i.ibb.co/k7R6BCs/Photo-Room-20251101-143835.png" alt="Logo Divine Glow DZ" />
          </Link>
          <ul>
            <li><Link to="/boutique">Boutique</Link></li>
            <li><Link to="/#collections">Collections</Link></li>
            <li><Link to="/#valeurs">Engagements</Link></li>
            <li><Link to="/#produits">Produits</Link></li>
          </ul>
        </nav>
      </header>
      <main><Outlet /></main>
      <footer className="legacy-footer">
        <div><h4>À propos</h4><p>Divine Glow DZ — Boutique en ligne de cosmétiques et maquillage authentiques. Retrouvez toutes vos marques préférées, des produits de qualité, à prix abordables, avec livraison rapide partout en Algérie. ✨</p></div>
        <div><h4>Contact</h4><a className="contact-chip" href="mailto:divineglowdz1@gmail.com">divineglowdz1@gmail.com</a><a className="contact-chip" href="tel:+213559764690">+213 55 97 64 690</a><p>Alger, Algérie</p></div>
        <div><h4>Restez inspirée</h4><p>Inscrivez-vous pour recevoir des tutoriels exclusifs, looks backstage et offres privées.</p><form onSubmit={(event) => event.preventDefault()}><input type="email" placeholder="Votre e-mail" /><button className="legacy-btn secondary">Je m’inscris</button></form></div>
        <div><h4>Suivez-nous</h4><div className="social-links"><a className="social-icon" href="https://www.instagram.com/divineglowdz" target="_blank" rel="noreferrer">Instagram</a><a className="social-icon" href="https://www.tiktok.com/@divineglowdz" target="_blank" rel="noreferrer">TikTok</a></div></div>
        <p className="credits">© {new Date().getFullYear()} Divine Glow DZ. Tous droits réservés. Brillance et bienveillance incluses.</p>
      </footer>
      <Link className="floating-cart-button" to="/commande" aria-label={`Ouvrir le panier, ${count} article(s)`}><ShoppingCart /><span className="cart-badge">{count}</span></Link>
    </div>
  )
}
