-- Every fixture is rolled back inside the exception block, including on failure.
do $$
declare
  test_product uuid := gen_random_uuid();
  test_variant uuid := gen_random_uuid();
  test_order uuid := gen_random_uuid();
  test_admin uuid;
  current_stock integer;
  current_variant_stock integer;
  current_status text;
  current_released boolean;
begin
  begin
    select id into test_admin from public.profiles where role = 'admin' and active limit 1;
    if test_admin is null then raise exception 'Admin de test introuvable'; end if;
    perform set_config('request.jwt.claim.sub', test_admin::text, true);

    insert into public.products(id, slug, name, brand, category, price, stock, active, featured)
    values (test_product, 'test-stock-' || test_product::text, 'Verification retour', 'Test', 'Test', 100, 0, false, false);
    insert into public.product_variants(id, product_id, name, value, stock)
    values (test_variant, test_product, 'Teinte', 'Test', 0);
    insert into public.orders(id, order_number, customer_name, phone, wilaya_code, wilaya_name,
      commune, address, delivery_type, delivery_price, subtotal, total, status)
    values (test_order, 'TEST-' || test_order::text, 'Verification interne', '0000000000', '16', 'Alger',
      'Test', 'Test', 'home', 0, 200, 200, 'nouvelle');
    insert into public.order_items(order_id, product_id, product_name, variant_id, variant_name, quantity, unit_price)
    values (test_order, test_product, 'Verification retour', test_variant, 'Test', 2, 100);

    update public.orders set status = 'annulee' where id = test_order;
    select stock into current_stock from public.products where id = test_product;
    select stock into current_variant_stock from public.product_variants where id = test_variant;
    if current_stock <> 2 or current_variant_stock <> 2 then raise exception 'Echec remise en stock annulation'; end if;

    update public.orders set status = 'retour' where id = test_order;
    update public.orders set status = 'annulee' where id = test_order;
    select stock into current_stock from public.products where id = test_product;
    if current_stock <> 2 then raise exception 'Echec protection double remise en stock'; end if;

    update public.orders set status = 'confirmee' where id = test_order;
    select stock into current_stock from public.products where id = test_product;
    select stock into current_variant_stock from public.product_variants where id = test_variant;
    if current_stock <> 0 or current_variant_stock <> 0 then raise exception 'Echec reservation apres reactivation'; end if;

    update public.orders set status = 'livree' where id = test_order;
    update public.orders set status = 'retour' where id = test_order;
    select stock into current_stock from public.products where id = test_product;
    if current_stock <> 2 then raise exception 'Echec remise en stock retour'; end if;

    perform public.admin_save_order(test_order, '{"status":"annulee"}'::jsonb,
      jsonb_build_array(jsonb_build_object('product_id', test_product, 'variant_id', test_variant, 'quantity', 1, 'unit_price', 100)));
    select stock into current_stock from public.products where id = test_product;
    if current_stock <> 2 then raise exception 'Echec modification articles annules'; end if;

    update public.orders set status = 'nouvelle' where id = test_order;
    select stock into current_stock from public.products where id = test_product;
    select stock into current_variant_stock from public.product_variants where id = test_variant;
    if current_stock <> 1 or current_variant_stock <> 1 then raise exception 'Echec reservation quantites modifiees'; end if;

    update public.orders set status = 'annulee' where id = test_order;
    begin
      perform public.admin_save_order(test_order, '{"status":"confirmee"}'::jsonb,
        jsonb_build_array(jsonb_build_object('product_id', test_product, 'variant_id', test_variant, 'quantity', 99, 'unit_price', 100)));
      raise exception using errcode = 'Z0002', message = 'Une reactivation sans stock a ete acceptee';
    exception when sqlstate 'P0001' then
      if sqlerrm not like 'Stock%insuffisant%' then raise; end if;
    end;
    select status::text, stock_released into current_status, current_released from public.orders where id = test_order;
    select stock into current_stock from public.products where id = test_product;
    if current_status <> 'annulee' or not current_released or current_stock <> 2 then
      raise exception 'Echec atomicite du changement de statut';
    end if;

    -- A dedicated caught exception rolls back all test records and changes.
    raise exception using errcode = 'Z0001', message = 'Verification terminee';
  exception when sqlstate 'Z0001' then null;
  end;
end;
$$;

select 'OK: annulation, retour, teintes, reactivation et absence de doublons' as verification,
  not exists(select 1 from public.products where slug like 'test-stock-%') as test_data_removed;
