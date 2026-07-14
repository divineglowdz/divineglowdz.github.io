-- Match seeded URLs to the real file formats so static hosts return the
-- correct content type and browsers never render a corrupted image.

update public.product_images
set url = case url
  when '/assets/products/huda-blush-filter-baby-pink.webp' then '/assets/products/huda-blush-filter-baby-pink.jpg'
  when '/assets/products/huda-easy-bake-spray-100ml.webp' then '/assets/products/huda-easy-bake-spray-100ml.png'
  else url
end
where url in (
  '/assets/products/huda-blush-filter-baby-pink.webp',
  '/assets/products/huda-easy-bake-spray-100ml.webp'
);

update public.product_variants
set image_url = case image_url
  when '/assets/products/huda-easy-bake-banana-bread.webp' then '/assets/products/huda-easy-bake-banana-bread.jpg'
  when '/assets/products/huda-blush-filter-baby-pink.webp' then '/assets/products/huda-blush-filter-baby-pink.jpg'
  when '/assets/products/huda-blush-filter-rose-berry.webp' then '/assets/products/huda-blush-filter-rose-berry.jpg'
  when '/assets/products/huda-easy-bake-spray-100ml.webp' then '/assets/products/huda-easy-bake-spray-100ml.png'
  else image_url
end
where image_url in (
  '/assets/products/huda-easy-bake-banana-bread.webp',
  '/assets/products/huda-blush-filter-baby-pink.webp',
  '/assets/products/huda-blush-filter-rose-berry.webp',
  '/assets/products/huda-easy-bake-spray-100ml.webp'
);
