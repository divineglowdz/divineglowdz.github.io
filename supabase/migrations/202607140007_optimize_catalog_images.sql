-- Point Supabase records at the compressed HD JPEG versions.

update public.product_images
set url = '/assets/products/laura-mercier-translucent.jpg'
where url = '/assets/products/laura-mercier-translucent.png';

update public.product_variants
set image_url = case image_url
  when '/assets/products/elf-power-grip-dewy-setting-spray.png' then '/assets/products/elf-power-grip-dewy-setting-spray.jpg'
  when '/assets/products/elf-blue-light-setting-mist.png' then '/assets/products/elf-blue-light-setting-mist.jpg'
  else image_url
end
where image_url in (
  '/assets/products/elf-power-grip-dewy-setting-spray.png',
  '/assets/products/elf-blue-light-setting-mist.png'
);
