alter table public.orders add column if not exists stock_released boolean not null default false;

-- Imported orders may still reference hidden archive products. Resolve only
-- unambiguous matches before touching live inventory.
create or replace function public.resolve_order_stock_item(
  item_product_id uuid, item_variant_id uuid, item_product_name text, item_variant_name text
)
returns table (product_id uuid, variant_id uuid)
language plpgsql security definer set search_path = public
as $$
declare
  resolved_product_id uuid;
  resolved_variant_id uuid;
  candidates uuid[];
begin
  select p.id into resolved_product_id from public.products p
  where p.id = item_product_id and p.slug not like 'historique-%';

  if resolved_product_id is null then
    select array_agg(p.id) into candidates from public.products p
    where lower(trim(p.name)) = lower(trim(item_product_name)) and p.slug not like 'historique-%';
    if coalesce(cardinality(candidates), 0) <> 1 then
      raise exception 'Produit a relier avant remise en stock: %', item_product_name;
    end if;
    resolved_product_id := candidates[1];
  end if;

  select v.id into resolved_variant_id from public.product_variants v
  where v.id = item_variant_id and v.product_id = resolved_product_id;

  if resolved_variant_id is null and nullif(trim(item_variant_name), '') is not null then
    select array_agg(v.id) into candidates from public.product_variants v
    where v.product_id = resolved_product_id and lower(trim(v.value)) = lower(trim(item_variant_name));
    if coalesce(cardinality(candidates), 0) <> 1 then
      raise exception 'Teinte a relier avant remise en stock: % - %', item_product_name, item_variant_name;
    end if;
    resolved_variant_id := candidates[1];
  end if;

  if resolved_variant_id is null and exists (
    select 1 from public.product_variants v where v.product_id = resolved_product_id
  ) then
    raise exception 'Teinte manquante pour la commande: %', item_product_name;
  end if;

  return query select resolved_product_id, resolved_variant_id;
end;
$$;
revoke all on function public.resolve_order_stock_item(uuid, uuid, text, text) from public, anon, authenticated;

create or replace function public.manage_order_status_stock()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  release_stock boolean;
  line public.order_items;
  target record;
  adjustment record;
  available integer;
begin
  -- The flag is controlled here, never by client-supplied updates.
  new.stock_released := old.stock_released;
  if new.status is not distinct from old.status then return new; end if;

  release_stock := new.status::text in ('annulee', 'retour');
  if release_stock = old.stock_released then return new; end if;

  for line in select * from public.order_items where order_id = old.id order by id for update loop
    select * into target from public.resolve_order_stock_item(line.product_id, line.variant_id, line.product_name, line.variant_name);
    update public.order_items set product_id = target.product_id, variant_id = target.variant_id where id = line.id;
  end loop;

  -- Lock products in a fixed order and update their total together with each shade.
  for adjustment in
    select i.product_id, sum(i.quantity)::integer as quantity from public.order_items i
    where i.order_id = old.id group by i.product_id order by i.product_id
  loop
    select p.stock into available from public.products p where p.id = adjustment.product_id for update;
    if not release_stock and available < adjustment.quantity then
      raise exception 'Stock insuffisant pour reactiver la commande';
    end if;
    update public.products set stock = stock + case when release_stock then adjustment.quantity else -adjustment.quantity end
    where id = adjustment.product_id;
  end loop;

  for adjustment in
    select i.variant_id, sum(i.quantity)::integer as quantity from public.order_items i
    where i.order_id = old.id and i.variant_id is not null group by i.variant_id order by i.variant_id
  loop
    select v.stock into available from public.product_variants v where v.id = adjustment.variant_id for update;
    if not release_stock and available < adjustment.quantity then
      raise exception 'Stock de teinte insuffisant pour reactiver la commande';
    end if;
    update public.product_variants set stock = stock + case when release_stock then adjustment.quantity else -adjustment.quantity end
    where id = adjustment.variant_id;
  end loop;

  new.stock_released := release_stock;
  return new;
end;
$$;
revoke all on function public.manage_order_status_stock() from public, anon, authenticated;
drop trigger if exists orders_status_stock on public.orders;
create trigger orders_status_stock before update on public.orders
for each row execute function public.manage_order_status_stock();

create or replace function public.admin_update_order_items(target_order_id uuid, items jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  order_row public.orders;
  old_item public.order_items;
  item jsonb;
  product_row public.products;
  variant_row public.product_variants;
  target record;
  item_quantity integer;
  item_price integer;
  subtotal_value integer := 0;
begin
  if not public.is_admin_or_staff() then raise exception 'Acces administrateur requis'; end if;
  if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items) = 0 then
    raise exception 'La commande doit contenir au moins un produit';
  end if;

  select * into order_row from public.orders where id = target_order_id for update;
  if not found then raise exception 'Commande introuvable'; end if;

  if not order_row.stock_released then
    for old_item in select * from public.order_items where order_id = target_order_id order by product_id, id for update loop
      select * into target from public.resolve_order_stock_item(old_item.product_id, old_item.variant_id, old_item.product_name, old_item.variant_name);
      update public.products set stock = stock + old_item.quantity where id = target.product_id;
      if target.variant_id is not null then
        update public.product_variants set stock = stock + old_item.quantity where id = target.variant_id;
      end if;
    end loop;
  end if;
  delete from public.order_items where order_id = target_order_id;

  for item in select * from jsonb_array_elements(items) order by value->>'product_id', value->>'variant_id' loop
    item_quantity := (item->>'quantity')::integer;
    if item_quantity is null or item_quantity < 1 then raise exception 'Quantite invalide'; end if;
    select * into target from public.resolve_order_stock_item(
      nullif(item->>'product_id', '')::uuid, nullif(item->>'variant_id', '')::uuid,
      item->>'product_name', item->>'variant_name'
    );
    select * into product_row from public.products where id = target.product_id for update;
    variant_row := null;
    if target.variant_id is not null then
      select * into variant_row from public.product_variants where id = target.variant_id for update;
    end if;

    if not order_row.stock_released then
      if product_row.stock < item_quantity then raise exception 'Stock insuffisant: %', product_row.name; end if;
      if target.variant_id is not null and variant_row.stock < item_quantity then
        raise exception 'Stock de teinte insuffisant: %', product_row.name;
      end if;
      update public.products set stock = stock - item_quantity where id = product_row.id;
      if target.variant_id is not null then
        update public.product_variants set stock = stock - item_quantity where id = target.variant_id;
      end if;
    end if;

    item_price := coalesce(nullif(item->>'unit_price', '')::integer, variant_row.price, product_row.price);
    if item_price < 0 then raise exception 'Prix invalide'; end if;
    insert into public.order_items (order_id, product_id, product_name, variant_id, variant_name, quantity, unit_price)
    values (target_order_id, product_row.id, product_row.name, target.variant_id, variant_row.value, item_quantity, item_price);
    subtotal_value := subtotal_value + item_price * item_quantity;
  end loop;

  update public.orders set subtotal = subtotal_value, total = subtotal_value + delivery_price where id = target_order_id;
  return jsonb_build_object('subtotal', subtotal_value, 'total', subtotal_value + order_row.delivery_price);
end;
$$;
revoke all on function public.admin_update_order_items(uuid, jsonb) from public;
grant execute on function public.admin_update_order_items(uuid, jsonb) to authenticated;

-- Saving articles and status is one transaction, including any stock movement.
create or replace function public.admin_save_order(target_order_id uuid, updates jsonb, items jsonb default null)
returns jsonb language plpgsql security invoker set search_path = public
as $$
declare
  order_row public.orders;
begin
  if not public.is_admin_or_staff() then raise exception 'Acces administrateur requis'; end if;
  select * into order_row from public.orders where id = target_order_id for update;
  if not found then raise exception 'Commande introuvable'; end if;
  if items is not null then perform public.admin_update_order_items(target_order_id, items); end if;
  update public.orders set
    customer_name = coalesce(updates->>'customer_name', customer_name),
    phone = coalesce(updates->>'phone', phone),
    commune = coalesce(updates->>'commune', commune),
    address = coalesce(updates->>'address', address),
    notes = coalesce(updates->>'notes', notes),
    status = coalesce((updates->>'status')::public.order_status, status)
  where id = target_order_id returning * into order_row;
  return to_jsonb(order_row);
end;
$$;
revoke all on function public.admin_save_order(uuid, jsonb, jsonb) from public;
grant execute on function public.admin_save_order(uuid, jsonb, jsonb) to authenticated;
