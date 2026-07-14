import type { Product } from '../types'

type CatalogVariant = {
  value: string
  stock: number
  image: string
  color: string
  price?: number | null
  active?: boolean
  name?: string
}

type CatalogProduct = {
  slug: string
  name: string
  brand: string
  price: number
  description: string
  details: string
  image: string
  stock?: number
  active?: boolean
  featured?: boolean
  optionLabel?: string
  variants?: CatalogVariant[]
}

const catalog: CatalogProduct[] = [
  {
    slug: 'mini-baby-bake-poudre-huda-beauty',
    name: 'Mini Baby Bake Poudre Libre',
    brand: 'Huda Beauty',
    price: 6500,
    description: 'La poudre libre Easy Bake en format mini pour fixer, lisser et illuminer le teint.',
    details: 'Texture fine et legere, ideale pour la technique du baking ou pour fixer le maquillage au quotidien.',
    image: 'huda-mini-easy-bake-pound-cake.jpg',
    variants: [
      { value: 'Pound Cake', stock: 10, image: 'huda-mini-easy-bake-pound-cake.jpg', color: '#e9c8ae' },
      { value: 'Cherry Blossom Cake', stock: 3, image: 'huda-mini-easy-bake-cherry-blossom.jpg', color: '#efc1c8' },
    ],
  },
  {
    slug: 'easy-bake-poudre-libre-huda-beauty',
    name: 'Easy Bake Poudre Libre',
    brand: 'Huda Beauty',
    price: 11000,
    description: 'Une poudre libre soyeuse qui fixe le maquillage et floute visiblement le grain de peau.',
    details: 'Poudre de finition longue tenue concue pour controler la brillance sans effet lourd.',
    image: 'huda-easy-bake-cupcake.png',
    variants: [
      { value: 'Cupcake', stock: 1, image: 'huda-easy-bake-cupcake.png', color: '#e7c7b0' },
      { value: 'Cherry Peach', stock: 1, image: 'huda-easy-bake-cherry-blossom.jpg', color: '#efc3be' },
      { value: 'Banana Bread', stock: 1, image: 'huda-easy-bake-banana-bread.jpg', color: '#dfbb87' },
    ],
  },
  {
    slug: 'fit-me-poudre-libre-maybelline',
    name: 'Fit Me Poudre Libre',
    brand: 'Maybelline',
    price: 2800,
    description: 'Une poudre libre minerale qui matifie et affine visiblement les pores.',
    details: 'A appliquer seule ou sur le fond de teint pour un fini naturel et mat.',
    image: 'maybelline-fit-me-loose-05.jpg',
    variants: [
      { value: '05', stock: 5, image: 'maybelline-fit-me-loose-05.jpg', color: '#f0d3b6' },
      { value: '10', stock: 5, image: 'maybelline-fit-me-loose-10.jpg', color: '#e9c29f' },
      { value: '15', stock: 1, image: 'maybelline-fit-me-loose-15.jpg', color: '#ddb18d' },
      { value: '25', stock: 1, image: 'maybelline-fit-me-loose-25.jpg', color: '#c99871' },
    ],
  },
  {
    slug: 'fit-me-poudre-compacte-maybelline',
    name: 'Fit Me Poudre Compacte',
    brand: 'Maybelline',
    price: 2200,
    description: 'La poudre compacte Fit Me pour matifier le teint et estomper les pores.',
    details: 'Son format compact est pratique pour les retouches et offre un fini naturel uniforme.',
    image: 'maybelline-fit-me-compact-110.jpg',
    variants: [
      { value: '110', stock: 1, image: 'maybelline-fit-me-compact-110.jpg', color: '#f0d2b3' },
      { value: '112', stock: 1, image: 'maybelline-fit-me-compact-112.jpg', color: '#edc9a7' },
      { value: '120', stock: 1, image: 'maybelline-fit-me-compact-120.jpg', color: '#e2b98f' },
      { value: '130', stock: 1, image: 'maybelline-fit-me-compact-130.jpg', color: '#d6a87d' },
    ],
  },
  {
    slug: 'translucent-loose-setting-powder-laura-mercier',
    name: 'Translucent Loose Setting Powder',
    brand: 'Laura Mercier',
    price: 8500,
    stock: 1,
    description: 'La poudre libre translucide culte pour fixer le maquillage avec un fini naturel.',
    details: 'Une texture ultra-fine qui controle la brillance et prolonge la tenue du teint.',
    image: 'laura-mercier-translucent.jpg',
  },
  {
    slug: 'cant-stop-wont-stop-poudre-libre-nyx',
    name: "Can't Stop Won't Stop Poudre Libre",
    brand: 'NYX Professional Makeup',
    price: 2300,
    description: 'Une poudre libre matifiante qui aide a controler la brillance et lisser le teint.',
    details: 'Sa texture legere fixe le maquillage tout en conservant un rendu confortable.',
    image: 'nyx-csws-light.jpg',
    variants: [
      { value: 'Light 01', stock: 2, image: 'nyx-csws-light.jpg', color: '#edd2b9' },
      { value: 'Light Medium 02', stock: 1, image: 'nyx-csws-light-medium.jpg', color: '#dfbc9a' },
    ],
  },
  {
    slug: 'wonder-snatch-poudre-libre-nyx',
    name: 'Wonder Snatch Poudre Libre',
    brand: 'NYX Professional Makeup',
    price: 2800,
    description: 'Une poudre coloree legere pour apporter une touche fraiche et modulable au teint.',
    details: 'La formule se travaille facilement pour construire la couleur sans surcharge.',
    image: 'nyx-wonder-snatch-cheeky-cherry.jpg',
    variants: [
      { value: 'Cheeky Cherry', stock: 2, image: 'nyx-wonder-snatch-cheeky-cherry.jpg', color: '#d96770' },
      { value: 'Sugar Serve', stock: 1, image: 'nyx-wonder-snatch-sugar-serve.jpg', color: '#dd9da7' },
    ],
  },
  {
    slug: 'airbrush-flawless-finish-poudre-charlotte-tilbury',
    name: 'Airbrush Flawless Finish Poudre',
    brand: 'Charlotte Tilbury',
    price: 12000,
    description: 'Une poudre compacte micro-fine qui matifie et floute sans dessecher le teint.',
    details: 'La poudre de finition Airbrush Flawless Finish offre un rendu lisse et lumineux.',
    image: 'charlotte-airbrush-powder-fair.png',
    variants: [
      { value: '01 Fair / Clair', stock: 3, image: 'charlotte-airbrush-powder-fair.png', color: '#efd4bd' },
      { value: '2 Medium', stock: 1, image: 'charlotte-airbrush-powder-medium.png', color: '#d8ad87' },
    ],
  },
  {
    slug: 'chocolate-soleil-bronzer-too-faced',
    name: 'Chocolate Soleil Bronzer',
    brand: 'Too Faced',
    price: 6800,
    description: 'Un bronzer poudre mat pour rechauffer et definir naturellement le teint.',
    details: 'Sa poudre douce se fond facilement et permet une intensite modulable.',
    image: 'too-faced-chocolate-soleil.jpg',
    variants: [
      { value: 'Chocolate Matte', stock: 2, image: 'too-faced-chocolate-soleil.jpg', color: '#a56e4e' },
      { value: 'Milk Chocolate', stock: 1, image: 'too-faced-milk-chocolate.jpg', color: '#c58c62' },
    ],
  },
  {
    slug: 'sun-bunny-bronzer-too-faced',
    name: 'Sun Bunny Bronzer',
    brand: 'Too Faced',
    price: 6800,
    stock: 1,
    description: 'Un bronzer duo lumineux pour un effet bonne mine dore et naturel.',
    details: 'Les deux tons se melangent pour personnaliser la chaleur et la luminosite du teint.',
    image: 'too-faced-sun-bunny.jpg',
  },
  {
    slug: 'cloud-crush-blush-too-faced',
    name: 'Cloud Crush Blush',
    brand: 'Too Faced',
    price: 6800,
    description: 'Un blush poudre veloute au fini floute et a la couleur modulable.',
    details: 'La texture douce se diffuse uniformement pour un effet bonne mine sans traces.',
    image: 'too-faced-cloud-crush-super-candy-clouds.jpg',
    variants: [
      { value: 'Super Candy Clouds', stock: 2, image: 'too-faced-cloud-crush-super-candy-clouds.jpg', color: '#ef9bad' },
      { value: 'Candy Clouds', stock: 1, image: 'too-faced-cloud-crush-candy-clouds.jpg', color: '#eaa3ac' },
      { value: 'Tequila Sunset', stock: 1, image: 'too-faced-cloud-crush-tequila-sunset.jpg', color: '#d98268' },
    ],
  },
  {
    slug: 'cookie-highlighter-benefit',
    name: 'Cookie Highlighter',
    brand: 'Benefit Cosmetics',
    price: 9000,
    stock: 2,
    description: 'Un highlighter poudre dore nacre pour une luminosite intense et soyeuse.',
    details: 'Sa texture fine s applique facilement sur les points de lumiere du visage.',
    image: 'benefit-cookie.jpg',
  },
  {
    slug: 'moon-crush-highlighter-too-faced',
    name: 'Moon Crush Highlighter',
    brand: 'Too Faced',
    price: 6800,
    description: 'Un highlighter poudre multidimensionnel pour un eclat lisse et lumineux.',
    details: 'La teinte Shooting Star apporte une lumiere elegante et modulable.',
    image: 'too-faced-moon-crush-shooting-star.jpg',
    variants: [
      { value: 'Shooting Star', stock: 2, image: 'too-faced-moon-crush-shooting-star.jpg', color: '#e9cfb8' },
    ],
  },
  {
    slug: 'blush-filter-palette-huda-beauty',
    name: 'Blush Filter Palette',
    brand: 'Huda Beauty',
    price: 11500,
    description: 'Une palette de blush aux tons harmonieux pour un effet filtre frais et lumineux.',
    details: 'Les nuances se portent seules ou se melangent pour personnaliser le resultat.',
    image: 'huda-blush-filter-baby-pink.jpg',
    variants: [
      { value: 'Baby Pink', stock: 1, image: 'huda-blush-filter-baby-pink.jpg', color: '#eda7b8' },
      { value: 'Rose Berry', stock: 1, image: 'huda-blush-filter-rose-berry.jpg', color: '#be667b' },
    ],
  },
  {
    slug: 'airbrush-flawless-setting-spray-charlotte-tilbury',
    name: 'Airbrush Flawless Setting Spray',
    brand: 'Charlotte Tilbury',
    price: 9500,
    description: 'Une brume fixatrice legere pour prolonger la tenue du maquillage et lisser son fini.',
    details: 'Choisissez le format souhaite. Le format 34 ml reste masque tant que son prix n est pas renseigne.',
    image: 'charlotte-setting-spray-100ml.png',
    optionLabel: 'Format',
    variants: [
      { name: 'Format', value: '200 ml', stock: 1, price: 16000, image: 'charlotte-setting-spray-200ml.png', color: '#ead4c0' },
      { name: 'Format', value: '100 ml', stock: 1, price: 9500, image: 'charlotte-setting-spray-100ml.png', color: '#ead4c0' },
      { name: 'Format', value: '34 ml', stock: 4, price: null, active: false, image: 'charlotte-setting-spray-34ml.png', color: '#ead4c0' },
    ],
  },
  {
    slug: 'easy-bake-setting-spray-huda-beauty',
    name: 'Easy Bake Setting Spray',
    brand: 'Huda Beauty',
    price: 5500,
    description: 'Une brume fixatrice ultra-fine qui aide a maintenir le maquillage en place.',
    details: 'Disponible en deux formats avec un prix et un stock propres a chaque option.',
    image: 'huda-easy-bake-spray-100ml.png',
    optionLabel: 'Format',
    variants: [
      { name: 'Format', value: '100 ml', stock: 1, price: 9000, image: 'huda-easy-bake-spray-100ml.png', color: '#ead0b7' },
      { name: 'Format', value: '30 ml', stock: 2, price: 5500, image: 'huda-easy-bake-spray-30ml.jpg', color: '#ead0b7' },
    ],
  },
  {
    slug: 'face-glue-setting-spray-nyx',
    name: 'The Face Glue Setting Spray',
    brand: 'NYX Professional Makeup',
    price: 2800,
    stock: 3,
    description: 'Un spray fixateur effet grip pour maintenir le maquillage avec un fini frais.',
    details: 'La brume fine complete la routine Face Glue et aide a prolonger la tenue.',
    image: 'nyx-face-glue-setting-spray.jpg',
  },
  {
    slug: 'setting-sprays-elf',
    name: 'Setting Sprays Collection',
    brand: 'e.l.f.',
    price: 2400,
    description: 'Les brumes fixatrices e.l.f. pour choisir le fini adapte a votre routine.',
    details: 'Chaque formule dispose de sa propre photo et de son stock individuel.',
    image: 'elf-stay-all-night-setting-mist.jpg',
    optionLabel: 'Formule',
    variants: [
      { name: 'Formule', value: 'Stay All Night Micro-Fine Setting Mist', stock: 1, image: 'elf-stay-all-night-setting-mist.jpg', color: '#b8d5b8' },
      { name: 'Formule', value: 'Dewy Coconut Setting Mist', stock: 1, image: 'elf-dewy-coconut-setting-mist.jpg', color: '#f3eee7' },
      { name: 'Formule', value: 'Power Grip Dewy Setting Spray', stock: 1, image: 'elf-power-grip-dewy-setting-spray.jpg', color: '#b6d8c4' },
      { name: 'Formule', value: 'Stay All Night Blue Light Micro Setting Mist', stock: 1, image: 'elf-blue-light-setting-mist.jpg', color: '#bad7eb' },
    ],
  },
  {
    slug: 'cloud-crush-blush-liquide-too-faced',
    name: 'Cloud Crush Blush Liquide',
    brand: 'Too Faced',
    price: 5500,
    description: 'Un blush liquide aerien qui se fond sur la peau pour une couleur fraiche.',
    details: 'La texture se travaille au doigt, a l eponge ou au pinceau et reste modulable.',
    image: 'too-faced-cloud-crush-liquid-bed-of-roses.jpg',
    variants: [
      { value: 'Bed of Roses', stock: 2, image: 'too-faced-cloud-crush-liquid-bed-of-roses.jpg', color: '#c67b86' },
    ],
  },
  {
    slug: 'soft-pinch-liquid-blush-rare-beauty',
    name: 'Soft Pinch Liquid Blush',
    brand: 'Rare Beauty',
    price: 7800,
    description: 'Un blush liquide pigmente dont une petite quantite suffit pour un effet longue tenue.',
    details: 'La formule legere se fond facilement et permet de construire l intensite souhaitee.',
    image: 'rare-soft-pinch-blush-hope.jpg',
    variants: [
      { value: 'Hope', stock: 1, image: 'rare-soft-pinch-blush-hope.jpg', color: '#b9787d' },
      { value: 'Happy', stock: 3, image: 'rare-soft-pinch-blush-happy.jpg', color: '#df6e8e' },
      { value: 'Love', stock: 1, image: 'rare-soft-pinch-blush-love.jpg', color: '#aa5f55' },
    ],
  },
  {
    slug: 'soft-pinch-liquid-contour-rare-beauty',
    name: 'Soft Pinch Liquid Contour',
    brand: 'Rare Beauty',
    price: 0,
    active: false,
    featured: false,
    description: 'Un contour liquide facile a estomper pour sculpter le visage naturellement.',
    details: 'Le produit est prepare dans l admin mais masque de la boutique jusqu a la saisie de son prix.',
    image: 'rare-soft-pinch-contour-tranquil.jpg',
    variants: [
      { value: 'Tranquil', stock: 2, image: 'rare-soft-pinch-contour-tranquil.jpg', color: '#a67258' },
    ],
  },
  {
    slug: 'beautiful-skin-sun-kissed-glow-bronzer-charlotte-tilbury',
    name: 'Beautiful Skin Sun-Kissed Glow Bronzer',
    brand: 'Charlotte Tilbury',
    price: 9500,
    description: 'Un bronzer creme qui rechauffe le teint avec un fini lisse et naturellement lumineux.',
    details: 'Sa texture creme se fond sur la peau et permet de construire progressivement l intensite.',
    image: 'charlotte-beautiful-skin-bronzer-medium.png',
    variants: [
      { value: '02 Medium', stock: 1, image: 'charlotte-beautiful-skin-bronzer-medium.png', color: '#b87f5b' },
    ],
  },
  {
    slug: 'highlight-contour-pro-palette-nyx',
    name: 'Highlight & Contour Pro Palette',
    brand: 'NYX Professional Makeup',
    price: 6000,
    stock: 1,
    description: 'Une palette complete de poudres pour illuminer, rechauffer et sculpter le visage.',
    details: 'Les teintes se melangent facilement pour adapter le contour et la lumiere a votre carnation.',
    image: 'nyx-highlight-contour-pro-palette.jpg',
  },
]

const productId = (index: number) => `30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
const variantId = (productIndex: number, variantIndex: number) => `31000000-0000-4000-8000-${String((productIndex + 1) * 100 + variantIndex + 1).padStart(12, '0')}`
const imageUrl = (file: string) => `/assets/products/${file}`

export const catalogPowderProducts: Product[] = catalog.map((item, productIndex) => ({
  id: productId(productIndex),
  slug: item.slug,
  name: item.name,
  brand: item.brand,
  category: 'Teint',
  description: item.description,
  details: item.details,
  price: item.price,
  compare_at_price: null,
  stock: item.variants
    ? item.variants.filter((variant) => variant.active !== false).reduce((sum, variant) => sum + variant.stock, 0)
    : item.stock || 0,
  accent: '#d8a3a8',
  active: item.active ?? true,
  featured: item.featured ?? true,
  product_images: [{ url: imageUrl(item.image), alt: item.name, position: 0 }],
  product_variants: (item.variants || []).map((variant, variantIndex) => ({
    id: variantId(productIndex, variantIndex),
    name: variant.name || item.optionLabel || 'Teinte',
    value: variant.value,
    color_hex: variant.color,
    image_url: imageUrl(variant.image),
    image_path: null,
    price: variant.price ?? null,
    stock: variant.stock,
    active: variant.active ?? true,
  })),
}))
