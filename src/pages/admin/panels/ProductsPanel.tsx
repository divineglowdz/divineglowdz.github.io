import { Edit3, ImagePlus, PackagePlus, Plus, Search, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { formatPrice } from '../../../components/ProductCard'
import { ProductVisual } from '../../../components/ProductVisual'
import { productCategories } from '../../../data/categories'
import { deleteProduct, deleteProductImage, getCachedProducts, getProducts, saveProduct, uploadProductImages, uploadProductVariantImage } from '../../../lib/api'
import { getProductPriceRange } from '../../../lib/pricing'
import { isSupabaseConfigured } from '../../../lib/supabase'
import type { Product, ProductVariant } from '../../../types'

const blankProduct: Product = {
  id: '', slug: '', name: '', brand: '', category: 'Teint', description: '', details: '',
  price: 0, compare_at_price: null, stock: 0, accent: '#d8a3a8', active: true,
  featured: true, product_images: [], product_variants: [],
}

const slugify = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const errorMessage = (reason: unknown) => {
  if (reason instanceof Error) return reason.message
  if (reason && typeof reason === 'object') {
    const detail = reason as { message?: unknown; details?: unknown; hint?: unknown }
    const message = [detail.message, detail.details, detail.hint].find((value) => typeof value === 'string' && value.length)
    if (typeof message === 'string') return message
  }
  return 'Enregistrement impossible. Verifiez les champs du produit.'
}

export function ProductsPanel() {
  const [products, setProducts] = useState<Product[]>(() => getCachedProducts(true))
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Product | null>(null)
  const load = async () => setProducts(await getProducts(true))

  useEffect(() => { void load() }, [])

  const filtered = useMemo(
    () => products.filter((product) => `${product.name} ${product.brand}`.toLowerCase().includes(query.toLowerCase())),
    [products, query],
  )

  const remove = async (product: Product) => {
    if (!isSupabaseConfigured || !confirm(`Supprimer definitivement ${product.name} ?`)) return
    await deleteProduct(product.id)
    await load()
  }

  return (
    <div className="admin-panel-stack">
      <div className="panel-intro">
        <div><h2>Catalogue</h2><p>Ajoutez, modifiez, masquez ou supprimez vos produits et leurs teintes.</p></div>
        <button className="button primary small" onClick={() => setEditing({ ...blankProduct })} disabled={!isSupabaseConfigured}><PackagePlus /> Nouveau produit</button>
      </div>
      <section className="admin-surface no-padding">
        <div className="table-toolbar">
          <div className="search-field admin-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un produit" /></div>
          <span className="table-count">{filtered.length} produit(s)</span>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table products-table">
            <thead><tr><th>Produit</th><th>Prix</th><th>Stock</th><th>Teintes</th><th>Visibilite</th><th /></tr></thead>
            <tbody>{filtered.map((product) => {
              const range = getProductPriceRange(product)
              return <tr key={product.id}>
                <td><div className="admin-product-cell"><div className="admin-product-thumb"><ProductVisual product={product} compact /></div><div><b>{product.name}</b><small>{product.brand} · {product.category}</small></div></div></td>
                <td><b>{range.min === range.max ? formatPrice(range.min) : `${formatPrice(range.min)} - ${formatPrice(range.max)}`}</b></td>
                <td><span className={`stock-badge ${product.stock <= 5 ? 'low' : ''}`}>{product.stock} pcs</span></td>
                <td>{product.product_variants.length ? <div className="shade-dots">{product.product_variants.slice(0, 5).map((variant) => <i key={variant.value} style={{ background: variant.color_hex || '#ddd' }} title={variant.value} />)}{product.product_variants.length > 5 && <small>+{product.product_variants.length - 5}</small>}</div> : <small>Aucune</small>}</td>
                <td><span className={product.active ? 'active-dot' : 'inactive-dot'}>{product.active ? 'En ligne' : 'Masque'}</span></td>
                <td><div className="row-actions"><button className="table-icon" onClick={() => setEditing(structuredClone(product))}><Edit3 /></button><button className="table-icon danger" onClick={() => void remove(product)}><Trash2 /></button></div></td>
              </tr>
            })}</tbody>
          </table>
        </div>
      </section>
      {editing && <ProductModal product={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load() }} />}
    </div>
  )
}

function ProductModal({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState(product)
  const [files, setFiles] = useState<File[]>([])
  const [filePreviews, setFilePreviews] = useState<string[]>([])
  const [variantFiles, setVariantFiles] = useState<Record<number, File>>({})
  const [variantPreviews, setVariantPreviews] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const previews = files.map((file) => URL.createObjectURL(file))
    setFilePreviews(previews)
    return () => previews.forEach((preview) => URL.revokeObjectURL(preview))
  }, [files])

  useEffect(() => {
    const previews: Record<number, string> = {}
    Object.entries(variantFiles).forEach(([index, file]) => { previews[Number(index)] = URL.createObjectURL(file) })
    setVariantPreviews(previews)
    return () => Object.values(previews).forEach((preview) => URL.revokeObjectURL(preview))
  }, [variantFiles])

  const updateVariant = (index: number, field: keyof ProductVariant, value: string | number | boolean | null) => setForm((current) => ({
    ...current,
    product_variants: current.product_variants.map((variant, itemIndex) => itemIndex === index ? { ...variant, [field]: value } : variant),
  }))

  const addVariant = () => setForm((current) => ({
    ...current,
    product_variants: [...current.product_variants, { name: 'Teinte', value: '', color_hex: '#d8a3a8', price: null, stock: 0, active: true }],
  }))

  const variantStock = form.product_variants.filter((variant) => variant.active !== false).reduce((sum, variant) => sum + variant.stock, 0)

  const removeVariant = (index: number) => {
    setForm((current) => ({ ...current, product_variants: current.product_variants.filter((_, itemIndex) => itemIndex !== index) }))
    setVariantFiles((current) => {
      const next: Record<number, File> = {}
      Object.entries(current).forEach(([key, file]) => {
        const currentIndex = Number(key)
        if (currentIndex < index) next[currentIndex] = file
        if (currentIndex > index) next[currentIndex - 1] = file
      })
      return next
    })
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (form.compare_at_price !== null && form.compare_at_price <= form.price) throw new Error('Le prix barre doit etre superieur au prix actuel.')
      const saved = await saveProduct({ ...form, slug: slugify(form.name), stock: form.product_variants.length ? variantStock : form.stock })
      if (files.length) await uploadProductImages(saved.id, files)
      for (const [index, file] of Object.entries(variantFiles)) {
        const item = form.product_variants[Number(index)]
        if (item?.value) await uploadProductVariantImage(saved.id, item.value, file, item.image_path)
      }
      await onSaved()
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setSaving(false)
    }
  }

  const removeImage = async (image: Product['product_images'][number]) => {
    await deleteProductImage(image)
    setForm((current) => ({ ...current, product_images: current.product_images.filter((item) => item !== image) }))
  }

  const removePendingVariantFile = (index: number) => setVariantFiles((current) => {
    const next = { ...current }
    delete next[index]
    return next
  })

  return (
    <div className="modal-backdrop">
      <form className="admin-modal product-modal" onSubmit={submit}>
        <div className="modal-heading"><div><span className="eyebrow">Catalogue</span><h2>{form.id ? 'Modifier le produit' : 'Nouveau produit'}</h2></div><button type="button" onClick={onClose}><X /></button></div>
        <div className="product-form-grid">
          <div className="product-form-main">
            <div className="form-card">
              <h3>Informations</h3>
              <div className="form-grid">
                <label>Nom<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value, slug: slugify(event.target.value) })} /></label>
                <label>Marque<input required value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} /></label>
                <label>Categorie<select required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{productCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
              </div>
              <label>Description courte<textarea required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
              <label>Details<textarea value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} /></label>
            </div>
            <div className="form-card">
              <div className="form-card-heading"><div><h3>Teintes et options</h3><p>Chaque option peut avoir sa photo, son stock et un prix different.</p></div><button type="button" className="button secondary small" onClick={addVariant}><Plus /> Ajouter</button></div>
              {form.product_variants.length ? <div className="variant-editor">{form.product_variants.map((variant, index) => (
                <div key={index}>
                  <input type="color" value={variant.color_hex || '#d8a3a8'} onChange={(event) => updateVariant(index, 'color_hex', event.target.value)} title="Couleur" />
                  <div className="variant-image-control">
                    <label className={`variant-image-upload ${variantFiles[index] ? 'selected' : ''}`} title="Photo de cette teinte">
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) setVariantFiles((current) => ({ ...current, [index]: file }))
                        event.currentTarget.value = ''
                      }} />
                      {variantPreviews[index] ? <img src={variantPreviews[index]} alt="" /> : variant.image_url ? <img src={variant.image_url} alt="" /> : <ImagePlus />}
                    </label>
                    {variantFiles[index] && <button type="button" className="variant-image-remove" onClick={() => removePendingVariantFile(index)} title="Retirer cette photo"><X /></button>}
                  </div>
                  <label>Nom<input value={variant.value} onChange={(event) => updateVariant(index, 'value', event.target.value)} placeholder="Ex. Nude rose" required /></label>
                  <label className="variant-price"><span className="variant-price-toggle"><input type="checkbox" checked={variant.price !== null} onChange={(event) => updateVariant(index, 'price', event.target.checked ? form.price : null)} /> Prix specifique</span>{variant.price !== null && <input type="number" min="0" value={variant.price} onChange={(event) => updateVariant(index, 'price', Number(event.target.value))} />}</label>
                  <label>Stock<input type="number" min="0" value={variant.stock} onChange={(event) => updateVariant(index, 'stock', Number(event.target.value))} /></label>
                  <button type="button" className="table-icon danger" onClick={() => removeVariant(index)}><Trash2 /></button>
                </div>
              ))}</div> : <p className="inline-empty">Aucune option. Le prix et le stock generaux seront utilises.</p>}
            </div>
          </div>
          <aside className="product-form-side">
            <div className="form-card">
              <h3>Prix et stock</h3>
              <label>Prix actuel (DA)<input type="number" min="0" required value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} /></label>
              <label className="checkbox-line"><input type="checkbox" checked={form.compare_at_price !== null} onChange={(event) => setForm({ ...form, compare_at_price: event.target.checked ? Math.max(form.price + 500, form.compare_at_price || 0) : null })} /> Activer le prix barre</label>
              {form.compare_at_price !== null && <label>Prix avant reduction (DA)<input type="number" min={form.price + 1} required value={form.compare_at_price} onChange={(event) => setForm({ ...form, compare_at_price: Number(event.target.value) })} /></label>}
              <label>Stock general<input type="number" min="0" required disabled={form.product_variants.length > 0} value={form.product_variants.length ? variantStock : form.stock} onChange={(event) => setForm({ ...form, stock: Number(event.target.value) })} /></label>
              {form.product_variants.length > 0 && <small className="field-help">Calcule automatiquement depuis les options actives.</small>}
              <label className="checkbox-line"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Visible sur la boutique</label>
              <label className="checkbox-line"><input type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })} /> Mis en avant</label>
            </div>
            <div className="form-card">
              <h3>Photos</h3>
              <label className="upload-zone"><input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => setFiles(Array.from(event.target.files || []))} /><ImagePlus /><b>Ajouter des photos</b><small>Depuis telephone ou ordinateur</small></label>
              <div className="existing-images">
                {form.product_images.map((image) => <div key={image.id || image.url}><img src={image.url} alt={image.alt} /><button type="button" onClick={() => void removeImage(image)}><X /></button></div>)}
                {filePreviews.map((preview, index) => <div key={`${files[index]?.name}-${files[index]?.lastModified}`}><img src={preview} alt={files[index]?.name || 'Photo selectionnee'} /><button type="button" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}><X /></button></div>)}
              </div>
            </div>
          </aside>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions sticky"><button type="button" className="button secondary" onClick={onClose}>Annuler</button><button className="button primary" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer le produit'}</button></div>
      </form>
    </div>
  )
}
