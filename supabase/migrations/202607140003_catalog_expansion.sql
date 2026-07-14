-- Product shade imagery and the July catalog expansion.

alter table public.product_variants
  add column if not exists image_url text,
  add column if not exists image_path text;

insert into public.products (
  id, slug, name, brand, category, description, details,
  price, compare_at_price, stock, accent, active, featured
) values
  ('20000000-0000-4000-8000-000000000001', 'elf-power-grip-niacinamide', 'Power Grip Primer + 4% Niacinamide', 'e.l.f.', 'Teint', 'Le primer gel orange enrichi en niacinamide qui hydrate, unifie et agrippe le maquillage.', 'Une base gel hydratante à 4% de niacinamide, conçue pour lisser visuellement le teint et prolonger la tenue du maquillage.', 2500, null, 3, '#ef8d4a', true, true),
  ('20000000-0000-4000-8000-000000000002', 'elf-mint-melt-cooling-face-primer', 'Mint Melt Cooling Face Primer', 'e.l.f.', 'Teint', 'Une base gel fraîche à la menthe qui prépare la peau et aide le maquillage à rester en place.', 'Texture gel rafraîchissante avec effet grip. Elle laisse la peau confortable et prête pour une application uniforme du teint.', 2500, null, 3, '#70cbb7', true, true),
  ('20000000-0000-4000-8000-000000000003', 'elf-liquid-poreless-putty-primer', 'Liquid Poreless Putty Primer', 'e.l.f.', 'Teint', 'La base liquide rose clair qui lisse visuellement les pores et prépare un teint uniforme.', 'La performance lissante du Poreless Putty Primer dans une texture liquide légère, facile à étaler et confortable.', 2500, null, 3, '#efc1ce', true, true),
  ('20000000-0000-4000-8000-000000000004', 'elf-liquid-poreless-putty-primer-cica', 'Liquid Poreless Putty Primer + Cica', 'e.l.f.', 'Teint', 'La base liquide verte au cica qui lisse les pores tout en apaisant visuellement la peau.', 'Une formule légère enrichie en cica, pensée pour préparer, lisser et apporter du confort avant le maquillage.', 2500, null, 1, '#8bb68a', true, true),
  ('20000000-0000-4000-8000-000000000005', 'huda-beauty-easy-blur-primer', 'Easy Blur Primer', 'Huda Beauty', 'Teint', 'Une base lissante sans silicone qui aide à flouter l’apparence des pores et de la texture.', 'Primer lissant à la texture gel légère, conçu pour créer une base douce et uniforme avant le fond de teint.', 9000, null, 1, '#e7a9c2', true, true),
  ('20000000-0000-4000-8000-000000000006', 'huda-beauty-mini-easy-blur-primer', 'Mini Easy Blur Primer', 'Huda Beauty', 'Teint', 'Le primer Easy Blur en format mini pratique, idéal pour les retouches et les déplacements.', 'Format 10 ml de la base lissante sans silicone Easy Blur, avec la même texture légère et floutante.', 5500, null, 2, '#e7a9c2', true, true),
  ('20000000-0000-4000-8000-000000000007', 'elf-halo-glow-liquid-filter', 'Halo Glow Liquid Filter', 'e.l.f.', 'Teint', 'Un booster d’éclat liquide modulable à porter seul, sous le maquillage ou mélangé au fond de teint.', 'Une formule lumineuse polyvalente qui apporte un fini frais et éclatant sans effet lourd.', 3500, null, 6, '#d9ad8d', true, true),
  ('20000000-0000-4000-8000-000000000008', 'loreal-true-match-lumi-glotion', 'True Match Lumi Glotion', 'L''Oréal Paris', 'Teint', 'Un illuminateur liquide hydratant qui apporte un éclat naturel au visage et au corps.', 'À porter seul, sous le maquillage ou sur les points de lumière pour un fini lumineux personnalisable.', 2400, null, 8, '#b7795c', true, true),
  ('20000000-0000-4000-8000-000000000009', 'nyx-make-em-wonder-foundation', 'Make ''Em Wonder Soft Matte Foundation', 'NYX Professional Makeup', 'Teint', 'Un fond de teint soft matte léger et modulable pour un fini peau naturelle confortable.', 'Une couvrance modulable et une texture légère conçues pour lisser visuellement le teint sans effet masque.', 2900, null, 10, '#e43ca8', true, true),
  ('20000000-0000-4000-8000-000000000010', 'charlotte-tilbury-beautiful-skin-foundation', 'Beautiful Skin Foundation', 'Charlotte Tilbury', 'Teint', 'Un fond de teint hydratant à couvrance moyenne modulable pour un fini lumineux naturel.', 'Une formule confortable qui unifie le teint tout en conservant un aspect frais et lumineux.', 6500, null, 5, '#c58f70', true, true)
on conflict (slug) do update set
  name = excluded.name,
  brand = excluded.brand,
  category = excluded.category,
  description = excluded.description,
  details = excluded.details,
  price = excluded.price,
  compare_at_price = excluded.compare_at_price,
  stock = excluded.stock,
  accent = excluded.accent,
  active = excluded.active,
  featured = excluded.featured,
  updated_at = now();

delete from public.product_images
where path is null
  and url like '/assets/products/%'
  and product_id in (
    select id from public.products where slug in (
      'elf-power-grip-niacinamide',
      'elf-mint-melt-cooling-face-primer',
      'elf-liquid-poreless-putty-primer',
      'elf-liquid-poreless-putty-primer-cica',
      'huda-beauty-easy-blur-primer',
      'huda-beauty-mini-easy-blur-primer',
      'elf-halo-glow-liquid-filter',
      'loreal-true-match-lumi-glotion',
      'nyx-make-em-wonder-foundation',
      'charlotte-tilbury-beautiful-skin-foundation'
    )
  );

insert into public.product_images (product_id, path, url, alt, position)
select p.id, null, image.url, image.alt, 0
from (values
  ('elf-power-grip-niacinamide', '/assets/products/elf-power-grip-niacinamide.png', 'e.l.f. Power Grip Primer + 4% Niacinamide'),
  ('elf-mint-melt-cooling-face-primer', '/assets/products/elf-mint-melt-primer.png', 'e.l.f. Mint Melt Cooling Face Primer'),
  ('elf-liquid-poreless-putty-primer', '/assets/products/elf-liquid-poreless-putty.png', 'e.l.f. Liquid Poreless Putty Primer rose clair'),
  ('elf-liquid-poreless-putty-primer-cica', '/assets/products/elf-liquid-poreless-putty-cica.png', 'e.l.f. Liquid Poreless Putty Primer + Cica'),
  ('huda-beauty-easy-blur-primer', '/assets/products/huda-easy-blur-primer.png', 'Huda Beauty Easy Blur Primer'),
  ('huda-beauty-mini-easy-blur-primer', '/assets/products/huda-mini-easy-blur-primer.png', 'Huda Beauty Mini Easy Blur Primer'),
  ('elf-halo-glow-liquid-filter', '/assets/products/elf-halo-glow-liquid-filter.png', 'e.l.f. Halo Glow Liquid Filter'),
  ('loreal-true-match-lumi-glotion', '/assets/products/loreal-lumi-glotion.png', 'L''Oréal Paris True Match Lumi Glotion'),
  ('nyx-make-em-wonder-foundation', '/assets/products/nyx-make-em-wonder.png', 'NYX Make ''Em Wonder Soft Matte Foundation'),
  ('charlotte-tilbury-beautiful-skin-foundation', '/assets/products/charlotte-beautiful-skin.png', 'Charlotte Tilbury Beautiful Skin Foundation')
) as image(slug, url, alt)
join public.products p on p.slug = image.slug;

insert into public.product_variants (
  id, product_id, name, value, color_hex, image_url, image_path, stock, active
)
select variant.id::uuid, product.id, 'Teinte', variant.value, variant.color_hex, variant.image_url, null, variant.stock, true
from (values
  ('21000000-0000-4000-8000-000000000701', 'elf-halo-glow-liquid-filter', '0 Fair Neutral Warm', '#e4bc98', '/assets/products/elf-halo-glow-0.png', 1),
  ('21000000-0000-4000-8000-000000000702', 'elf-halo-glow-liquid-filter', '01 Fair Neutral Peach', '#eac6ac', '/assets/products/elf-halo-glow-1.png', 2),
  ('21000000-0000-4000-8000-000000000703', 'elf-halo-glow-liquid-filter', '02 Fair/Light', '#dcc1a6', '/assets/products/elf-halo-glow-2.png', 1),
  ('21000000-0000-4000-8000-000000000704', 'elf-halo-glow-liquid-filter', '03 Light/Medium Cool', '#d6ad91', '/assets/products/elf-halo-glow-3.png', 2),
  ('21000000-0000-4000-8000-000000000801', 'loreal-true-match-lumi-glotion', '903 Medium Glow', '#c58f72', '/assets/products/loreal-lumi-glotion-903.png', 4),
  ('21000000-0000-4000-8000-000000000802', 'loreal-true-match-lumi-glotion', '904 Deep Glow', '#9a5e3d', '/assets/products/loreal-lumi-glotion-904.png', 1),
  ('21000000-0000-4000-8000-000000000803', 'loreal-true-match-lumi-glotion', '905 Rich', '#75401f', '/assets/products/loreal-lumi-glotion-905.png', 3),
  ('21000000-0000-4000-8000-000000000901', 'nyx-make-em-wonder-foundation', '02 Fair Porcelain', '#f4c4ad', '/assets/products/nyx-make-em-wonder-02.png', 1),
  ('21000000-0000-4000-8000-000000000902', 'nyx-make-em-wonder-foundation', '06 Light', '#efb692', '/assets/products/nyx-make-em-wonder-06.png', 2),
  ('21000000-0000-4000-8000-000000000903', 'nyx-make-em-wonder-foundation', '08 Vanilla', '#e5ae82', '/assets/products/nyx-make-em-wonder-08.png', 3),
  ('21000000-0000-4000-8000-000000000904', 'nyx-make-em-wonder-foundation', '10 Nude', '#d9a174', '/assets/products/nyx-make-em-wonder-10.png', 2),
  ('21000000-0000-4000-8000-000000000905', 'nyx-make-em-wonder-foundation', '12 Natural', '#c58b61', '/assets/products/nyx-make-em-wonder-12.png', 2),
  ('21000000-0000-4000-8000-000000001001', 'charlotte-tilbury-beautiful-skin-foundation', '2 Warm / Chaud', '#f1c7a4', '/assets/products/charlotte-beautiful-skin-2-warm.png', 1),
  ('21000000-0000-4000-8000-000000001002', 'charlotte-tilbury-beautiful-skin-foundation', '3 Neutral / Neutre', '#e8bb99', '/assets/products/charlotte-beautiful-skin-3-neutral.png', 1),
  ('21000000-0000-4000-8000-000000001003', 'charlotte-tilbury-beautiful-skin-foundation', '4 Neutral / Neutre', '#dca982', '/assets/products/charlotte-beautiful-skin-4-neutral.png', 1),
  ('21000000-0000-4000-8000-000000001004', 'charlotte-tilbury-beautiful-skin-foundation', '4 Warm / Chaud', '#d6a073', '/assets/products/charlotte-beautiful-skin-4-warm.png', 1),
  ('21000000-0000-4000-8000-000000001005', 'charlotte-tilbury-beautiful-skin-foundation', '5 Neutral / Neutre', '#c8946d', '/assets/products/charlotte-beautiful-skin-5-neutral.png', 1)
) as variant(id, slug, value, color_hex, image_url, stock)
join public.products product on product.slug = variant.slug
on conflict (product_id, value) do update set
  color_hex = excluded.color_hex,
  image_url = excluded.image_url,
  image_path = excluded.image_path,
  stock = excluded.stock,
  active = excluded.active;
