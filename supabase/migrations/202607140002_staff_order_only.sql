-- Staff can only read and update orders. All other administration stays admin-only.

drop policy if exists "staff manages products" on public.products;
create policy "admins manage products" on public.products for all
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "staff manages product images" on public.product_images;
create policy "admins manage product images" on public.product_images for all
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "staff manages variants" on public.product_variants;
create policy "admins manage variants" on public.product_variants for all
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "staff manages delivery" on public.delivery_rates;
create policy "admins manage delivery" on public.delivery_rates for all
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "staff reads profiles" on public.profiles;
create policy "users read own profile" on public.profiles for select
using (id = auth.uid());
create policy "admins read profiles" on public.profiles for select
using (public.is_admin());

drop policy if exists "staff reads analytics" on public.analytics_events;
create policy "admins read analytics" on public.analytics_events for select
using (public.is_admin());

drop policy if exists "staff manages orders" on public.orders;
create policy "staff reads orders" on public.orders for select
using (public.is_admin_or_staff());
create policy "staff updates orders" on public.orders for update
using (public.is_admin_or_staff()) with check (public.is_admin_or_staff());
create policy "admins delete orders" on public.orders for delete
using (public.is_admin());

drop policy if exists "staff manages order items" on public.order_items;
create policy "staff reads order items" on public.order_items for select
using (public.is_admin_or_staff());
create policy "admins manage order items" on public.order_items for all
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "staff uploads product storage" on storage.objects;
drop policy if exists "staff updates product storage" on storage.objects;
drop policy if exists "staff deletes product storage" on storage.objects;
create policy "admins upload product storage" on storage.objects for insert
with check (bucket_id = 'product-images' and public.is_admin());
create policy "admins update product storage" on storage.objects for update
using (bucket_id = 'product-images' and public.is_admin());
create policy "admins delete product storage" on storage.objects for delete
using (bucket_id = 'product-images' and public.is_admin());
