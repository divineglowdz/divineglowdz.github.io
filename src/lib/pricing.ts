import type { Product, ProductVariant } from '../types'

export function getVariantPrice(product: Product, variant?: ProductVariant | null) {
  return variant?.price == null ? product.price : variant.price
}

export function getProductPriceRange(product: Product) {
  const variants = product.product_variants.filter((variant) => variant.active !== false)
  const prices = variants.length
    ? variants.map((variant) => getVariantPrice(product, variant))
    : [product.price]

  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
  }
}
