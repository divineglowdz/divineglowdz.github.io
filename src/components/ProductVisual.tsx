import type { Product } from '../types'

export function ProductVisual({ product, compact = false }: { product: Product; compact?: boolean }) {
  const image = [...product.product_images].sort((a, b) => a.position - b.position)[0]
  if (image) return <img className="product-photo" src={image.url} alt={image.alt || product.name} />
  return <div className={`legacy-product-placeholder ${compact ? 'compact' : ''}`} style={{ '--product-accent': product.accent } as React.CSSProperties}><div><span>{product.brand}</span><b>{product.name}</b><small>Divine Glow DZ</small></div></div>
}
