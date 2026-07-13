import type { Product } from '../types'

export const seedProducts: Product[] = [
  {
    id: '10000000-0000-4000-8000-000000000001', slug: 'primer-elf-power-grip',
    name: 'Power Grip Primer', brand: 'e.l.f.', category: 'Teint', price: 2500, compare_at_price: null, stock: 10,
    description: 'Le primer gel iconique qui hydrate et aide le maquillage a tenir toute la journee.',
    details: 'Texture gel fraiche, fini lumineux et effet grip. Convient a toutes les carnations.',
    accent: '#70b8a0', active: true, featured: true, product_images: [], product_variants: [],
  },
  {
    id: '10000000-0000-4000-8000-000000000002', slug: 'primer-elf-matte-putty',
    name: 'Matte Putty Primer', brand: 'e.l.f.', category: 'Teint', price: 2500, compare_at_price: null, stock: 6,
    description: 'Une base lissante au fini mat pour flouter les pores et controler la brillance.',
    details: 'Texture veloutee enrichie en kaolin et charbon blanc. Ideale pour les peaux mixtes a grasses.',
    accent: '#282828', active: true, featured: true, product_images: [], product_variants: [],
  },
  {
    id: '10000000-0000-4000-8000-000000000003', slug: 'fixateur-loreal-infaillible',
    name: 'Fixateur Infaillible', brand: "L'Oreal Paris", category: 'Teint', price: 3200, compare_at_price: null, stock: 4,
    description: 'Le spray fixateur rouge pour prolonger la tenue du maquillage sans effet lourd.',
    details: 'Brume fine, sechage rapide et tenue longue duree. Vaporiser a environ 20 cm du visage.',
    accent: '#c9484d', active: true, featured: true, product_images: [], product_variants: [],
  },
  {
    id: '10000000-0000-4000-8000-000000000004', slug: 'primer-nyx-face-glue',
    name: 'The Face Glue Primer', brand: 'NYX Professional Makeup', category: 'Teint', price: 2800, compare_at_price: null, stock: 5,
    description: 'Une base grip hydratante au packaging blanc, rose et bleu, pensee pour une tenue pro.',
    details: 'Fini floute, sensation confortable et adherence longue duree. Format 35 ml.',
    accent: '#ef7fa7', active: true, featured: true, product_images: [], product_variants: [],
  },
]
