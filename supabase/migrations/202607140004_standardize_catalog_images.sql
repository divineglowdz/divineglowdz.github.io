-- Switch the seeded catalogue to smaller baseline JPEG files. New URLs also
-- bypass any cached PNG response that a browser may have decoded incorrectly.
update public.product_images
set
  url = regexp_replace(url, '[.]png$', '.jpg'),
  path = case
    when path like '/assets/products/%.png' then regexp_replace(path, '[.]png$', '.jpg')
    else path
  end
where product_id::text like '20000000-%'
  and url like '/assets/products/%.png';

update public.product_variants
set
  image_url = regexp_replace(image_url, '[.]png$', '.jpg'),
  image_path = case
    when image_path like '/assets/products/%.png' then regexp_replace(image_path, '[.]png$', '.jpg')
    else image_path
  end
where id::text like '21000000-%'
  and image_url like '/assets/products/%.png';
