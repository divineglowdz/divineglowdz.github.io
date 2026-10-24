import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, beforeEach, test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const product = '10000000-0000-4000-8000-000000000001'
const secondProduct = '10000000-0000-4000-8000-000000000002'
const variant = '20000000-0000-4000-8000-000000000001'
const order = '30000000-0000-4000-8000-000000000001'
const uuid = (prefix, suffix) => `${prefix}0000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`

before(async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create type public.order_status as enum ('nouvelle','confirmee','preparee','expediee','livree','annulee');
    create type public.delivery_type as enum ('home','office');
    create function public.is_admin_or_staff() returns boolean language sql as
      $$ select coalesce(current_setting('test.staff', true), 'true') <> 'false' $$;
    create table public.profiles (id uuid primary key, role text not null, active boolean not null);
    insert into public.profiles values ('90000000-0000-4000-8000-000000000001','admin',true);
    create table public.products (
      id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null,
      price integer not null, stock integer not null check(stock >= 0), active boolean default true,
      brand text, category text, featured boolean default false
    );
    create table public.product_variants (
      id uuid primary key default gen_random_uuid(), product_id uuid references public.products(id),
      name text default 'Teinte', value text not null, stock integer not null check(stock >= 0), price integer, active boolean default true
    );
    create table public.orders (
      id uuid primary key default gen_random_uuid(), order_number text, customer_name text, phone text,
      commune text, address text, notes text default '', status public.order_status not null default 'nouvelle',
      wilaya_code text, wilaya_name text, delivery_type public.delivery_type default 'home',
      delivery_price integer not null default 100, subtotal integer not null default 250,
      total integer not null default 350
    );
    create table public.order_items (
      id uuid primary key default gen_random_uuid(), order_id uuid references public.orders(id),
      product_id uuid references public.products(id) on delete set null, product_name text,
      variant_id uuid references public.product_variants(id) on delete set null, variant_name text,
      quantity integer not null check(quantity > 0), unit_price integer not null check(unit_price >= 0)
    );
  `)
  await db.exec(await readFile('supabase/migrations/202610240001_order_return_status.sql', 'utf8'))
  await db.exec(await readFile('supabase/migrations/202610240002_order_stock_returns.sql', 'utf8'))
})

beforeEach(async () => {
  await db.exec(`
    set test.staff = 'true';
    truncate public.order_items, public.orders, public.product_variants, public.products cascade;
    insert into public.products(id,slug,name,price,stock) values
      ('${product}','blush','Blush',100,3), ('${secondProduct}','primer','Primer',50,5);
    insert into public.product_variants(id,product_id,value,stock) values
      ('${variant}','${product}','Rose',1), ('${uuid(2,2)}','${product}','Peche',2);
    insert into public.orders(id,order_number,customer_name) values ('${order}','TEST-1','Test');
    insert into public.order_items(order_id,product_id,product_name,variant_id,variant_name,quantity,unit_price) values
      ('${order}','${product}','Blush','${variant}','Rose',2,100),
      ('${order}','${secondProduct}','Primer',null,null,1,50);
  `)
})
after(async () => { await db.close() })

const status = (value) => db.query('update public.orders set status=$1 where id=$2', [value, order])
const state = async () => ({
  products: (await db.query('select id,stock from public.products order by id')).rows,
  variants: (await db.query('select id,stock from public.product_variants order by id')).rows,
  order: (await db.query('select status,stock_released,customer_name,subtotal,total from public.orders where id=$1', [order])).rows[0],
})
const assertStocks = async (first, shade, second = 5) => {
  const result = await state()
  assert.equal(result.products.find((row) => row.id === product).stock, first)
  assert.equal(result.variants.find((row) => row.id === variant).stock, shade)
  assert.equal(result.products.find((row) => row.id === secondProduct).stock, second)
}
const lines = (quantity) => [{ product_id: product, variant_id: variant, quantity, unit_price: 100 }]
const edit = (items) => db.query('select public.admin_update_order_items($1,$2::jsonb)', [order, JSON.stringify(items)])
const save = (updates, items) => db.query('select public.admin_save_order($1,$2::jsonb,$3::jsonb)', [order, JSON.stringify(updates), items ? JSON.stringify(items) : null])

test('annulation: remet les produits et les teintes en stock', async () => {
  await status('annulee')
  await assertStocks(5, 3, 6)
  assert.equal((await state()).order.stock_released, true)
})

test('retour apres livraison: remet les quantites en stock', async () => {
  await status('livree')
  await status('retour')
  await assertStocks(5, 3, 6)
})

test('annulee puis retour puis annulee: ne double jamais le stock', async () => {
  for (const next of ['annulee', 'annulee', 'retour', 'retour', 'annulee']) await status(next)
  await assertStocks(5, 3, 6)
})

test('reactivation: reserve a nouveau les quantites, puis une nouvelle annulation les restitue', async () => {
  await status('retour')
  await status('confirmee')
  await assertStocks(3, 1)
  assert.equal((await state()).order.stock_released, false)
  await status('annulee')
  await assertStocks(5, 3, 6)
})

test('changements entre statuts actifs: aucun mouvement de stock', async () => {
  for (const next of ['nouvelle', 'confirmee', 'preparee', 'expediee', 'livree']) await status(next)
  await assertStocks(3, 1)
})

test('reactivation sans stock: refuse et annule toute la transaction', async () => {
  await status('annulee')
  await db.query('update public.products set stock=1 where id=$1', [product])
  const previous = await state()
  await assert.rejects(status('confirmee'), /Stock insuffisant/)
  assert.deepEqual(await state(), previous)
})

test('reactivation sans stock de teinte: ne modifie pas le stock general', async () => {
  await status('retour')
  await db.query('update public.product_variants set stock=0 where id=$1', [variant])
  const previous = await state()
  await assert.rejects(status('nouvelle'), /Stock de teinte insuffisant/)
  assert.deepEqual(await state(), previous)
})

test('modification des articles annules: aucune nouvelle reservation', async () => {
  await status('annulee')
  await edit(lines(3))
  await assertStocks(5, 3, 6)
  await status('nouvelle')
  await assertStocks(2, 0, 6)
})

test('modification des articles actifs: retourne les anciennes quantites et reserve les nouvelles', async () => {
  await edit(lines(1))
  await assertStocks(4, 2, 6)
  assert.equal((await state()).order.subtotal, 100)
})

test('modification des articles et annulation: operation atomique', async () => {
  await save({ status: 'annulee', customer_name: 'Modifie' }, lines(3))
  await assertStocks(5, 3, 6)
  assert.equal((await state()).order.customer_name, 'Modifie')
})

test('reactivation et modification impossibles: conserve les anciennes lignes et coordonnees', async () => {
  await status('annulee')
  const previous = await state()
  await assert.rejects(save({ status: 'nouvelle', customer_name: 'Non sauvegarde' }, lines(99)), /Stock insuffisant/)
  assert.deepEqual(await state(), previous)
  assert.equal((await db.query('select sum(quantity)::integer as quantity from public.order_items where order_id=$1', [order])).rows[0].quantity, 3)
})

test('plusieurs lignes de la meme teinte: remet toute la quantite une seule fois', async () => {
  await db.query('insert into public.order_items(order_id,product_id,product_name,variant_id,variant_name,quantity,unit_price) values($1,$2,$3,$4,$5,1,100)', [order, product, 'Blush', variant, 'Rose'])
  await status('retour')
  await assertStocks(6, 4, 6)
})

test('produits archives: relie au vrai produit et a la vraie teinte avant restitution', async () => {
  const archivedProduct = uuid(4, 1)
  const archivedVariant = uuid(5, 1)
  await db.query("insert into public.products(id,slug,name,price,stock,active) values($1,'historique-blush','Blush',0,100000,false)", [archivedProduct])
  await db.query("insert into public.product_variants(id,product_id,value,stock) values($1,$2,'Rose',100000)", [archivedVariant, archivedProduct])
  await db.query('update public.order_items set product_id=$1,variant_id=$2 where product_id=$3', [archivedProduct, archivedVariant, product])
  await status('annulee')
  await assertStocks(5, 3, 6)
  assert.equal((await db.query('select stock from public.products where id=$1', [archivedProduct])).rows[0].stock, 100000)
  assert.equal((await db.query('select product_id from public.order_items where variant_id=$1', [variant])).rows[0].product_id, product)
})

test('produit historique ambigu: refuse au lieu de remettre le mauvais produit en stock', async () => {
  await db.query("insert into public.products(slug,name,price,stock) values('autre-blush','Blush',100,5)")
  await db.query('update public.order_items set product_id=null,variant_id=null where product_id=$1', [product])
  await assert.rejects(status('annulee'), /Produit a relier/)
  await assertStocks(3, 1)
})

test('stock_released fourni par un client: ignore la valeur et conserve le suivi serveur', async () => {
  await db.query('update public.orders set stock_released=true where id=$1', [order])
  assert.equal((await state()).order.stock_released, false)
  await status('annulee')
  await assertStocks(5, 3, 6)
})

test('ancienne commande deja annulee: aucun reajustement de stock retroactif a la migration', async () => {
  await db.query('alter table public.orders disable trigger orders_status_stock')
  await status('annulee')
  await db.query('alter table public.orders enable trigger orders_status_stock')
  await status('annulee')
  await assertStocks(3, 1)
  await status('nouvelle')
  await assertStocks(3, 1)
})

test('appel non autorise: refuse la modification des commandes', async () => {
  await db.exec("set test.staff = 'false'")
  await assert.rejects(save({ status: 'annulee' }), /Acces administrateur requis/)
  await assertStocks(3, 1)
})

test('verification SQL de production: tous les tests passent et les fixtures sont annulees', async () => {
  const previous = await state()
  const result = await db.exec(await readFile('supabase/tests/order_stock_returns.sql', 'utf8'))
  assert.equal(result.at(-1).rows[0].test_data_removed, true)
  assert.deepEqual(await state(), previous)
})
