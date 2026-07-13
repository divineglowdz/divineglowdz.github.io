import { Search, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ProductCard } from '../components/ProductCard'
import { productCategories } from '../data/categories'
import { getCachedProducts, getProducts } from '../lib/api'
import type { Product } from '../types'

export function ShopPage() {
  const [products, setProducts] = useState<Product[]>(() => getCachedProducts())
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Toutes')
  const [filtersOpen, setFiltersOpen] = useState(false)
  useEffect(() => { void getProducts().then(setProducts) }, [])
  const categories = ['Toutes', ...productCategories]
  const filtered = useMemo(() => products.filter((product) => (category === 'Toutes' || product.category === category) && `${product.name} ${product.brand}`.toLowerCase().includes(query.toLowerCase())), [products, query, category])
  return <>
    <section className="legacy-shop-search"><div className="legacy-search-box"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un produit..." /><Search /></div><button className="legacy-filter-toggle" onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal /> Filtrer</button>{filtersOpen && <div className="legacy-filter-panel"><p>Catégories</p><div>{categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div></div>}</section>
    <section className="legacy-hero shop-hero"><div className="legacy-hero-text"><h1>Divine glow dz</h1><p>Votre destination pour une beauté éclatante et des soins d'exception. Découvrez notre sélection de produits de haute qualité pour sublimer votre peau et vos looks.</p><div className="legacy-cta"><a className="legacy-btn primary" href="#catalogue">Découvrir nos produits</a><a className="legacy-btn secondary" href="#contact">Nous contacter</a></div></div><img src="https://i.ibb.co/gbsNBtqn/1762021795692-4oi77g-2-1.jpg" alt="Sélection make-up Divine Glow DZ" /></section>
    <section id="catalogue" className="legacy-section legacy-catalogue"><h2 className="legacy-section-title">Notre sélection beauté</h2><p className="legacy-subtitle">Explorez notre gamme de produits soigneusement sélectionnés pour vous offrir le meilleur de la beauté.</p><p className="legacy-feedback">Affichage : <b>{category === 'Toutes' ? 'Toutes les catégories' : category}</b> · {filtered.length} produit(s)</p><div className="legacy-catalogue-grid">{filtered.map((product) => <ProductCard key={product.id} product={product} />)}</div>{!filtered.length && <div className="empty-state"><Search /><h2>Aucun produit trouvé</h2></div>}</section>
  </>
}
