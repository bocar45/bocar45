-- Access-rule tests. Each block raises an exception on failure (psql stops with ON_ERROR_STOP).
\set ON_ERROR_STOP on
set client_min_messages = warning;

-- Users
insert into auth.users (id, phone) values
  ('00000000-0000-0000-0000-00000000000a', '+221770000001'), -- super admin
  ('00000000-0000-0000-0000-00000000000c', '+221770000002'), -- catalog
  ('00000000-0000-0000-0000-0000000000a1', '+221770000003'), -- workshop A owner
  ('00000000-0000-0000-0000-0000000000b1', '+221770000004'), -- workshop B owner
  ('00000000-0000-0000-0000-0000000000c1', '+221770000005'); -- customer
insert into public.memberships (user_id, organization_id, role)
select u, (select id from public.organizations where kind = 'platform'), r::public.member_role
from (values ('00000000-0000-0000-0000-00000000000a'::uuid, 'super_admin'), ('00000000-0000-0000-0000-00000000000c'::uuid, 'catalog')) v(u, r);

create function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), true);
  if uid is null then set local role anon; else set local role authenticated; end if;
end $$;

-- 1. Profile created by trigger
do $$ begin
  if (select count(*) from public.profiles) <> 5 then raise exception 'FAIL profiles trigger'; end if;
end $$;

-- 2. Workshops apply; each owns its organization
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.apply_as_vendor('Atelier Médina', '0012345');
commit;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.apply_as_vendor('Brod''Est', null);
commit;

-- 3. Workshop A sees only its own organization and cannot activate itself
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  if (select count(*) from public.organizations) <> 1 then raise exception 'FAIL A sees % orgs', (select count(*) from public.organizations); end if;
  if (select name from public.organizations) <> 'Atelier Médina' then raise exception 'FAIL A sees wrong org'; end if;
  update public.organizations set status = 'active';
  if exists (select 1 from public.organizations where status = 'active') then raise exception 'FAIL A activated itself'; end if;
end $$;
rollback;

-- 4. Catalog team creates an active product; anon sees it, a draft stays hidden
begin;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
insert into public.base_products (category_id, slug, name, status)
select id, 'tee-crew-180', '{"fr":"T-shirt col rond 180 g"}', 'active' from public.categories where slug = 'vetements';
insert into public.base_products (category_id, slug, name, status)
select id, 'hoodie-draft', '{"fr":"Hoodie (brouillon)"}', 'draft' from public.categories where slug = 'vetements';
insert into public.product_views (base_product_id, key) select id, 'front' from public.base_products where slug = 'tee-crew-180';
insert into public.zones (base_product_id, view_id, key, max_width_mm, max_height_mm, allowed_techniques)
select p.id, v.id, 'front_center', 300, 400, '{dtg,dtf}' from public.base_products p join public.product_views v on v.base_product_id = p.id where p.slug = 'tee-crew-180';
insert into public.base_product_variants (base_product_id, color_key, color_hex, size)
select id, 'ivory', '#F2E9D8', 'M' from public.base_products where slug = 'tee-crew-180';
commit;
begin;
select pg_temp.act_as(null);
do $$ begin
  if (select count(*) from public.base_products) <> 1 then raise exception 'FAIL anon sees % products', (select count(*) from public.base_products); end if;
  if (select count(*) from public.zones) <> 1 then raise exception 'FAIL anon zones'; end if;
end $$;
rollback;

-- 5. A workshop cannot write the catalogue
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  begin
    insert into public.base_products (category_id, slug, name) select id, 'hack', '{}' from public.categories limit 1;
    raise exception 'FAIL workshop wrote catalogue';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;

-- 6. Workshop A creates its offer and price grid; B cannot see them nor create offers for A
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
insert into public.vendor_offers (vendor_id, base_product_id, status)
select o.id, p.id, 'active' from public.organizations o, public.base_products p where p.slug = 'tee-crew-180';
insert into public.vendor_price_grids (offer_id, version, grid)
select id, 1, '{"blanks":{}}' from public.vendor_offers;
commit;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
do $$ declare a_id uuid; begin
  if (select count(*) from public.vendor_offers) <> 0 then raise exception 'FAIL B sees A offers'; end if;
  if (select count(*) from public.vendor_price_grids) <> 0 then raise exception 'FAIL B sees A grids'; end if;
  select id into a_id from public.organizations where name = 'Atelier Médina'; -- invisible to B → null
  if a_id is not null then raise exception 'FAIL B sees A org'; end if;
end $$;
rollback;
-- Explicit cross-tenant insert attempt with A's id read as superuser.
do $$ declare a_id uuid; p_id uuid; ok boolean := false; begin
  select id into a_id from public.organizations where name = 'Atelier Médina';
  select id into p_id from public.base_products where slug = 'hoodie-draft';
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
  set local role authenticated;
  begin
    insert into public.vendor_offers (vendor_id, base_product_id) values (a_id, p_id);
  exception when insufficient_privilege then ok := true;
  end;
  reset role;
  if not ok then raise exception 'FAIL B created an offer for A'; end if;
end $$;

-- 7. Price grids are immutable, audit log is append-only
do $$ declare ok boolean := false; begin
  begin update public.vendor_price_grids set version = 2; exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL grid updated'; end if;
  insert into public.audit_log (action, entity_type) values ('test', 'test');
  ok := false;
  begin delete from public.audit_log; exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL audit deleted'; end if;
end $$;

-- 8. Customers only see their own profile; super admin sees workshops
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
do $$ begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'FAIL customer sees other profiles'; end if;
  if (select count(*) from public.organizations) <> 0 then raise exception 'FAIL customer sees orgs'; end if;
end $$;
rollback;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
do $$ begin
  if (select count(*) from public.organizations where kind = 'vendor') <> 2 then raise exception 'FAIL admin vendor list'; end if;
  update public.organizations set status = 'active' where name = 'Atelier Médina';
  if not exists (select 1 from public.organizations where name = 'Atelier Médina' and status = 'active') then raise exception 'FAIL admin activation'; end if;
end $$;
rollback;

-- 9. Anonymous users cannot apply as a workshop
begin;
select pg_temp.act_as(null);
do $$ begin
  begin perform public.apply_as_vendor('Anon', null); raise exception 'FAIL anon applied';
  exception when insufficient_privilege then null; end;
end $$;
rollback;

select 'ALL RLS TESTS PASSED' as result;
