alter table public.products
  add column if not exists compare_at_price integer;

alter table public.products
  drop constraint if exists products_compare_at_price_check;

alter table public.products
  add constraint products_compare_at_price_check
  check (compare_at_price is null or compare_at_price > price);

update public.products
set category = 'Teint'
where category in ('Primer', 'Fixateur');
