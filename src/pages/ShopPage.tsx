import { Search, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ProductCard } from '../components/ProductCard'
import { productCategories } from '../data/categories'
import { getCachedProducts, getProducts } from '../lib/api'
import type { Product } from '../types'

export function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [products, setProducts] = useState<Product[]>(() => getCachedProducts())
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(() => searchParams.get('categorie') || 'Toutes')
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => { void getProducts().then(setProducts) }, [])

  const categories = ['Toutes', ...productCategories]
  useEffect(() => {
    const next = searchParams.get('categorie') || 'Toutes'
    setCategory(categories.includes(next as (typeof categories)[number]) ? next : 'Toutes')
  }, [searchParams])
  const selectCategory = (next: string) => {
    setCategory(next)
    if (next === 'Toutes') setSearchParams({})
    else setSearchParams({ categorie: next })
  }
  const filtered = useMemo(
    () => products.filter((product) =>
      (category === 'Toutes' || product.category === category)
      && `${product.name} ${product.brand}`.toLowerCase().includes(query.toLowerCase()),
    ),
    [products, query, category],
  )

  return <>
    <section className="legacy-hero shop-hero">
      <div className="legacy-hero-text">
        <h1>Divine glow dz</h1>
        <p>Votre destination pour une beauté éclatante et des soins d'exception. Découvrez notre sélection de produits de haute qualité pour sublimer votre peau et vos looks.</p>
        <div className="legacy-cta"><a className="legacy-btn primary" href="#catalogue">Découvrir nos produits</a><a className="legacy-btn secondary" href="#contact">Nous contacter</a></div>
      </div>
      <img src="/assets/shop-hero.jpg" alt="Produits authentiques Divine Glow DZ et livraison offerte dès 15 000 DA" />
    </section>

    <section id="catalogue" className="legacy-section legacy-catalogue">
      <h2 className="legacy-section-title">Notre sélection beauté</h2>
      <p className="legacy-subtitle">Explorez notre gamme de produits soigneusement sélectionnés pour vous offrir le meilleur de la beauté.</p>

      <div className="legacy-shop-search" aria-label="Recherche et filtres du catalogue">
        <div className="legacy-search-box"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un produit..." /><Search /></div>
        <button type="button" className="legacy-filter-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal /> Filtrer</button>
        {filtersOpen && <div className="legacy-filter-panel"><p>Catégories</p><div>{categories.map((item) => <button type="button" key={item} className={category === item ? 'active' : ''} onClick={() => selectCategory(item)}>{item}</button>)}</div></div>}
      </div>

      <p className="legacy-feedback">Affichage : <b>{category === 'Toutes' ? 'Toutes les catégories' : category}</b> · {filtered.length} produit(s)</p>
      <div className="legacy-catalogue-grid">{filtered.map((product) => <ProductCard key={product.id} product={product} />)}</div>
      {!filtered.length && <div className="empty-state"><Search /><h2>Aucun produit trouvé</h2></div>}
    </section>
  </>
}
