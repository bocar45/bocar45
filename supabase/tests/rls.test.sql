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
select id, 'tee-crew-180', '{"fr":"T-shirt col rond 180 g"}', 'draft' from public.categories where slug = 'vetements';
insert into public.base_products (category_id, slug, name, status)
select id, 'hoodie-draft', '{"fr":"Hoodie (brouillon)"}', 'draft' from public.categories where slug = 'vetements';
insert into public.product_views (base_product_id, key) select id, 'front' from public.base_products where slug = 'tee-crew-180';
insert into public.zones (base_product_id, view_id, key, max_width_mm, max_height_mm, allowed_techniques)
select p.id, v.id, 'front_center', 300, 400, '{dtg,dtf}' from public.base_products p join public.product_views v on v.base_product_id = p.id where p.slug = 'tee-crew-180';
insert into public.base_product_variants (base_product_id, color_key, color_hex, size)
select id, 'ivory', '#F2E9D8', 'M' from public.base_products where slug = 'tee-crew-180';
update public.base_products set status = 'active' where slug = 'tee-crew-180';
commit;
-- 4b. An incomplete product cannot be published
begin;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
do $$ declare ok boolean := false; begin
  begin update public.base_products set status = 'active' where slug = 'hoodie-draft';
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'FAIL incomplete product published'; end if;
end $$;
rollback;
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

-- 6a. A pending workshop cannot create offers
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
do $$ declare ok boolean := false; begin
  begin
    insert into public.vendor_offers (vendor_id, base_product_id)
    select o.id, p.id from public.organizations o, public.base_products p where p.slug = 'tee-crew-180';
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL pending workshop created an offer'; end if;
end $$;
rollback;
update public.organizations set status = 'active' where name = 'Atelier Médina';

-- 6. Active workshop A creates its offer and price grid; B cannot see them nor create offers for A
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
insert into public.vendor_offers (vendor_id, base_product_id, status)
select o.id, p.id, 'active' from public.organizations o, public.base_products p where p.slug = 'tee-crew-180';
insert into public.vendor_price_grids (offer_id, version, grid)
select id, 1, '{"blanks":{}}' from public.vendor_offers;
insert into public.vendor_offer_variants (offer_id, variant_id)
select o.id, v.id from public.vendor_offers o join public.base_product_variants v on v.base_product_id = o.base_product_id;
insert into public.vendor_zone_capabilities (offer_id, zone_id, technique, max_width_mm, max_height_mm)
select o.id, z.id, 'dtf', 280, 350 from public.vendor_offers o join public.zones z on z.base_product_id = o.base_product_id;
commit;
-- 6b. A capability cannot exceed the reference zone nor use a technique the zone refuses
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
do $$ declare ok boolean := false; begin
  begin
    insert into public.vendor_zone_capabilities (offer_id, zone_id, technique, max_width_mm, max_height_mm)
    select o.id, z.id, 'dtg', 500, 350 from public.vendor_offers o join public.zones z on z.base_product_id = o.base_product_id;
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'FAIL oversize capability'; end if;
  ok := false;
  begin
    insert into public.vendor_zone_capabilities (offer_id, zone_id, technique, max_width_mm, max_height_mm)
    select o.id, z.id, 'embroidery', 80, 80 from public.vendor_offers o join public.zones z on z.base_product_id = o.base_product_id;
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'FAIL technique not allowed on zone'; end if;
end $$;
rollback;
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
  update public.organizations set status = 'active' where name = 'Brod''Est';
  if not exists (select 1 from public.organizations where name = 'Brod''Est' and status = 'active') then raise exception 'FAIL admin activation'; end if;
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

-- 10. Price rules: only finance activates; one active version; activated rules are frozen
insert into auth.users (id, phone) values ('00000000-0000-0000-0000-0000000000f1', '+221770000009');
insert into public.memberships (user_id, organization_id, role)
select '00000000-0000-0000-0000-0000000000f1', id, 'finance' from public.organizations where kind = 'platform';
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
insert into public.price_rule_sets (id, version, rules) values
  ('00000000-0000-0000-0000-000000000101', 1, '{"defaultMarginBps":3500}');
commit;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
do $$ declare ok boolean := false; begin
  begin perform public.activate_price_rule_set('00000000-0000-0000-0000-000000000101');
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL catalog activated price rules'; end if;
end $$;
rollback;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
select public.activate_price_rule_set('00000000-0000-0000-0000-000000000101');
insert into public.price_rule_sets (id, version, rules) values ('00000000-0000-0000-0000-000000000102', 2, '{"defaultMarginBps":4000}');
select public.activate_price_rule_set('00000000-0000-0000-0000-000000000102');
commit;
do $$ declare ok boolean := false; begin
  if (select count(*) from public.price_rule_sets where status = 'active') <> 1 then raise exception 'FAIL several active rule sets'; end if;
  if (select version from public.price_rule_sets where status = 'active') <> 2 then raise exception 'FAIL wrong active version'; end if;
  if (select count(*) from public.audit_log where action = 'price_rules.activate') <> 2 then raise exception 'FAIL activation not audited'; end if;
  begin update public.price_rule_sets set rules = '{}' where version = 2;
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL active rules edited'; end if;
end $$;

-- 11. Designs, orders and fulfillments
insert into auth.users (id, phone) values ('00000000-0000-0000-0000-0000000000c2', '+221770000010');
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
insert into public.designs (id, owner_id, base_product_id, document)
select '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000c1', id, '{"schemaVersion":1}' from public.base_products where slug = 'tee-crew-180';
commit;
-- another customer cannot read or write it
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c2');
do $$ declare ok boolean := false; begin
  if exists (select 1 from public.designs) then raise exception 'FAIL other customer sees design'; end if;
  begin
    insert into public.designs (owner_id, base_product_id, document) select '00000000-0000-0000-0000-0000000000c1', id, '{}' from public.base_products limit 1;
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL design written for someone else'; end if;
end $$;
rollback;
-- customers cannot call order functions directly
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
do $$ declare ok boolean := false; begin
  begin perform public.mark_order_paid(gen_random_uuid(), auth.uid(), 'x'); exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL customer marked an order paid'; end if;
end $$;
rollback;
-- server creates the order (service role)
set role service_role;
select * from public.create_order('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000d001', '{"schemaVersion":1}', 'abc', '[]',
  '[{"color_key":"ivory","sizes":{"M":3},"quantity":3,"unit_price":7200,"line_total":21600,"decorations":[]}]',
  '{"subtotal":21600,"tax":3295,"total":21600}', '{"ruleSetVersion":1}', '{"name":"Awa","phone":"+221770000005"}');
reset role;
do $$ begin
  if (select count(*) from public.design_versions) <> 1 then raise exception 'FAIL version not frozen'; end if;
  if (select status from public.fulfillments) <> 'pending_assignment' then raise exception 'FAIL fulfillment'; end if;
  if (select number from public.orders) !~ '^SW-\d{4}-\d{6}$' then raise exception 'FAIL order number'; end if;
end $$;
-- frozen version is immutable
do $$ declare ok boolean := false; begin
  begin update public.design_versions set document = '{}'; exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL version edited'; end if;
end $$;
-- workshops see nothing before assignment; the assigned workshop sees its fulfillment and items, never the order row
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  if exists (select 1 from public.fulfillments) or exists (select 1 from public.order_items) then raise exception 'FAIL workshop sees unassigned order'; end if;
end $$;
rollback;
set role service_role;
select public.apply_fulfillment_transition((select id from public.fulfillments), 'pending_assignment',
  jsonb_build_object('status','assigned','vendorId',(select id from public.organizations where name = 'Atelier Médina'),'proofRound',0,'heldFrom',null),
  'assign', '00000000-0000-0000-0000-00000000000a', 'admin', '{}', '{"sla_hours":24,"vendor_cost":12000}');
reset role;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  if (select count(*) from public.fulfillments) <> 1 then raise exception 'FAIL assigned workshop cannot see fulfillment'; end if;
  if (select count(*) from public.order_items) <> 1 then raise exception 'FAIL workshop cannot see items'; end if;
  if (select count(*) from public.design_versions) <> 1 then raise exception 'FAIL workshop cannot see frozen design'; end if;
  if exists (select 1 from public.orders) then raise exception 'FAIL workshop sees the customer order row'; end if;
end $$;
rollback;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  if exists (select 1 from public.fulfillments) then raise exception 'FAIL other workshop sees fulfillment'; end if;
end $$;
rollback;
-- optimistic check: a stale transition fails
set role service_role;
do $$ declare ok boolean := false; begin
  begin perform public.apply_fulfillment_transition((select id from public.fulfillments), 'pending_assignment', '{"status":"assigned","proofRound":0}', 'assign', null, 'admin', '{}');
  exception when serialization_failure then ok := true; end;
  if not ok then raise exception 'FAIL stale transition applied'; end if;
end $$;
reset role;
-- customer sees order, timeline (2 events)
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
do $$ begin
  if (select count(*) from public.orders) <> 1 then raise exception 'FAIL customer order'; end if;
  if (select count(*) from public.status_events) <> 2 then raise exception 'FAIL customer timeline: %', (select count(*) from public.status_events); end if;
end $$;
rollback;
-- storage: customers write only in their own folder; QC photos only for workshop members
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
insert into storage.objects (bucket_id, name) values ('design-assets', '00000000-0000-0000-0000-0000000000c1/logo.png');
do $$ declare ok boolean := false; begin
  begin insert into storage.objects (bucket_id, name) values ('design-assets', '00000000-0000-0000-0000-0000000000c2/x.png');
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL wrote in another customer folder'; end if;
  ok := false;
  begin insert into storage.objects (bucket_id, name) values ('qc-photos', 'not-a-uuid/x.jpg');
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL customer wrote a QC photo'; end if;
end $$;
rollback;

-- 12. Correction by the customer (E10)
set role service_role;
select public.apply_fulfillment_transition((select id from public.fulfillments), 'assigned',
  jsonb_build_object('status','proof_review','vendorId',(select vendor_id from public.fulfillments),'proofRound',1,'heldFrom',null), 'accept', null, 'vendor', '{}');
select public.apply_fulfillment_transition((select id from public.fulfillments), 'proof_review',
  jsonb_build_object('status','changes_requested','vendorId',(select vendor_id from public.fulfillments),'proofRound',1,'heldFrom',null), 'request_changes', null, 'vendor', '{"comment":"Logo flou"}');
reset role;
-- the customer cannot call the function directly
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
do $$ declare ok boolean := false; begin
  begin perform public.resubmit_design((select id from public.orders), auth.uid(), '{}', 'x', '[]', '[]', 0, '{"status":"proof_review","proofRound":2}', '{}', null);
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL customer called resubmit_design'; end if;
end $$;
rollback;
-- another customer's id is refused
set role service_role;
do $$ declare ok boolean := false; begin
  begin perform public.resubmit_design((select id from public.orders), '00000000-0000-0000-0000-0000000000c2', '{}', 'x', '[]', '[]', 0, '{"status":"proof_review","proofRound":2}', '{}', null);
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL resubmit for another customer'; end if;
end $$;
select public.resubmit_design((select id from public.orders), '00000000-0000-0000-0000-0000000000c1', '{"schemaVersion":1,"v":2}', 'def', '[]',
  '[{"zoneKey":"front","technique":"dtf","widthMm":100,"heightMm":100}]', 1500, '{"status":"proof_review","proofRound":2}',
  '{"total":23100,"vendorId":"x","ruleSetVersion":2}', 13500);
reset role;
do $$ begin
  if (select count(*) from public.design_versions) <> 2 then raise exception 'FAIL new version'; end if;
  if (select status from public.fulfillments) <> 'proof_review' or (select proof_round from public.fulfillments) <> 2 then raise exception 'FAIL fulfillment after resubmit'; end if;
  if (select v.number from public.order_items i join public.design_versions v on v.id = i.design_version_id) <> 2 then raise exception 'FAIL item not on new version'; end if;
  if (select count(*) from public.order_item_versions) <> 2 then raise exception 'FAIL version history'; end if;
  if (select surcharge from public.order_item_versions where proof_round = 2) <> 1500 then raise exception 'FAIL surcharge recorded'; end if;
  if (select quote->>'total' from public.order_item_versions where proof_round = 2) <> '23100' then raise exception 'FAIL correction quote not frozen'; end if;
  if (select quote->>'ruleSetVersion' from public.order_item_versions where proof_round = 0) <> '1' then raise exception 'FAIL first version quote not frozen'; end if;
  if (select vendor_cost from public.fulfillments) <> 13500 then raise exception 'FAIL vendor cost not updated'; end if;
  if not exists (select 1 from public.status_events where event = 'resubmit_design') then raise exception 'FAIL resubmit event'; end if;
end $$;
-- a second resubmit is refused (no longer waiting for a correction)
set role service_role;
do $$ declare ok boolean := false; begin
  begin perform public.resubmit_design((select id from public.orders), '00000000-0000-0000-0000-0000000000c1', '{}', 'x', '[]', '[]', 0, '{"status":"proof_review","proofRound":3}', '{}', null);
  exception when serialization_failure then ok := true; end;
  if not ok then raise exception 'FAIL double resubmit'; end if;
end $$;
reset role;
-- the assigned workshop sees both versions and the history; another workshop sees nothing
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  if (select count(*) from public.design_versions) <> 2 then raise exception 'FAIL workshop cannot compare versions: %', (select count(*) from public.design_versions); end if;
  if (select count(*) from public.order_item_versions) <> 2 then raise exception 'FAIL workshop history'; end if;
end $$;
rollback;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  if exists (select 1 from public.design_versions) or exists (select 1 from public.order_item_versions) then raise exception 'FAIL other workshop sees versions'; end if;
end $$;
rollback;
-- finance sees the versions and the surcharge to collect
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
do $$ begin
  if (select count(*) from public.design_versions) <> 2 then raise exception 'FAIL finance cannot read versions'; end if;
  if (select sum(surcharge) from public.order_item_versions) <> 1500 then raise exception 'FAIL finance cannot see surcharge'; end if;
end $$;
rollback;
-- history is append-only
do $$ declare ok boolean := false; begin
  begin delete from public.order_item_versions; exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL history deleted'; end if;
end $$;

-- 13. Robustness (E14)
-- 13a. Offers are saved in one transaction, through the workshop's own access rules
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select * from public.save_vendor_offer(
  (select id from public.organizations where name = 'Atelier Médina'), (select id from public.base_products where slug = 'tee-crew-180'),
  'active', 5, 3, array(select id from public.base_product_variants),
  (select jsonb_agg(jsonb_build_object('zone_id', id, 'technique', 'dtf', 'max_width_mm', 200, 'max_height_mm', 250, 'max_colors', null)) from public.zones where key = 'front_center'),
  '{"version":0,"blanks":{"a":[{"minQty":1,"unitCost":2600}]}}');
commit;
do $$ begin
  if (select min_qty from public.vendor_offers) <> 5 then raise exception 'FAIL offer fields'; end if;
  if (select max(version) from public.vendor_price_grids) <> 2 then raise exception 'FAIL new grid version'; end if;
  if (select grid->>'version' from public.vendor_price_grids where version = 2) <> '2' then raise exception 'FAIL grid version stamped'; end if;
  if (select max_width_mm from public.vendor_zone_capabilities) <> 200 then raise exception 'FAIL capabilities replaced'; end if;
  if (select created_by from public.vendor_price_grids where version = 2) <> '00000000-0000-0000-0000-0000000000a1' then raise exception 'FAIL grid author must be the signed-in user'; end if;
end $$;
-- same grid again: no new version
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  if (select grid_changed from public.save_vendor_offer(
    (select id from public.organizations where name = 'Atelier Médina'), (select id from public.base_products where slug = 'tee-crew-180'),
    'active', 5, 3, array(select id from public.base_product_variants), '[]',
    '{"version":7,"blanks":{"a":[{"minQty":1,"unitCost":2600}]}}')) then raise exception 'FAIL unchanged grid versioned'; end if;
end $$;
rollback;
-- a failure in the middle leaves nothing half-saved (capability larger than the zone)
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
do $$ declare ok boolean := false; begin
  begin perform public.save_vendor_offer(
    (select id from public.organizations where name = 'Atelier Médina'), (select id from public.base_products where slug = 'tee-crew-180'),
    'draft', 1, 3, '{}', (select jsonb_agg(jsonb_build_object('zone_id', id, 'technique', 'dtf', 'max_width_mm', 900, 'max_height_mm', 250)) from public.zones),
    '{"blanks":{"a":[{"minQty":1,"unitCost":1}]}}');
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'FAIL oversize capability accepted'; end if;
end $$;
commit;
do $$ begin
  if (select status from public.vendor_offers) <> 'active' or (select count(*) from public.vendor_offer_variants) = 0 then raise exception 'FAIL partial save left behind'; end if;
end $$;
-- another workshop cannot save an offer for A
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
do $$ declare ok boolean := false; begin
  begin perform public.save_vendor_offer((select o.id from public.organizations o join public.vendor_offers v on v.vendor_id = o.id limit 1),
    (select id from public.base_products where slug = 'tee-crew-180'), 'draft', 1, 3, '{}', '[]', '{}');
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL other workshop saved an offer for A'; end if;
end $$;
rollback;
-- 13b. Rate limiter: server only, counts per window
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
do $$ declare ok boolean := false; begin
  begin perform public.rate_limit_hit('x', 1, 60); exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL customer called the rate limiter'; end if;
end $$;
rollback;
set role service_role;
do $$ begin
  if not public.rate_limit_hit('otp:+221770000001', 2, 3600) then raise exception 'FAIL hit 1'; end if;
  if not public.rate_limit_hit('otp:+221770000001', 2, 3600) then raise exception 'FAIL hit 2'; end if;
  if public.rate_limit_hit('otp:+221770000001', 2, 3600) then raise exception 'FAIL hit 3 should be refused'; end if;
  if not public.rate_limit_hit('otp:+221770000002', 2, 3600) then raise exception 'FAIL keys are independent'; end if;
end $$;
reset role;
-- 13c. Buckets enforce size and type
do $$ begin
  if (select file_size_limit from storage.buckets where id = 'design-assets') <> 26214400 then raise exception 'FAIL design-assets size limit'; end if;
  if not exists (select 1 from storage.buckets where id = 'qc-photos' and 'image/webp' = any (allowed_mime_types) and not ('image/svg+xml' = any (allowed_mime_types))) then raise exception 'FAIL qc-photos types'; end if;
end $$;

-- 14. Modèles prêts à personnaliser (E15)
begin;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
insert into public.templates (slug, title, base_product_id, occasion, document)
select 'prenom-brode', 'Prénom brodé', id, 'anniversaire',
  '{"schemaVersion":1,"product":"tee-crew-180","colorKey":"ivory","surfaces":[{"zoneKey":"front_center","technique":"dtg","layers":[{"id":"t","type":"text","text":"Awa","font":"caveat","sizeMm":20,"fill":"#2A1A12","xMm":150,"yMm":100,"rotation":0,"widthMm":100,"heightMm":30,"field":{"kind":"text","label":"Prénom"}}]}]}'
from public.base_products where slug = 'tee-crew-180';
insert into public.templates (slug, title, base_product_id, occasion, document)
select 'sans-champ', 'Sans champ', id, 'autre', '{"schemaVersion":1,"product":"tee-crew-180","colorKey":"ivory","surfaces":[]}'
from public.base_products where slug = 'tee-crew-180';
update public.templates set status = 'published' where slug = 'prenom-brode';
do $$ declare ok boolean := false; begin
  begin update public.templates set status = 'published' where slug = 'sans-champ';
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'FAIL template without customer field published'; end if;
end $$;
do $$ declare ok boolean := false; begin
  begin update public.templates set document = jsonb_set(document, '{product}', '"autre-produit"') where slug = 'prenom-brode';
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'FAIL published template for another product'; end if;
end $$;
do $$ declare ok boolean := false; begin
  begin insert into public.templates (slug, title, base_product_id, occasion, document)
    select 'mauvaise-occasion', 'X', id, 'halloween', '{"schemaVersion":1,"product":"tee-crew-180","colorKey":"ivory","surfaces":[]}' from public.base_products where slug = 'tee-crew-180';
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'FAIL unknown occasion accepted'; end if;
end $$;
commit;
-- anonymous visitors and customers see published templates only, and cannot write
begin;
select pg_temp.act_as(null);
do $$ begin
  if (select count(*) from public.templates) <> 1 then raise exception 'FAIL anon sees % templates', (select count(*) from public.templates); end if;
end $$;
rollback;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
do $$ declare n int; begin
  update public.templates set title = 'Piraté' where slug = 'prenom-brode';
  get diagnostics n = row_count;
  if n <> 0 or (select title from public.templates where slug = 'prenom-brode') <> 'Prénom brodé' then raise exception 'FAIL customer edited a template'; end if;
end $$;
do $$ declare ok boolean := false; begin
  begin insert into public.templates (slug, title, base_product_id, occasion, document)
    select 'client-modele', 'X', id, 'autre', '{"schemaVersion":1,"product":"tee-crew-180","colorKey":"ivory","surfaces":[]}' from public.base_products where slug = 'tee-crew-180';
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL customer created a template'; end if;
end $$;
-- template images: anyone reads, only the catalogue team writes
do $$ declare ok boolean := false; begin
  begin insert into storage.objects (bucket_id, name) values ('template-assets', 't1/x.png');
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL customer uploaded a template image'; end if;
end $$;
rollback;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  if (select count(*) from public.templates) <> 1 then raise exception 'FAIL workshop sees draft templates'; end if;
end $$;
rollback;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
insert into storage.objects (bucket_id, name) values ('template-assets', 't1/exemple.png');
do $$ begin
  if (select count(*) from public.templates) <> 2 then raise exception 'FAIL catalog team sees drafts'; end if;
end $$;
do $$ declare n int; begin
  delete from storage.objects where bucket_id = 'template-assets' and name = 't1/exemple.png';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL template image deleted (orders may use it)'; end if;
end $$;
commit;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
insert into storage.objects (bucket_id, name) values ('design-assets', '00000000-0000-0000-0000-0000000000c1/photo.png');
commit;
begin;
select pg_temp.act_as(null);
do $$ begin
  if not exists (select 1 from storage.objects where bucket_id = 'template-assets' and name = 't1/exemple.png') then raise exception 'FAIL anon cannot read template image'; end if;
  if exists (select 1 from storage.objects where bucket_id = 'design-assets') then raise exception 'FAIL anon reads customer images'; end if;
end $$;
rollback;

-- 15. Commandes d'équipe : liste figée avec la ligne (E16)
set role service_role;
create temp table e16_order as
select * from public.create_order('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000d001', '{"schemaVersion":1}', 'e16', '[]',
  '[{"color_key":"ivory","sizes":{"M":1,"L":1},"quantity":2,"unit_price":7200,"line_total":14400,"decorations":[],"roster":[{"size":"M","name":"Diop","number":"10"},{"size":"L","name":"Fall","number":"7"}]}]',
  '{"subtotal":14400,"tax":2197,"total":14400}', '{"ruleSetVersion":1}', '{"name":"Awa","phone":"+221770000005"}');
do $$ declare ok boolean := false; begin
  if (select jsonb_array_length(roster) from public.order_items where order_id = (select order_id from e16_order)) <> 2 then raise exception 'FAIL roster not stored'; end if;
  begin update public.order_items set roster = '[{"size":"M"},{"size":"L"}]' where order_id = (select order_id from e16_order);
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'FAIL roster changed after the order'; end if;
end $$;
do $$ declare ok boolean := false; begin
  begin perform public.create_order('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000d001', '{"schemaVersion":1}', 'e16b', '[]',
    '[{"color_key":"ivory","sizes":{"M":3},"quantity":3,"unit_price":7200,"line_total":21600,"decorations":[],"roster":[{"size":"M"}]}]',
    '{"subtotal":21600,"tax":3295,"total":21600}', '{"ruleSetVersion":1}', '{"name":"Awa","phone":"+221770000005"}');
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'FAIL roster of 1 accepted for 3 pieces'; end if;
end $$;
reset role;
-- the customer reads the roster of their order, another workshop does not
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
do $$ begin
  if not exists (select 1 from public.order_items where roster is not null) then raise exception 'FAIL customer cannot read own roster'; end if;
end $$;
rollback;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  if exists (select 1 from public.order_items where roster is not null) then raise exception 'FAIL other workshop reads the roster'; end if;
end $$;
rollback;

select 'ALL RLS TESTS PASSED' as result;
