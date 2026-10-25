import type { ProductVariant } from '../types'

type ExistingVariant = Pick<ProductVariant, 'id' | 'value'>

export function prepareProductVariants(
  productId: string,
  variants: ProductVariant[],
  existing: ExistingVariant[],
  createId: () => string = () => crypto.randomUUID(),
) {
  const usedIds = new Set<string>()
  const usedValues = new Set<string>()
  const rows = variants.map((variant) => {
    const value = variant.value.trim()
    const key = value.toLowerCase()
    if (!key || usedValues.has(key)) throw new Error('Chaque teinte doit avoir un nom unique.')
    usedValues.add(key)
    const current = existing.find((item) => item.id === variant.id)
    const matching = existing.filter((item) => item.value.trim().toLowerCase() === key)
    const id = current?.id || (matching.length === 1 ? matching[0].id : undefined) || createId()
    if (usedIds.has(id)) throw new Error('Une teinte ne peut pas etre presente deux fois.')
    usedIds.add(id)
    return {
      id, product_id: productId, name: variant.name || 'Teinte', value,
      color_hex: variant.color_hex || null, image_url: variant.image_url || null,
      image_path: variant.image_path || null, price: variant.price ?? null,
      stock: Number(variant.stock) || 0, active: variant.active !== false,
    }
  })
  return { rows, removedIds: existing.flatMap((item) => item.id && !usedIds.has(item.id) ? [item.id] : []) }
}
