import { Link } from 'react-router-dom'
import { useCart } from '../contexts/CartContext'
import { getProductPriceRange } from '../lib/pricing'
import type { Product } from '../types'
import { ProductVisual } from './ProductVisual'

export const formatPrice = (value: number) => `${new Intl.NumberFormat('fr-DZ').format(value)} DA`

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart()
  const productUrl = `/produit/${product.slug}`
  const priceRange = getProductPriceRange(product)
  const variants = product.product_variants.filter((variant) => variant.active !== false)

  return <article className="legacy-card legacy-product-card">
    <Link className="legacy-product-media" to={productUrl}><ProductVisual product={product} compact /><span className="legacy-stock">{product.stock > 0 ? `${product.stock} en stock` : 'Épuisé'}</span></Link>
    <span className="legacy-tag">{product.category}</span>
    <Link to={productUrl}><h3>{product.name}</h3></Link>
    <p>{product.description}</p>
    {variants.length > 0 && <div className="legacy-options"><h4>Teintes disponibles</h4><ul>{variants.map((variant) => <li key={variant.value}>{variant.value}</li>)}</ul></div>}
    <div className="legacy-price-row">{product.compare_at_price && <del>{formatPrice(product.compare_at_price)}</del>}<strong className="legacy-price">{priceRange.min !== priceRange.max && <small>A partir de</small>}{formatPrice(priceRange.min)}</strong></div>
    {variants.length
      ? <Link className="legacy-add-button" to={productUrl}>Choisir une teinte</Link>
      : <button className="legacy-add-button" disabled={!product.stock} onClick={() => addItem(product)}>Ajouter au panier</button>}
  </article>
}
