import { Link } from 'react-router-dom'
import { useCart } from '../contexts/CartContext'
import type { Product } from '../types'
import { ProductVisual } from './ProductVisual'

export const formatPrice = (value: number) => `${new Intl.NumberFormat('fr-DZ').format(value)} DA`

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart()
  return <article className="legacy-card legacy-product-card"><Link className="legacy-product-media" to={`/produit/${product.slug}`}><ProductVisual product={product} compact /><span className="legacy-stock">{product.stock > 0 ? `${product.stock} en stock` : 'Épuisé'}</span></Link><span className="legacy-tag">{product.category}</span><Link to={`/produit/${product.slug}`}><h3>{product.name}</h3></Link><p>{product.description}</p>{product.product_variants.length > 0 && <div className="legacy-options"><h4>Teintes disponibles</h4><ul>{product.product_variants.map((variant) => <li key={variant.value}>{variant.value}</li>)}</ul></div>}<strong className="legacy-price">{formatPrice(product.price)}</strong><button className="legacy-add-button" disabled={!product.stock} onClick={() => addItem(product)}>Ajouter au panier</button></article>
}
