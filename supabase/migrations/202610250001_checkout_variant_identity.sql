-- Older product edits recreated shade IDs. Resolve old carts only when the
-- requested shade name matches exactly one active shade of that same product.
create or replace function public.place_order(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  created_order public.orders;
  item jsonb;
  resolved_items jsonb := '[]'::jsonb;
  product_row public.products;
  variant_row public.product_variants;
  rate_row public.delivery_rates;
  candidates uuid[];
  item_quantity integer;
  item_price integer;
  subtotal_value integer := 0;
  delivery_value integer;
begin
  if jsonb_typeof(payload->'items') is distinct from 'array' then raise exception 'Le panier est invalide'; end if;
  if jsonb_array_length(payload->'items') = 0 then raise exception 'Le panier est vide'; end if;
  if length(trim(coalesce(payload->>'customer_name',''))) < 2 then raise exception 'Nom invalide'; end if;
  if length(trim(coalesce(payload->>'phone',''))) < 8 then raise exception 'Telephone invalide'; end if;

  select * into rate_row from public.delivery_rates
  where wilaya_code = payload->>'wilaya_code' and active for share;
  if not found then raise exception 'Livraison indisponible pour cette wilaya'; end if;
  delivery_value := case when payload->>'delivery_type' = 'office' then rate_row.office_price else rate_row.home_price end;

  -- Reserve each line under row locks. Any later failure rolls the whole order
  -- back, including earlier lines and repeated requests for the same shade.
  for item in select * from jsonb_array_elements(payload->'items') order by value->>'product_id', value->>'variant_id' loop
    item_quantity := (item->>'quantity')::integer;
    if item_quantity is null or item_quantity < 1 then raise exception 'Quantite invalide'; end if;
    select * into product_row from public.products
    where id = (item->>'product_id')::uuid and active for update;
    if not found then raise exception 'Produit indisponible'; end if;

    variant_row := null;
    if nullif(item->>'variant_id','') is not null or nullif(trim(item->>'variant_name'),'') is not null then
      select * into variant_row from public.product_variants
      where id = nullif(item->>'variant_id','')::uuid and product_id = product_row.id for update;
      if not found then
        select array_agg(v.id) into candidates from public.product_variants v
        where v.product_id = product_row.id and v.active
          and lower(trim(v.value)) = lower(trim(item->>'variant_name'));
        if coalesce(cardinality(candidates), 0) <> 1 then
          raise exception 'Teinte introuvable pour %: %. Choisissez a nouveau votre teinte.', product_row.name, coalesce(item->>'variant_name','');
        end if;
        select * into variant_row from public.product_variants
        where id = candidates[1] and product_id = product_row.id and active for update;
      end if;
      if variant_row.id is null or not variant_row.active then
        raise exception 'Teinte indisponible: % - %', product_row.name, coalesce(item->>'variant_name','');
      end if;
      if variant_row.stock < item_quantity then
        raise exception 'Quantite indisponible: % - %', product_row.name, variant_row.value;
      end if;
      item_price := coalesce(variant_row.price, product_row.price);
      update public.product_variants set stock = stock - item_quantity where id = variant_row.id;
      update public.products set stock = greatest(0, stock - item_quantity) where id = product_row.id;
    else
      if exists (select 1 from public.product_variants where product_id = product_row.id) then
        raise exception 'Choisissez une teinte pour %', product_row.name;
      end if;
      if product_row.stock < item_quantity then raise exception 'Stock insuffisant: %', product_row.name; end if;
      item_price := product_row.price;
      update public.products set stock = stock - item_quantity where id = product_row.id;
    end if;
    subtotal_value := subtotal_value + item_price * item_quantity;
    resolved_items := resolved_items || jsonb_build_array(jsonb_build_object(
      'product_id', product_row.id, 'product_name', product_row.name,
      'variant_id', variant_row.id, 'variant_name', variant_row.value,
      'quantity', item_quantity, 'unit_price', item_price
    ));
  end loop;

  insert into public.orders (customer_name, phone, wilaya_code, wilaya_name, commune, address, delivery_type, delivery_price, subtotal, total, notes)
  values (
    trim(payload->>'customer_name'), trim(payload->>'phone'), rate_row.wilaya_code, rate_row.wilaya_name,
    trim(payload->>'commune'), trim(payload->>'address'),
    case when payload->>'delivery_type' = 'office' then 'office'::public.delivery_type else 'home'::public.delivery_type end,
    delivery_value, subtotal_value, subtotal_value + delivery_value, trim(coalesce(payload->>'notes',''))
  ) returning * into created_order;

  insert into public.order_items (order_id, product_id, product_name, variant_id, variant_name, quantity, unit_price)
  select created_order.id, (value->>'product_id')::uuid, value->>'product_name',
    nullif(value->>'variant_id','')::uuid, value->>'variant_name',
    (value->>'quantity')::integer, (value->>'unit_price')::integer
  from jsonb_array_elements(resolved_items);

  return jsonb_build_object('order_number', created_order.order_number, 'id', created_order.id);
end;
$$;
