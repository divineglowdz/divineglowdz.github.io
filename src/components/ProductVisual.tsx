import type { Product, ProductVariant } from '../types'

export function ProductVisual({ product, variant, compact = false }: { product: Product; variant?: ProductVariant; compact?: boolean }) {
  const image = [...product.product_images].sort((a, b) => a.position - b.position)[0]
  if (variant?.image_url) return <img className="product-photo" src={variant.image_url} alt={`${product.name} - ${variant.value}`} loading={compact ? 'lazy' : undefined} decoding="async" />
  if (image) return <img className="product-photo" src={image.url} alt={image.alt || product.name} loading={compact ? 'lazy' : undefined} decoding="async" />
  return <div className={`legacy-product-placeholder ${compact ? 'compact' : ''}`} style={{ '--product-accent': product.accent } as React.CSSProperties}><div><span>{product.brand}</span><b>{product.name}</b><small>Divine Glow DZ</small></div></div>
}
