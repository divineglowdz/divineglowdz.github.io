import { Check, ChevronLeft, Minus, Plus, ShoppingBag, Truck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { formatPrice } from '../components/ProductCard'
import { ProductVisual } from '../components/ProductVisual'
import { useCart } from '../contexts/CartContext'
import { getCachedProduct, getProduct, trackEvent } from '../lib/api'
import { getProductPriceRange, getVariantPrice } from '../lib/pricing'
import type { Product, ProductVariant } from '../types'

export function ProductPage() {
  const { slug = '' } = useParams()
  const { addItem } = useCart()
  const cachedProduct = getCachedProduct(slug)
  const [product, setProduct] = useState<Product | null>(cachedProduct)
  const [loading, setLoading] = useState(!cachedProduct)
  const [quantity, setQuantity] = useState(1)
  const [variant, setVariant] = useState<ProductVariant | undefined>()
  const [activeImage, setActiveImage] = useState(0)
  useEffect(() => {
    const instantProduct = getCachedProduct(slug)
    setProduct(instantProduct)
    setLoading(!instantProduct)
    setVariant(undefined)
    setActiveImage(0)
    void getProduct(slug).then((data) => {
      setProduct(data)
      setLoading(false)
      if (data) void trackEvent('product_view', { product_id: data.id })
    })
  }, [slug])
  const availableStock = useMemo(() => variant?.stock ?? product?.stock ?? 0, [product, variant])
  const priceRange = product ? getProductPriceRange(product) : null
  const displayedPrice = product ? getVariantPrice(product, variant) : 0
  if (loading) return <div className="page-loading">Chargement...</div>
  if (!product) return <div className="empty-state page-empty"><h1>Produit introuvable</h1><Link className="button primary" to="/boutique">Retour a la boutique</Link></div>
  const images = [...product.product_images].sort((a, b) => a.position - b.position)
  const displayedImage = variant?.image_url || images[activeImage]?.url
  return (
    <section className="product-page content-section">
      <Link className="back-link" to="/boutique"><ChevronLeft /> Boutique</Link>
      <div className="product-detail">
        <div className="product-gallery">
          <div className="product-gallery-main">{displayedImage ? <img src={displayedImage} alt={variant ? `${product.name} - ${variant.value}` : images[activeImage]?.alt || product.name} decoding="async" /> : <ProductVisual product={product} />}</div>
          {images.length > 1 && <div className="gallery-thumbs">{images.map((image, index) => <button key={image.id || image.url} className={index === activeImage ? 'active' : ''} onClick={() => setActiveImage(index)}><img src={image.url} alt="" loading="lazy" decoding="async" /></button>)}</div>}
        </div>
        <div className="product-info">
          <span className="eyebrow">{product.brand}</span><h1>{product.name}</h1><div className="detail-price-row">{product.compare_at_price && <del>{formatPrice(product.compare_at_price)}</del>}<strong className="detail-price">{!variant && priceRange && priceRange.min !== priceRange.max && <small>A partir de</small>}{formatPrice(variant ? displayedPrice : priceRange?.min ?? displayedPrice)}</strong></div>
          <p className="lead">{product.description}</p>
          <div className="product-benefits"><span><Check /> Produit authentique</span><span><Truck /> Livraison dans 58 wilayas</span></div>
          {!!product.product_variants.length && <div className="variant-picker"><label>Teinte / option</label><div>{product.product_variants.filter((item) => item.active !== false).map((item) => <button key={item.value} disabled={!item.stock} className={variant?.value === item.value ? 'active' : ''} onClick={() => { setVariant(item); setActiveImage(0); setQuantity(1) }}>{item.color_hex && <i style={{ background: item.color_hex }} />}{item.value}<small>{formatPrice(getVariantPrice(product, item))} · {item.stock ? `${item.stock} pcs` : 'Epuise'}</small></button>)}</div></div>}
          <div className="purchase-row">
            <div className="quantity-control"><button onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Diminuer"><Minus /></button><span>{quantity}</span><button onClick={() => setQuantity(Math.min(availableStock, quantity + 1))} aria-label="Augmenter"><Plus /></button></div>
            <button className="button primary add-detail" disabled={!availableStock || (!!product.product_variants.length && !variant)} onClick={() => addItem(product, variant, quantity)}><ShoppingBag /> Ajouter au panier</button>
          </div>
          <p className={`availability ${availableStock <= 5 ? 'low' : ''}`}>{availableStock ? `${availableStock} piece${availableStock > 1 ? 's' : ''} disponible${availableStock > 1 ? 's' : ''}` : 'Produit epuise'}</p>
          <details open><summary>Details du produit</summary><p>{product.details}</p></details>
          <details><summary>Livraison et paiement</summary><p>Livraison a domicile ou au bureau. Paiement a la livraison. Le tarif exact apparait lors de la commande.</p></details>
        </div>
      </div>
    </section>
  )
}
