create or replace function public.admin_update_order_items(target_order_id uuid, items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
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
    elsif old_item.product_id is not null then
      update public.products set stock = stock + old_item.quantity where id = old_item.product_id;
    end if;
  end loop;
  delete from public.order_items where order_id = target_order_id;

  for item in select * from jsonb_array_elements(items) loop
    item_quantity := greatest(1, coalesce((item->>'quantity')::integer, 1));
    select * into product_row from public.products where id = (item->>'product_id')::uuid for update;
    if not found then raise exception 'Produit introuvable'; end if;
    item_price := greatest(0, coalesce((item->>'unit_price')::integer, product_row.price));
    variant_row := null;

    if nullif(item->>'variant_id', '') is not null then
      select * into variant_row from public.product_variants
      where id = (item->>'variant_id')::uuid and product_id = product_row.id for update;
      if not found or variant_row.stock < item_quantity then raise exception 'Stock insuffisant: %', product_row.name; end if;
      update public.product_variants set stock = stock - item_quantity where id = variant_row.id;
    else
      if product_row.stock < item_quantity then raise exception 'Stock insuffisant: %', product_row.name; end if;
      update public.products set stock = stock - item_quantity where id = product_row.id;
    end if;

    insert into public.order_items (order_id, product_id, product_name, variant_id, variant_name, quantity, unit_price)
    values (target_order_id, product_row.id, product_row.name, variant_row.id, variant_row.value, item_quantity, item_price);
    subtotal_value := subtotal_value + item_price * item_quantity;
  end loop;

  update public.orders
  set subtotal = subtotal_value, total = subtotal_value + delivery_price
  where id = target_order_id;

  return jsonb_build_object('subtotal', subtotal_value, 'total', subtotal_value + order_row.delivery_price);
end;
$$;

revoke all on function public.admin_update_order_items(uuid, jsonb) from public;
grant execute on function public.admin_update_order_items(uuid, jsonb) to authenticated;
