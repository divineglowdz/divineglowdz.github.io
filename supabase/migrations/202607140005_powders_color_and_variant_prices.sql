-- Powder, blush, bronzer and setting-spray catalogue expansion.
-- Variant prices allow formats of the same product to have different prices.

alter table public.product_variants
  add column if not exists price integer;

do $$
begin
  alter table public.product_variants
    add constraint product_variants_price_nonnegative check (price is null or price >= 0);
exception
  when duplicate_object then null;
end;
$$;

create or replace function public.place_order(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  created_order public.orders;
  item jsonb;
  product_row public.products;
  variant_row public.product_variants;
  rate_row public.delivery_rates;
  item_quantity integer;
  item_price integer;
  subtotal_value integer := 0;
  delivery_value integer;
begin
  if jsonb_array_length(coalesce(payload->'items', '[]'::jsonb)) = 0 then raise exception 'Le panier est vide'; end if;
  if length(trim(coalesce(payload->>'customer_name',''))) < 2 then raise exception 'Nom invalide'; end if;
  if length(trim(coalesce(payload->>'phone',''))) < 8 then raise exception 'Telephone invalide'; end if;

  select * into rate_row from public.delivery_rates
  where wilaya_code = payload->>'wilaya_code' and active for share;
  if not found then raise exception 'Livraison indisponible pour cette wilaya'; end if;
  delivery_value := case when payload->>'delivery_type' = 'office' then rate_row.office_price else rate_row.home_price end;

  for item in select * from jsonb_array_elements(payload->'items') loop
    item_quantity := greatest(1, (item->>'quantity')::integer);
    select * into product_row from public.products
    where id = (item->>'product_id')::uuid and active for update;
    if not found then raise exception 'Produit indisponible'; end if;

    variant_row := null;
    if item ? 'variant_id' and nullif(item->>'variant_id','') is not null then
      select * into variant_row from public.product_variants
      where id = (item->>'variant_id')::uuid and product_id = product_row.id and active for update;
      if not found or variant_row.stock < item_quantity then raise exception 'Option indisponible: %', product_row.name; end if;
      item_price := coalesce(variant_row.price, product_row.price);
    else
      if product_row.stock < item_quantity then raise exception 'Stock insuffisant: %', product_row.name; end if;
      item_price := product_row.price;
    end if;
    subtotal_value := subtotal_value + item_price * item_quantity;
  end loop;

  insert into public.orders (customer_name, phone, wilaya_code, wilaya_name, commune, address, delivery_type, delivery_price, subtotal, total, notes)
  values (
    trim(payload->>'customer_name'), trim(payload->>'phone'), rate_row.wilaya_code, rate_row.wilaya_name,
    trim(payload->>'commune'), trim(payload->>'address'),
    case when payload->>'delivery_type' = 'office' then 'office'::public.delivery_type else 'home'::public.delivery_type end,
    delivery_value, subtotal_value, subtotal_value + delivery_value, trim(coalesce(payload->>'notes',''))
  ) returning * into created_order;

  for item in select * from jsonb_array_elements(payload->'items') loop
    item_quantity := greatest(1, (item->>'quantity')::integer);
    select * into product_row from public.products where id = (item->>'product_id')::uuid for update;
    variant_row := null;
    item_price := product_row.price;

    if item ? 'variant_id' and nullif(item->>'variant_id','') is not null then
      select * into variant_row from public.product_variants
      where id = (item->>'variant_id')::uuid and product_id = product_row.id for update;
      item_price := coalesce(variant_row.price, product_row.price);
      update public.product_variants set stock = stock - item_quantity where id = variant_row.id;
      update public.products set stock = greatest(0, stock - item_quantity) where id = product_row.id;
    else
      update public.products set stock = stock - item_quantity where id = product_row.id;
    end if;

    insert into public.order_items (order_id, product_id, product_name, variant_id, variant_name, quantity, unit_price)
    values (created_order.id, product_row.id, product_row.name, variant_row.id, variant_row.value, item_quantity, item_price);
  end loop;

  return jsonb_build_object('order_number', created_order.order_number, 'id', created_order.id);
end;
$$;

revoke all on function public.place_order(jsonb) from public;
grant execute on function public.place_order(jsonb) to anon, authenticated;

create or replace function public.admin_update_order_items(target_order_id uuid, items jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  order_row public.orders;
  old_item public.order_items;
  item jsonb;
  product_row public.products;
  variant_row public.product_variants;
  item_quantity integer;
  item_price integer;
  subtotal_value integer := 0;
begin
  if not public.is_admin_or_staff() then raise exception 'Acces administrateur requis'; end if;
  if jsonb_array_length(coalesce(items, '[]'::jsonb)) = 0 then raise exception 'La commande doit contenir au moins un produit'; end if;

  select * into order_row from public.orders where id = target_order_id for update;
  if not found then raise exception 'Commande introuvable'; end if;

  for old_item in select * from public.order_items where order_id = target_order_id for update loop
    if old_item.variant_id is not null then
      update public.product_variants set stock = stock + old_item.quantity where id = old_item.variant_id;
      update public.products set stock = stock + old_item.quantity where id = old_item.product_id;
    elsif old_item.product_id is not null then
      update public.products set stock = stock + old_item.quantity where id = old_item.product_id;
    end if;
  end loop;
  delete from public.order_items where order_id = target_order_id;

  for item in select * from jsonb_array_elements(items) loop
    item_quantity := greatest(1, coalesce((item->>'quantity')::integer, 1));
    select * into product_row from public.products where id = (item->>'product_id')::uuid for update;
    if not found then raise exception 'Produit introuvable'; end if;
    variant_row := null;

    if nullif(item->>'variant_id', '') is not null then
      select * into variant_row from public.product_variants
      where id = (item->>'variant_id')::uuid and product_id = product_row.id for update;
      if not found or variant_row.stock < item_quantity then raise exception 'Stock insuffisant: %', product_row.name; end if;
      update public.product_variants set stock = stock - item_quantity where id = variant_row.id;
      update public.products set stock = greatest(0, stock - item_quantity) where id = product_row.id;
    else
      if product_row.stock < item_quantity then raise exception 'Stock insuffisant: %', product_row.name; end if;
      update public.products set stock = stock - item_quantity where id = product_row.id;
    end if;

    item_price := case
      when item ? 'unit_price' and nullif(item->>'unit_price', '') is not null then greatest(0, (item->>'unit_price')::integer)
      else coalesce(variant_row.price, product_row.price)
    end;

    insert into public.order_items (order_id, product_id, product_name, variant_id, variant_name, quantity, unit_price)
    values (target_order_id, product_row.id, product_row.name, variant_row.id, variant_row.value, item_quantity, item_price);
    subtotal_value := subtotal_value + item_price * item_quantity;
  end loop;

  update public.orders set subtotal = subtotal_value, total = subtotal_value + delivery_price
  where id = target_order_id;

  return jsonb_build_object('subtotal', subtotal_value, 'total', subtotal_value + order_row.delivery_price);
end;
$$;

revoke all on function public.admin_update_order_items(uuid, jsonb) from public;
grant execute on function public.admin_update_order_items(uuid, jsonb) to authenticated;

insert into public.products (
  id, slug, name, brand, category, description, details,
  price, compare_at_price, stock, accent, active, featured
) values
  ('30000000-0000-4000-8000-000000000001', 'mini-baby-bake-poudre-huda-beauty', 'Mini Baby Bake Poudre Libre', 'Huda Beauty', 'Teint', 'La poudre libre Easy Bake en format mini pour fixer, lisser et illuminer le teint.', 'Texture fine et legere, ideale pour le baking ou pour fixer le maquillage au quotidien.', 6500, null, 13, '#d8a3a8', true, true),
  ('30000000-0000-4000-8000-000000000002', 'easy-bake-poudre-libre-huda-beauty', 'Easy Bake Poudre Libre', 'Huda Beauty', 'Teint', 'Une poudre libre soyeuse qui fixe le maquillage et floute visiblement le grain de peau.', 'Poudre de finition longue tenue concue pour controler la brillance sans effet lourd.', 11000, null, 3, '#d8a3a8', true, true),
  ('30000000-0000-4000-8000-000000000003', 'fit-me-poudre-libre-maybelline', 'Fit Me Poudre Libre', 'Maybelline', 'Teint', 'Une poudre libre minerale qui matifie et affine visiblement les pores.', 'A appliquer seule ou sur le fond de teint pour un fini naturel et mat.', 2800, null, 12, '#d8a3a8', true, true),
  ('30000000-0000-4000-8000-000000000004', 'fit-me-poudre-compacte-maybelline', 'Fit Me Poudre Compacte', 'Maybelline', 'Teint', 'La poudre compacte Fit Me pour matifier le teint et estomper les pores.', 'Un format compact pratique pour les retouches avec un fini naturel uniforme.', 2200, null, 4, '#d8a3a8', true, true),
  ('30000000-0000-4000-8000-000000000005', 'translucent-loose-setting-powder-laura-mercier', 'Translucent Loose Setting Powder', 'Laura Mercier', 'Teint', 'La poudre libre translucide culte pour fixer le maquillage avec un fini naturel.', 'Une texture ultra-fine qui controle la brillance et prolonge la tenue du teint.', 8500, null, 1, '#d8a3a8', true, true),
  ('30000000-0000-4000-8000-000000000006', 'cant-stop-wont-stop-poudre-libre-nyx', 'Can''t Stop Won''t Stop Poudre Libre', 'NYX Professional Makeup', 'Teint', 'Une poudre libre matifiante qui aide a controler la brillance et lisser le teint.', 'Sa texture legere fixe le maquillage tout en conservant un rendu confortable.', 2300, null, 3, '#d8a3a8', true, true),
  ('30000000-0000-4000-8000-000000000007', 'wonder-snatch-poudre-libre-nyx', 'Wonder Snatch Poudre Libre', 'NYX Professional Makeup', 'Teint', 'Une poudre coloree legere pour apporter une touche fraiche et modulable au teint.', 'La formule se travaille facilement pour construire la couleur sans surcharge.', 2800, null, 3, '#d8a3a8', true, true),
  ('30000000-0000-4000-8000-000000000008', 'airbrush-flawless-finish-poudre-charlotte-tilbury', 'Airbrush Flawless Finish Poudre', 'Charlotte Tilbury', 'Teint', 'Une poudre compacte micro-fine qui matifie et floute sans dessecher le teint.', 'La poudre offre un rendu lisse et lumineux.', 12000, null, 4, '#d8a3a8', true, true),
  ('30000000-0000-4000-8000-000000000009', 'chocolate-soleil-bronzer-too-faced', 'Chocolate Soleil Bronzer', 'Too Faced', 'Teint', 'Un bronzer poudre mat pour rechauffer et definir naturellement le teint.', 'Sa poudre douce se fond facilement et permet une intensite modulable.', 6800, null, 3, '#d8a3a8', true, true),
  ('30000000-0000-4000-8000-000000000010', 'sun-bunny-bronzer-too-faced', 'Sun Bunny Bronzer', 'Too Faced', 'Teint', 'Un bronzer duo lumineux pour un effet bonne mine dore et naturel.', 'Les deux tons se melangent pour personnaliser la chaleur et la luminosite du teint.', 6800, null, 1, '#d8a3a8', true, true),
  ('30000000-0000-4000-8000-000000000011', 'cloud-crush-blush-too-faced', 'Cloud Crush Blush', 'Too Faced', 'Teint', 'Un blush poudre veloute au fini floute et a la couleur modulable.', 'La texture douce se diffuse uniformement pour un effet bonne mine sans traces.', 6800, null, 4, '#d8a3a8', true, true),
  ('30000000-0000-4000-8000-000000000012', 'cookie-highlighter-benefit', 'Cookie Highlighter', 'Benefit Cosmetics', 'Teint', 'Un highlighter poudre dore nacre pour une luminosite intense et soyeuse.', 'Sa texture fine s applique facilement sur les points de lumiere du visage.', 9000, null, 2, '#d8a3a8', true, true),
  ('30000000-0000-4000-8000-000000000013', 'moon-crush-highlighter-too-faced', 'Moon Crush Highlighter', 'Too Faced', 'Teint', 'Un highlighter poudre multidimensionnel pour un eclat lisse et lumineux.', 'La teinte Shooting Star apporte une lumiere elegante et modulable.', 6800, null, 2, '#d8a3a8', true, true),
  ('30000000-0000-4000-8000-000000000014', 'blush-filter-palette-huda-beauty', 'Blush Filter Palette', 'Huda Beauty', 'Teint', 'Une palette de blush aux tons harmonieux pour un effet filtre frais et lumineux.', 'Les nuances se portent seules ou se melangent pour personnaliser le resultat.', 11500, null, 2, '#d8a3a8', true, true),
  ('30000000-0000-4000-8000-000000000015', 'airbrush-flawless-setting-spray-charlotte-tilbury', 'Airbrush Flawless Setting Spray', 'Charlotte Tilbury', 'Teint', 'Une brume fixatrice legere pour prolonger la tenue du maquillage.', 'Le format 34 ml reste masque tant que son prix n est pas renseigne.', 9500, null, 2, '#d8a3a8', true, true),
  ('30000000-0000-4000-8000-000000000016', 'easy-bake-setting-spray-huda-beauty', 'Easy Bake Setting Spray', 'Huda Beauty', 'Teint', 'Une brume fixatrice ultra-fine qui aide a maintenir le maquillage en place.', 'Disponible en deux formats avec un prix et un stock propres a chaque option.', 5500, null, 3, '#d8a3a8', true, true),
  ('30000000-0000-4000-8000-000000000017', 'face-glue-setting-spray-nyx', 'The Face Glue Setting Spray', 'NYX Professional Makeup', 'Teint', 'Un spray fixateur effet grip pour maintenir le maquillage avec un fini frais.', 'La brume fine complete la routine Face Glue et aide a prolonger la tenue.', 2800, null, 3, '#d8a3a8', true, true),
  ('30000000-0000-4000-8000-000000000018', 'setting-sprays-elf', 'Setting Sprays Collection', 'e.l.f.', 'Teint', 'Les brumes fixatrices e.l.f. pour choisir le fini adapte a votre routine.', 'Chaque formule dispose de sa propre photo et de son stock individuel.', 2400, null, 4, '#d8a3a8', true, true),
  ('30000000-0000-4000-8000-000000000019', 'cloud-crush-blush-liquide-too-faced', 'Cloud Crush Blush Liquide', 'Too Faced', 'Teint', 'Un blush liquide aerien qui se fond sur la peau pour une couleur fraiche.', 'La texture se travaille au doigt, a l eponge ou au pinceau.', 5500, null, 2, '#d8a3a8', true, true),
  ('30000000-0000-4000-8000-000000000020', 'soft-pinch-liquid-blush-rare-beauty', 'Soft Pinch Liquid Blush', 'Rare Beauty', 'Teint', 'Un blush liquide pigmente au rendu longue tenue.', 'La formule legere se fond facilement et permet de construire l intensite souhaitee.', 7800, null, 5, '#d8a3a8', true, true),
  ('30000000-0000-4000-8000-000000000021', 'soft-pinch-liquid-contour-rare-beauty', 'Soft Pinch Liquid Contour', 'Rare Beauty', 'Teint', 'Un contour liquide facile a estomper pour sculpter le visage naturellement.', 'Produit masque de la boutique jusqu a la saisie de son prix.', 0, null, 2, '#d8a3a8', false, false),
  ('30000000-0000-4000-8000-000000000022', 'beautiful-skin-sun-kissed-glow-bronzer-charlotte-tilbury', 'Beautiful Skin Sun-Kissed Glow Bronzer', 'Charlotte Tilbury', 'Teint', 'Un bronzer creme qui rechauffe le teint avec un fini naturellement lumineux.', 'Sa texture creme se fond sur la peau et permet de construire l intensite.', 9500, null, 1, '#d8a3a8', true, true),
  ('30000000-0000-4000-8000-000000000023', 'highlight-contour-pro-palette-nyx', 'Highlight & Contour Pro Palette', 'NYX Professional Makeup', 'Teint', 'Une palette complete de poudres pour illuminer, rechauffer et sculpter le visage.', 'Les teintes se melangent facilement pour adapter le contour et la lumiere.', 6000, null, 1, '#d8a3a8', true, true)
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

insert into public.product_images (product_id, path, url, alt, position)
select product.id, null, image.url, product.name, 0
from (values
  ('mini-baby-bake-poudre-huda-beauty', '/assets/products/huda-mini-easy-bake-pound-cake.jpg'),
  ('easy-bake-poudre-libre-huda-beauty', '/assets/products/huda-easy-bake-cupcake.png'),
  ('fit-me-poudre-libre-maybelline', '/assets/products/maybelline-fit-me-loose-05.jpg'),
  ('fit-me-poudre-compacte-maybelline', '/assets/products/maybelline-fit-me-compact-110.jpg'),
  ('translucent-loose-setting-powder-laura-mercier', '/assets/products/laura-mercier-translucent.jpg'),
  ('cant-stop-wont-stop-poudre-libre-nyx', '/assets/products/nyx-csws-light.jpg'),
  ('wonder-snatch-poudre-libre-nyx', '/assets/products/nyx-wonder-snatch-cheeky-cherry.jpg'),
  ('airbrush-flawless-finish-poudre-charlotte-tilbury', '/assets/products/charlotte-airbrush-powder-fair.png'),
  ('chocolate-soleil-bronzer-too-faced', '/assets/products/too-faced-chocolate-soleil.jpg'),
  ('sun-bunny-bronzer-too-faced', '/assets/products/too-faced-sun-bunny.jpg'),
  ('cloud-crush-blush-too-faced', '/assets/products/too-faced-cloud-crush-super-candy-clouds.jpg'),
  ('cookie-highlighter-benefit', '/assets/products/benefit-cookie.jpg'),
  ('moon-crush-highlighter-too-faced', '/assets/products/too-faced-moon-crush-shooting-star.jpg'),
  ('blush-filter-palette-huda-beauty', '/assets/products/huda-blush-filter-baby-pink.jpg'),
  ('airbrush-flawless-setting-spray-charlotte-tilbury', '/assets/products/charlotte-setting-spray-100ml.png'),
  ('easy-bake-setting-spray-huda-beauty', '/assets/products/huda-easy-bake-spray-100ml.png'),
  ('face-glue-setting-spray-nyx', '/assets/products/nyx-face-glue-setting-spray.jpg'),
  ('setting-sprays-elf', '/assets/products/elf-stay-all-night-setting-mist.jpg'),
  ('cloud-crush-blush-liquide-too-faced', '/assets/products/too-faced-cloud-crush-liquid-bed-of-roses.jpg'),
  ('soft-pinch-liquid-blush-rare-beauty', '/assets/products/rare-soft-pinch-blush-hope.jpg'),
  ('soft-pinch-liquid-contour-rare-beauty', '/assets/products/rare-soft-pinch-contour-tranquil.jpg'),
  ('beautiful-skin-sun-kissed-glow-bronzer-charlotte-tilbury', '/assets/products/charlotte-beautiful-skin-bronzer-medium.png'),
  ('highlight-contour-pro-palette-nyx', '/assets/products/nyx-highlight-contour-pro-palette.jpg')
) as image(slug, url)
join public.products product on product.slug = image.slug
where not exists (
  select 1 from public.product_images existing
  where existing.product_id = product.id and existing.url = image.url
);

insert into public.product_variants (
  id, product_id, name, value, color_hex, image_url, image_path, price, stock, active
)
select variant.id::uuid, product.id, variant.name, variant.value, variant.color_hex,
  variant.image_url, null, variant.price, variant.stock, variant.active
from (values
  ('31000000-0000-4000-8000-000000000101', 'mini-baby-bake-poudre-huda-beauty', 'Teinte', 'Pound Cake', '#e9c8ae', '/assets/products/huda-mini-easy-bake-pound-cake.jpg', null::integer, 10, true),
  ('31000000-0000-4000-8000-000000000102', 'mini-baby-bake-poudre-huda-beauty', 'Teinte', 'Cherry Blossom Cake', '#efc1c8', '/assets/products/huda-mini-easy-bake-cherry-blossom.jpg', null, 3, true),
  ('31000000-0000-4000-8000-000000000201', 'easy-bake-poudre-libre-huda-beauty', 'Teinte', 'Cupcake', '#e7c7b0', '/assets/products/huda-easy-bake-cupcake.png', null, 1, true),
  ('31000000-0000-4000-8000-000000000202', 'easy-bake-poudre-libre-huda-beauty', 'Teinte', 'Cherry Peach', '#efc3be', '/assets/products/huda-easy-bake-cherry-blossom.jpg', null, 1, true),
  ('31000000-0000-4000-8000-000000000203', 'easy-bake-poudre-libre-huda-beauty', 'Teinte', 'Banana Bread', '#dfbb87', '/assets/products/huda-easy-bake-banana-bread.jpg', null, 1, true),
  ('31000000-0000-4000-8000-000000000301', 'fit-me-poudre-libre-maybelline', 'Teinte', '05', '#f0d3b6', '/assets/products/maybelline-fit-me-loose-05.jpg', null, 5, true),
  ('31000000-0000-4000-8000-000000000302', 'fit-me-poudre-libre-maybelline', 'Teinte', '10', '#e9c29f', '/assets/products/maybelline-fit-me-loose-10.jpg', null, 5, true),
  ('31000000-0000-4000-8000-000000000303', 'fit-me-poudre-libre-maybelline', 'Teinte', '15', '#ddb18d', '/assets/products/maybelline-fit-me-loose-15.jpg', null, 1, true),
  ('31000000-0000-4000-8000-000000000304', 'fit-me-poudre-libre-maybelline', 'Teinte', '25', '#c99871', '/assets/products/maybelline-fit-me-loose-25.jpg', null, 1, true),
  ('31000000-0000-4000-8000-000000000401', 'fit-me-poudre-compacte-maybelline', 'Teinte', '110', '#f0d2b3', '/assets/products/maybelline-fit-me-compact-110.jpg', null, 1, true),
  ('31000000-0000-4000-8000-000000000402', 'fit-me-poudre-compacte-maybelline', 'Teinte', '112', '#edc9a7', '/assets/products/maybelline-fit-me-compact-112.jpg', null, 1, true),
  ('31000000-0000-4000-8000-000000000403', 'fit-me-poudre-compacte-maybelline', 'Teinte', '120', '#e2b98f', '/assets/products/maybelline-fit-me-compact-120.jpg', null, 1, true),
  ('31000000-0000-4000-8000-000000000404', 'fit-me-poudre-compacte-maybelline', 'Teinte', '130', '#d6a87d', '/assets/products/maybelline-fit-me-compact-130.jpg', null, 1, true),
  ('31000000-0000-4000-8000-000000000601', 'cant-stop-wont-stop-poudre-libre-nyx', 'Teinte', 'Light 01', '#edd2b9', '/assets/products/nyx-csws-light.jpg', null, 2, true),
  ('31000000-0000-4000-8000-000000000602', 'cant-stop-wont-stop-poudre-libre-nyx', 'Teinte', 'Light Medium 02', '#dfbc9a', '/assets/products/nyx-csws-light-medium.jpg', null, 1, true),
  ('31000000-0000-4000-8000-000000000701', 'wonder-snatch-poudre-libre-nyx', 'Teinte', 'Cheeky Cherry', '#d96770', '/assets/products/nyx-wonder-snatch-cheeky-cherry.jpg', null, 2, true),
  ('31000000-0000-4000-8000-000000000702', 'wonder-snatch-poudre-libre-nyx', 'Teinte', 'Sugar Serve', '#dd9da7', '/assets/products/nyx-wonder-snatch-sugar-serve.jpg', null, 1, true),
  ('31000000-0000-4000-8000-000000000801', 'airbrush-flawless-finish-poudre-charlotte-tilbury', 'Teinte', '01 Fair / Clair', '#efd4bd', '/assets/products/charlotte-airbrush-powder-fair.png', null, 3, true),
  ('31000000-0000-4000-8000-000000000802', 'airbrush-flawless-finish-poudre-charlotte-tilbury', 'Teinte', '2 Medium', '#d8ad87', '/assets/products/charlotte-airbrush-powder-medium.png', null, 1, true),
  ('31000000-0000-4000-8000-000000000901', 'chocolate-soleil-bronzer-too-faced', 'Teinte', 'Chocolate Matte', '#a56e4e', '/assets/products/too-faced-chocolate-soleil.jpg', null, 2, true),
  ('31000000-0000-4000-8000-000000000902', 'chocolate-soleil-bronzer-too-faced', 'Teinte', 'Milk Chocolate', '#c58c62', '/assets/products/too-faced-milk-chocolate.jpg', null, 1, true),
  ('31000000-0000-4000-8000-000000001101', 'cloud-crush-blush-too-faced', 'Teinte', 'Super Candy Clouds', '#ef9bad', '/assets/products/too-faced-cloud-crush-super-candy-clouds.jpg', null, 2, true),
  ('31000000-0000-4000-8000-000000001102', 'cloud-crush-blush-too-faced', 'Teinte', 'Candy Clouds', '#eaa3ac', '/assets/products/too-faced-cloud-crush-candy-clouds.jpg', null, 1, true),
  ('31000000-0000-4000-8000-000000001103', 'cloud-crush-blush-too-faced', 'Teinte', 'Tequila Sunset', '#d98268', '/assets/products/too-faced-cloud-crush-tequila-sunset.jpg', null, 1, true),
  ('31000000-0000-4000-8000-000000001301', 'moon-crush-highlighter-too-faced', 'Teinte', 'Shooting Star', '#e9cfb8', '/assets/products/too-faced-moon-crush-shooting-star.jpg', null, 2, true),
  ('31000000-0000-4000-8000-000000001401', 'blush-filter-palette-huda-beauty', 'Teinte', 'Baby Pink', '#eda7b8', '/assets/products/huda-blush-filter-baby-pink.jpg', null, 1, true),
  ('31000000-0000-4000-8000-000000001402', 'blush-filter-palette-huda-beauty', 'Teinte', 'Rose Berry', '#be667b', '/assets/products/huda-blush-filter-rose-berry.jpg', null, 1, true),
  ('31000000-0000-4000-8000-000000001501', 'airbrush-flawless-setting-spray-charlotte-tilbury', 'Format', '200 ml', '#ead4c0', '/assets/products/charlotte-setting-spray-200ml.png', 16000, 1, true),
  ('31000000-0000-4000-8000-000000001502', 'airbrush-flawless-setting-spray-charlotte-tilbury', 'Format', '100 ml', '#ead4c0', '/assets/products/charlotte-setting-spray-100ml.png', 9500, 1, true),
  ('31000000-0000-4000-8000-000000001503', 'airbrush-flawless-setting-spray-charlotte-tilbury', 'Format', '34 ml', '#ead4c0', '/assets/products/charlotte-setting-spray-34ml.png', null, 4, false),
  ('31000000-0000-4000-8000-000000001601', 'easy-bake-setting-spray-huda-beauty', 'Format', '100 ml', '#ead0b7', '/assets/products/huda-easy-bake-spray-100ml.png', 9000, 1, true),
  ('31000000-0000-4000-8000-000000001602', 'easy-bake-setting-spray-huda-beauty', 'Format', '30 ml', '#ead0b7', '/assets/products/huda-easy-bake-spray-30ml.jpg', 5500, 2, true),
  ('31000000-0000-4000-8000-000000001801', 'setting-sprays-elf', 'Formule', 'Stay All Night Micro-Fine Setting Mist', '#b8d5b8', '/assets/products/elf-stay-all-night-setting-mist.jpg', null, 1, true),
  ('31000000-0000-4000-8000-000000001802', 'setting-sprays-elf', 'Formule', 'Dewy Coconut Setting Mist', '#f3eee7', '/assets/products/elf-dewy-coconut-setting-mist.jpg', null, 1, true),
  ('31000000-0000-4000-8000-000000001803', 'setting-sprays-elf', 'Formule', 'Power Grip Dewy Setting Spray', '#b6d8c4', '/assets/products/elf-power-grip-dewy-setting-spray.jpg', null, 1, true),
  ('31000000-0000-4000-8000-000000001804', 'setting-sprays-elf', 'Formule', 'Stay All Night Blue Light Micro Setting Mist', '#bad7eb', '/assets/products/elf-blue-light-setting-mist.jpg', null, 1, true),
  ('31000000-0000-4000-8000-000000001901', 'cloud-crush-blush-liquide-too-faced', 'Teinte', 'Bed of Roses', '#c67b86', '/assets/products/too-faced-cloud-crush-liquid-bed-of-roses.jpg', null, 2, true),
  ('31000000-0000-4000-8000-000000002001', 'soft-pinch-liquid-blush-rare-beauty', 'Teinte', 'Hope', '#b9787d', '/assets/products/rare-soft-pinch-blush-hope.jpg', null, 1, true),
  ('31000000-0000-4000-8000-000000002002', 'soft-pinch-liquid-blush-rare-beauty', 'Teinte', 'Happy', '#df6e8e', '/assets/products/rare-soft-pinch-blush-happy.jpg', null, 3, true),
  ('31000000-0000-4000-8000-000000002003', 'soft-pinch-liquid-blush-rare-beauty', 'Teinte', 'Love', '#aa5f55', '/assets/products/rare-soft-pinch-blush-love.jpg', null, 1, true),
  ('31000000-0000-4000-8000-000000002101', 'soft-pinch-liquid-contour-rare-beauty', 'Teinte', 'Tranquil', '#a67258', '/assets/products/rare-soft-pinch-contour-tranquil.jpg', null, 2, true),
  ('31000000-0000-4000-8000-000000002201', 'beautiful-skin-sun-kissed-glow-bronzer-charlotte-tilbury', 'Teinte', '02 Medium', '#b87f5b', '/assets/products/charlotte-beautiful-skin-bronzer-medium.png', null, 1, true)
) as variant(id, slug, name, value, color_hex, image_url, price, stock, active)
join public.products product on product.slug = variant.slug
on conflict (product_id, value) do update set
  name = excluded.name,
  color_hex = excluded.color_hex,
  image_url = excluded.image_url,
  image_path = excluded.image_path,
  price = excluded.price,
  stock = excluded.stock,
  active = excluded.active;

-- Keep the product-level stock used by catalogue cards in sync with active options.
update public.products product
set stock = totals.stock
from (
  select product_id, coalesce(sum(stock) filter (where active), 0)::integer as stock
  from public.product_variants
  group by product_id
) totals
where product.id = totals.product_id;
