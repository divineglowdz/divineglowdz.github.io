import { BadgeCheck, HeartHandshake, Leaf, PackageCheck, ShieldCheck, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

const commitments = [
  { icon: ShieldCheck, title: 'Authenticité vérifiée', text: 'Nous sélectionnons chaque référence auprès de circuits de confiance et contrôlons les produits avant leur mise en ligne.' },
  { icon: PackageCheck, title: 'Préparation soignée', text: 'Chaque commande est préparée avec attention pour que vos essentiels arrivent protégés, propres et prêts à être utilisés.' },
  { icon: HeartHandshake, title: 'Conseil humain', text: 'Une question sur une teinte, une texture ou une routine ? Notre équipe vous répond avec des conseils adaptés.' },
]

export function EngagementPage() {
  return <div className="commitment-page">
    <section className="commitment-hero"><span className="eyebrow"><Sparkles /> Divine Glow, en toute confiance</span><h1>Nos engagements beauté</h1><p>Une sélection exigeante, un service attentif et des essentiels choisis pour accompagner chaque routine avec sérénité.</p><Link className="legacy-btn primary" to="/boutique">Découvrir la boutique</Link></section>
    <section className="commitment-grid">{commitments.map(({ icon: Icon, title, text }) => <article className="commitment-card" key={title}><span><Icon /></span><h2>{title}</h2><p>{text}</p></article>)}</section>
    <section className="commitment-story"><div><span className="eyebrow">Notre sélection</span><h2>Des produits choisis avec une vraie exigence.</h2><p>Nous privilégions les marques reconnues, les formules appréciées et les produits qui ont leur place dans une routine beauté concrète. Chaque nouveau produit rejoint une sélection pensée pour être facile à découvrir et agréable à utiliser.</p></div><div className="commitment-checklist"><p><BadgeCheck /> Marques et références soigneusement sélectionnées</p><p><BadgeCheck /> Prix et stock actualisés dans la boutique</p><p><BadgeCheck /> Livraison suivie dans toutes les wilayas</p></div></section>
    <section className="commitment-promise"><Leaf /><div><span className="eyebrow">Une beauté plus consciente</span><h2>Le bon produit, au bon moment.</h2><p>Nous préférons une boutique claire, des conseils utiles et des choix qui durent plutôt que le superflu.</p></div><Link className="legacy-btn secondary" to="/contact">Parler à l’équipe</Link></section>
  </div>
}
