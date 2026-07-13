create extension if not exists pgcrypto;

create type public.user_role as enum ('admin', 'staff');
create type public.order_status as enum ('nouvelle', 'confirmee', 'preparee', 'expediee', 'livree', 'annulee');
create type public.delivery_type as enum ('home', 'office');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role public.user_role not null default 'staff',
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin_or_staff()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and active and role in ('admin','staff')) $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and active and role = 'admin') $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, active)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    case when lower(coalesce(new.email, '')) = 'divineglowdz1@gmail.com' then 'admin'::public.user_role else 'staff'::public.user_role end,
    lower(coalesce(new.email, '')) = 'divineglowdz1@gmail.com'
  ) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  brand text not null,
  category text not null default 'Maquillage',
  description text not null default '',
  details text not null default '',
  price integer not null check (price >= 0),
  compare_at_price integer check (compare_at_price is null or compare_at_price > price),
  stock integer not null default 0 check (stock >= 0),
  accent text not null default '#d9929c',
  active boolean not null default true,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  path text,
  url text not null,
  alt text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null default 'Teinte',
  value text not null,
  color_hex text,
  stock integer not null default 0 check (stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(product_id, value)
);

create table public.delivery_rates (
  id uuid primary key default gen_random_uuid(),
  wilaya_code text not null unique,
  wilaya_name text not null,
  home_price integer not null check (home_price >= 0),
  office_price integer not null check (office_price >= 0),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create sequence public.order_number_seq start 1001;
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('DG-' || to_char(current_date, 'YYMM') || '-' || lpad(nextval('public.order_number_seq')::text, 4, '0')),
  customer_name text not null,
  phone text not null,
  wilaya_code text not null,
  wilaya_name text not null,
  commune text not null,
  address text not null,
  delivery_type public.delivery_type not null,
  delivery_price integer not null check (delivery_price >= 0),
  subtotal integer not null check (subtotal >= 0),
  total integer not null check (total >= 0),
  status public.order_status not null default 'nouvelle',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  variant_id uuid references public.product_variants(id) on delete set null,
  variant_name text,
  quantity integer not null check (quantity > 0),
  unit_price integer not null check (unit_price >= 0),
  created_at timestamptz not null default now()
);

create table public.analytics_events (
  id bigint generated by default as identity primary key,
  event_type text not null check (event_type in ('page_view','product_view','add_to_cart','order_complete')),
  path text not null default '/',
  session_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index analytics_events_created_at_idx on public.analytics_events(created_at desc);
create index orders_created_at_idx on public.orders(created_at desc);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.delivery_rates enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.analytics_events enable row level security;

create policy "public reads active products" on public.products for select using (active or public.is_admin_or_staff());
create policy "staff manages products" on public.products for all using (public.is_admin_or_staff()) with check (public.is_admin_or_staff());
create policy "public reads product images" on public.product_images for select using (true);
create policy "staff manages product images" on public.product_images for all using (public.is_admin_or_staff()) with check (public.is_admin_or_staff());
create policy "public reads active variants" on public.product_variants for select using (active or public.is_admin_or_staff());
create policy "staff manages variants" on public.product_variants for all using (public.is_admin_or_staff()) with check (public.is_admin_or_staff());
create policy "public reads active delivery" on public.delivery_rates for select using (active or public.is_admin_or_staff());
create policy "staff manages delivery" on public.delivery_rates for all using (public.is_admin_or_staff()) with check (public.is_admin_or_staff());
create policy "staff reads profiles" on public.profiles for select using (public.is_admin_or_staff());
create policy "admins manage profiles" on public.profiles for update using (public.is_admin()) with check (public.is_admin());
create policy "staff manages orders" on public.orders for all using (public.is_admin_or_staff()) with check (public.is_admin_or_staff());
create policy "staff manages order items" on public.order_items for all using (public.is_admin_or_staff()) with check (public.is_admin_or_staff());
create policy "anonymous analytics insert" on public.analytics_events for insert to anon, authenticated with check (length(session_id) between 8 and 100 and length(path) <= 500);
create policy "staff reads analytics" on public.analytics_events for select using (public.is_admin_or_staff());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy "public reads product storage" on storage.objects for select using (bucket_id = 'product-images');
create policy "staff uploads product storage" on storage.objects for insert with check (bucket_id = 'product-images' and public.is_admin_or_staff());
create policy "staff updates product storage" on storage.objects for update using (bucket_id = 'product-images' and public.is_admin_or_staff());
create policy "staff deletes product storage" on storage.objects for delete using (bucket_id = 'product-images' and public.is_admin_or_staff());

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
  subtotal_value integer := 0;
  delivery_value integer;
begin
  if jsonb_array_length(coalesce(payload->'items', '[]'::jsonb)) = 0 then raise exception 'Le panier est vide'; end if;
  if length(trim(coalesce(payload->>'customer_name',''))) < 2 then raise exception 'Nom invalide'; end if;
  if length(trim(coalesce(payload->>'phone',''))) < 8 then raise exception 'Telephone invalide'; end if;
  select * into rate_row from public.delivery_rates where wilaya_code = payload->>'wilaya_code' and active for share;
  if not found then raise exception 'Livraison indisponible pour cette wilaya'; end if;
  delivery_value := case when payload->>'delivery_type' = 'office' then rate_row.office_price else rate_row.home_price end;

  for item in select * from jsonb_array_elements(payload->'items') loop
    item_quantity := greatest(1, (item->>'quantity')::integer);
    select * into product_row from public.products where id = (item->>'product_id')::uuid and active for update;
    if not found then raise exception 'Produit indisponible'; end if;
    if item ? 'variant_id' and nullif(item->>'variant_id','') is not null then
      select * into variant_row from public.product_variants where id = (item->>'variant_id')::uuid and product_id = product_row.id and active for update;
      if not found or variant_row.stock < item_quantity then raise exception 'Teinte indisponible: %', product_row.name; end if;
    elsif product_row.stock < item_quantity then raise exception 'Stock insuffisant: %', product_row.name; end if;
    subtotal_value := subtotal_value + product_row.price * item_quantity;
  end loop;

  insert into public.orders (customer_name, phone, wilaya_code, wilaya_name, commune, address, delivery_type, delivery_price, subtotal, total, notes)
  values (trim(payload->>'customer_name'), trim(payload->>'phone'), rate_row.wilaya_code, rate_row.wilaya_name, trim(payload->>'commune'), trim(payload->>'address'),
    case when payload->>'delivery_type' = 'office' then 'office'::public.delivery_type else 'home'::public.delivery_type end,
    delivery_value, subtotal_value, subtotal_value + delivery_value, trim(coalesce(payload->>'notes','')))
  returning * into created_order;

  for item in select * from jsonb_array_elements(payload->'items') loop
    item_quantity := greatest(1, (item->>'quantity')::integer);
    select * into product_row from public.products where id = (item->>'product_id')::uuid for update;
    variant_row := null;
    if item ? 'variant_id' and nullif(item->>'variant_id','') is not null then
      select * into variant_row from public.product_variants where id = (item->>'variant_id')::uuid for update;
      update public.product_variants set stock = stock - item_quantity where id = variant_row.id;
    else
      update public.products set stock = stock - item_quantity where id = product_row.id;
    end if;
    insert into public.order_items (order_id, product_id, product_name, variant_id, variant_name, quantity, unit_price)
    values (created_order.id, product_row.id, product_row.name, variant_row.id, variant_row.value, item_quantity, product_row.price);
  end loop;
  return jsonb_build_object('order_number', created_order.order_number, 'id', created_order.id);
end;
$$;
revoke all on function public.place_order(jsonb) from public;
grant execute on function public.place_order(jsonb) to anon, authenticated;

insert into public.products (id, slug, name, brand, category, description, details, price, stock, accent, active, featured) values
('10000000-0000-4000-8000-000000000001','primer-elf-power-grip','Power Grip Primer','e.l.f.','Primer','Le primer gel iconique qui hydrate et aide le maquillage a tenir toute la journee.','Texture gel fraiche, fini lumineux et effet grip. Convient a toutes les carnations.',2500,10,'#70b8a0',true,true),
('10000000-0000-4000-8000-000000000002','primer-elf-matte-putty','Matte Putty Primer','e.l.f.','Primer','Une base lissante au fini mat pour flouter les pores et controler la brillance.','Texture veloutee enrichie en kaolin et charbon blanc. Ideale pour les peaux mixtes a grasses.',2500,6,'#282828',true,true),
('10000000-0000-4000-8000-000000000003','fixateur-loreal-infaillible','Fixateur Infaillible','L''Oreal Paris','Fixateur','Le spray fixateur rouge pour prolonger la tenue du maquillage sans effet lourd.','Brume fine, sechage rapide et tenue longue duree. Vaporiser a environ 20 cm du visage.',3200,4,'#c9484d',true,true),
('10000000-0000-4000-8000-000000000004','primer-nyx-face-glue','The Face Glue Primer','NYX Professional Makeup','Primer','Une base grip hydratante au packaging blanc, rose et bleu, pensee pour une tenue pro.','Fini floute, sensation confortable et adherence longue duree. Format 35 ml.',2800,5,'#ef7fa7',true,true)
on conflict (id) do update set name=excluded.name, price=excluded.price, stock=excluded.stock, active=true;

with names(code,name) as (values
('01','Adrar'),('02','Chlef'),('03','Laghouat'),('04','Oum El Bouaghi'),('05','Batna'),('06','Bejaia'),('07','Biskra'),('08','Bechar'),('09','Blida'),('10','Bouira'),
('11','Tamanrasset'),('12','Tebessa'),('13','Tlemcen'),('14','Tiaret'),('15','Tizi Ouzou'),('16','Alger'),('17','Djelfa'),('18','Jijel'),('19','Setif'),('20','Saida'),
('21','Skikda'),('22','Sidi Bel Abbes'),('23','Annaba'),('24','Guelma'),('25','Constantine'),('26','Medea'),('27','Mostaganem'),('28','MSila'),('29','Mascara'),('30','Ouargla'),
('31','Oran'),('32','El Bayadh'),('33','Illizi'),('34','Bordj Bou Arreridj'),('35','Boumerdes'),('36','El Tarf'),('37','Tindouf'),('38','Tissemsilt'),('39','El Oued'),('40','Khenchela'),
('41','Souk Ahras'),('42','Tipaza'),('43','Mila'),('44','Ain Defla'),('45','Naama'),('46','Ain Temouchent'),('47','Ghardaia'),('48','Relizane'),('49','Timimoun'),('50','Bordj Badji Mokhtar'),
('51','Ouled Djellal'),('52','Beni Abbes'),('53','In Salah'),('54','In Guezzam'),('55','Touggourt'),('56','Djanet'),('57','El Mghair'),('58','El Meniaa'))
insert into public.delivery_rates (wilaya_code,wilaya_name,home_price,office_price,active)
select code,name,case when code='16' then 500 when code::int<=48 then 900 else 1100 end,case when code='16' then 400 when code::int<=48 then 600 else 800 end,true from names
on conflict (wilaya_code) do nothing;
