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
do $$ declare ok boolean := false; begin
  begin perform public.create_order('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000d001', '{"schemaVersion":1}', 'e16c', '[]',
    '[{"color_key":"ivory","sizes":{"M":2},"quantity":2,"unit_price":7200,"line_total":14400,"decorations":[],"roster":[{"size":"M"},{"size":"XL"}]}]',
    '{"subtotal":14400,"tax":2197,"total":14400}', '{"ruleSetVersion":1}', '{"name":"Awa","phone":"+221770000005"}');
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'FAIL sizes inconsistent with the roster accepted'; end if;
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

-- 16. Devis B2B (E17)
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
insert into public.quote_requests (organization_name, contact_name, phone, base_product_id, quantity, message, logo_path)
select 'ASC Jaraaf', 'Awa Diop', '+221770000005', id, 60, 'Maillots saison', '00000000-0000-0000-0000-0000000000c1/logo.png'
from public.base_products where slug = 'tee-crew-180';
do $$ declare ok boolean := false; begin
  begin insert into public.quote_requests (organization_name, contact_name, phone, quantity, status) values ('X', 'Yy', '+221770000005', 10, 'quoted');
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL customer created a request already quoted'; end if;
end $$;
do $$ declare ok boolean := false; begin
  begin insert into public.quote_requests (organization_name, contact_name, phone, quantity, logo_path) values ('Xx', 'Yy', '+221770000005', 10, '00000000-0000-0000-0000-0000000000a1/logo.png');
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'FAIL request with someone else''s logo'; end if;
end $$;
do $$ declare n int; begin
  update public.quote_requests set status = 'quoted', staff_note = 'x';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL customer changed the request status'; end if;
end $$;
commit;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  if exists (select 1 from public.quote_requests) then raise exception 'FAIL workshop reads quote requests'; end if;
end $$;
rollback;
-- the team quotes it (super admin)
begin;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into public.b2b_quotes (request_id, version, base_product_id, color_key, quantity, decorations, unit_price, goods_total, tax, lead_time_days, snapshot, valid_until)
select r.id, 1, r.base_product_id, 'ivory', 60, '[]', 5600, 336000, 51254, 5, '{"ruleSetVersion":1}', now() + interval '30 days' from public.quote_requests r where organization_name = 'ASC Jaraaf';
insert into public.b2b_quotes (request_id, version, base_product_id, color_key, quantity, decorations, unit_price, goods_total, tax, lead_time_days, snapshot, valid_until)
select r.id, 2, r.base_product_id, 'ivory', 60, '[]', 5000, 300000, 45763, 5, '{"ruleSetVersion":1}', now() - interval '1 day' from public.quote_requests r where organization_name = 'ASC Jaraaf';
update public.quote_requests set status = 'quoted' where organization_name = 'ASC Jaraaf';
insert into public.b2b_quote_internals (quote_id, vendor_cost, margin) select id, 210000, 74746 from public.b2b_quotes where version = 1;
do $$ declare ok boolean := false; begin
  begin update public.b2b_quotes set order_id = (select id from public.orders limit 1) where version = 1;
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'FAIL staff linked a quote to an arbitrary order'; end if;
end $$;
do $$ begin
  begin delete from public.b2b_quotes where version = 2; exception when insufficient_privilege then null; end;
  if not exists (select 1 from public.b2b_quotes where version = 2) then raise exception 'FAIL quote deleted'; end if;
end $$;
do $$ declare ok boolean := false; begin
  begin update public.b2b_quotes set unit_price = 1 where version = 1;
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'FAIL frozen quote price changed'; end if;
end $$;
commit;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
do $$ declare ok boolean := false; begin
  if (select count(*) from public.b2b_quotes) <> 2 then raise exception 'FAIL customer cannot read own quotes'; end if;
  if exists (select 1 from public.b2b_quote_internals) then raise exception 'FAIL customer reads workshop cost and margin'; end if;
  if exists (select 1 from public.b2b_quotes where snapshot ? 'margin' or snapshot ? 'vendorCost') then raise exception 'FAIL internal figures in the customer-readable snapshot'; end if;
  begin insert into public.b2b_quotes (request_id, version, base_product_id, color_key, quantity, decorations, unit_price, goods_total, tax, lead_time_days, snapshot, valid_until)
    select request_id, 3, base_product_id, color_key, 60, '[]', 1, 60, 0, 5, '{}', now() + interval '30 days' from public.b2b_quotes where version = 1;
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL customer wrote own quote'; end if;
end $$;
do $$ declare ok boolean := false; begin
  begin perform public.claim_b2b_quote((select id from public.b2b_quotes where version = 1), auth.uid());
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL customer claimed a quote directly'; end if;
end $$;
rollback;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  if exists (select 1 from public.b2b_quotes) then raise exception 'FAIL workshop reads quotes'; end if;
end $$;
rollback;
-- finance reads quotes and internal figures, but does not write quotes
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
do $$ declare ok boolean := false; begin
  if (select count(*) from public.b2b_quotes) <> 2 or (select count(*) from public.b2b_quote_internals) <> 1 then raise exception 'FAIL finance cannot read quotes'; end if;
  begin insert into public.b2b_quotes (request_id, version, base_product_id, color_key, quantity, decorations, unit_price, goods_total, tax, lead_time_days, snapshot, valid_until)
    select request_id, 9, base_product_id, color_key, 60, '[]', 1, 60, 0, 5, '{}', now() + interval '30 days' from public.b2b_quotes where version = 1;
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL finance wrote a quote'; end if;
end $$;
rollback;
-- the server claims the valid quote once; an expired one or a second claim gets nothing
set role service_role;
do $$ begin
  if (select count(*) from public.claim_b2b_quote((select id from public.b2b_quotes where version = 2), '00000000-0000-0000-0000-0000000000c1')) <> 0 then raise exception 'FAIL expired quote claimed'; end if;
  if (select count(*) from public.claim_b2b_quote((select id from public.b2b_quotes where version = 1), '00000000-0000-0000-0000-0000000000b1')) <> 0 then raise exception 'FAIL quote claimed by another customer'; end if;
  if (select count(*) from public.claim_b2b_quote((select id from public.b2b_quotes where version = 1), '00000000-0000-0000-0000-0000000000c1')) <> 1 then raise exception 'FAIL valid quote not claimed'; end if;
  if (select count(*) from public.claim_b2b_quote((select id from public.b2b_quotes where version = 1), '00000000-0000-0000-0000-0000000000c1')) <> 0 then raise exception 'FAIL quote claimed twice'; end if;
  perform public.release_b2b_quote((select id from public.b2b_quotes where version = 1));
  if (select status from public.b2b_quotes where version = 1) <> 'sent' then raise exception 'FAIL quote not released'; end if;
end $$;
-- while a quote is being ordered, the customer cannot cancel the request
do $$ begin
  perform public.claim_b2b_quote((select id from public.b2b_quotes where version = 1), '00000000-0000-0000-0000-0000000000c1');
end $$;
reset role;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
do $$ declare ok boolean := false; begin
  begin perform public.cancel_quote_request((select id from public.quote_requests where organization_name = 'ASC Jaraaf'));
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL request cancelled while its quote is being ordered'; end if;
end $$;
rollback;
set role service_role;
do $$ begin
  perform public.link_b2b_quote((select id from public.b2b_quotes where version = 1), (select id from public.orders order by created_at limit 1));
  if (select order_id from public.b2b_quotes where version = 1) is null then raise exception 'FAIL quote not linked to its order'; end if;
  if (select status from public.quote_requests where organization_name = 'ASC Jaraaf') <> 'ordered' then raise exception 'FAIL request not marked ordered'; end if;
  perform public.release_b2b_quote((select id from public.b2b_quotes where version = 1));
  if (select status from public.b2b_quotes where version = 1) <> 'accepted' then raise exception 'FAIL linked quote released'; end if;
end $$;
reset role;
-- the customer cancels a request that is only quoted: its quote is withdrawn
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
insert into public.quote_requests (organization_name, contact_name, phone, quantity) values ('Club Médina', 'Awa Diop', '+221770000005', 20);
commit;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
update public.quote_requests set status = 'quoted' where organization_name = 'Club Médina';
insert into public.b2b_quotes (request_id, version, base_product_id, color_key, quantity, decorations, unit_price, goods_total, tax, lead_time_days, snapshot, valid_until)
select r.id, 1, (select id from public.base_products where slug = 'tee-crew-180'), 'ivory', 20, '[]', 5600, 112000, 17085, 5, '{}', now() + interval '30 days' from public.quote_requests r where organization_name = 'Club Médina';
commit;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select public.cancel_quote_request((select id from public.quote_requests where organization_name = 'Club Médina'));
do $$ begin
  if (select status from public.quote_requests where organization_name = 'Club Médina') <> 'cancelled' then raise exception 'FAIL request not cancelled'; end if;
  if (select q.status from public.b2b_quotes q join public.quote_requests r on r.id = q.request_id where r.organization_name = 'Club Médina') <> 'withdrawn' then raise exception 'FAIL quote not withdrawn'; end if;
end $$;
rollback;

-- 17. Modération des images (E18d)
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
insert into public.content_reports (target_type, target_id, reporter_role, reason, details)
values ('order', (select order_id from public.fulfillments where vendor_id is not null limit 1), 'vendor', 'trademark', 'Logo d''une marque connue');
commit;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
do $$ declare ok boolean := false; begin
  begin insert into public.content_reports (target_type, target_id, reporter_role, reason)
    values ('order', (select order_id from public.fulfillments where vendor_id is not null limit 1), 'vendor', 'trademark');
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL other workshop reported an order it does not have'; end if;
end $$;
do $$ declare ok boolean := false; begin
  begin insert into public.content_reports (target_type, target_id, reporter_role, reason)
    values ('order', (select order_id from public.fulfillments limit 1), 'customer', 'other');
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL report on someone else''s order'; end if;
end $$;
do $$ declare ok boolean := false; begin
  begin insert into public.content_reports (target_type, target_id, reporter_role, reason) values ('template', gen_random_uuid(), 'customer', 'other');
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'FAIL report on an unknown template'; end if;
end $$;
do $$ declare ok boolean := false; begin
  begin insert into public.content_reports (target_type, target_id, reporter_role, reason)
    values ('template', (select id from public.templates where status = 'published' limit 1), 'staff', 'other');
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL non-staff reported as staff'; end if;
end $$;
insert into public.content_reports (target_type, target_id, reporter_role, reason, details)
values ('template', (select id from public.templates where status = 'published' limit 1), 'customer', 'protected_character', 'Personnage de dessin animé');
do $$ declare n int; begin
  if (select count(*) from public.content_reports) <> 1 then raise exception 'FAIL reporter sees other reports'; end if;
  update public.content_reports set status = 'dismissed';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL reporter resolved a report'; end if;
end $$;
commit;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
do $$ begin
  if (select count(*) from public.content_reports where status = 'open') <> 2 then raise exception 'FAIL staff cannot see the queue'; end if;
  update public.content_reports set status = 'upheld', resolution_note = 'Marque déposée', resolved_by = auth.uid(), resolved_at = now() where reason = 'trademark';
  if (select status from public.content_reports where reason = 'trademark') <> 'upheld' then raise exception 'FAIL staff cannot resolve'; end if;
end $$;
do $$ declare ok boolean := false; begin
  begin update public.content_reports set status = 'open' where reason = 'trademark';
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'FAIL resolved report reopened'; end if;
end $$;
do $$ declare ok boolean := false; begin
  begin update public.content_reports set reason = 'other', details = 'réécrit' where reason = 'protected_character';
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'FAIL report content rewritten by staff'; end if;
end $$;
rollback;
-- a workshop does not read the moderation queue (only its own reports)
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  if exists (select 1 from public.content_reports where reporter_id <> auth.uid()) then raise exception 'FAIL workshop reads the moderation queue'; end if;
end $$;
rollback;
-- rights declaration is stored on the design
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name = 'designs' and column_name = 'rights_declared_at') then raise exception 'FAIL rights column'; end if;
end $$;

-- 18. Grand livre, versements, litiges (E20)
update public.fulfillments set status = 'delivered' where vendor_id is not null and vendor_cost is not null and status <> 'delivered';
do $$ begin
  if (select count(*) from public.vendor_ledger where type = 'earning') <> 1 then raise exception 'FAIL earning not credited at delivery'; end if;
  if (select amount from public.vendor_ledger where type = 'earning') <> (select vendor_cost from public.fulfillments where id = (select fulfillment_id from public.vendor_ledger where type = 'earning')) then raise exception 'FAIL earning is not the frozen vendor cost'; end if;
end $$;
update public.fulfillments set status = 'delivered' where vendor_id is not null;
do $$ begin
  if (select count(*) from public.vendor_ledger where type = 'earning') <> 1 then raise exception 'FAIL earning credited twice'; end if;
end $$;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
do $$ declare ok boolean := false; begin
  if (select count(*) from public.vendor_ledger) <> 1 then raise exception 'FAIL workshop cannot read its ledger'; end if;
  begin update public.vendor_ledger set amount = 999999; exception when insufficient_privilege then ok := true; end;
  if not ok and (select amount from public.vendor_ledger limit 1) = 999999 then raise exception 'FAIL ledger edited'; end if;
end $$;
do $$ declare ok boolean := false; begin
  begin perform public.record_payout((select vendor_id from public.vendor_ledger limit 1), 1000, 'wave', 'ref-1', auth.uid());
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL workshop recorded its own payout'; end if;
end $$;
rollback;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  if exists (select 1 from public.vendor_ledger) or exists (select 1 from public.payouts) then raise exception 'FAIL other workshop reads the ledger'; end if;
end $$;
rollback;
set role service_role;
do $$ declare ok boolean := false; begin
  begin perform public.record_payout((select vendor_id from public.vendor_ledger limit 1), ((select sum(amount) from public.vendor_ledger) + 1)::bigint, 'wave', 'ref-trop', '00000000-0000-0000-0000-0000000000f1');
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'FAIL payout above balance'; end if;
  perform public.record_payout((select vendor_id from public.vendor_ledger limit 1), 5000, 'wave', 'WAVE-123', '00000000-0000-0000-0000-0000000000f1');
  if (select sum(amount) from public.vendor_ledger) <> (select vendor_cost from public.fulfillments where id = (select fulfillment_id from public.vendor_ledger where type = 'earning')) - 5000 then raise exception 'FAIL balance after payout'; end if;
end $$;
reset role;
-- finance adjusts (not backdated, not tied to an order); a workshop cannot
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
insert into public.vendor_ledger (vendor_id, type, amount, note, created_by) select vendor_id, 'adjustment', 500, 'Frais de transport remboursés', auth.uid() from public.vendor_ledger limit 1;
do $$ declare ok boolean := false; begin
  begin insert into public.vendor_ledger (vendor_id, type, amount, note, created_by, at) select vendor_id, 'adjustment', 500, 'Antidaté', auth.uid(), now() - interval '90 days' from public.vendor_ledger limit 1;
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL backdated adjustment'; end if;
end $$;
rollback;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
do $$ declare ok boolean := false; begin
  begin insert into public.vendor_ledger (vendor_id, type, amount, note, created_by) select vendor_id, 'adjustment', 50000, 'Je me paie', auth.uid() from public.vendor_ledger limit 1;
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL workshop adjusted its own ledger'; end if;
end $$;
rollback;
-- disputes
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
do $$ declare ok boolean := false; begin
  begin insert into public.disputes (order_id, reason, description) values ((select order_id from public.fulfillments where status = 'delivered' limit 1), 'defect', 'Impression décollée');
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL dispute on someone else''s order'; end if;
end $$;
rollback;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
do $$ declare ok boolean := false; begin
  begin insert into public.disputes (order_id, reason, description, photos) values ((select order_id from public.fulfillments where status = 'delivered' limit 1), 'defect', 'Impression décollée', '{00000000-0000-0000-0000-0000000000b1/x.jpg}');
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'FAIL dispute with someone else''s photo'; end if;
end $$;
insert into public.disputes (order_id, reason, description, photos) values ((select order_id from public.fulfillments where status = 'delivered' limit 1), 'defect', 'Impression décollée après un lavage', '{00000000-0000-0000-0000-0000000000c1/litige.jpg}');
do $$ declare n int; begin
  update public.disputes set status = 'resolved', refund_amount = 999999;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL customer resolved own dispute'; end if;
end $$;
commit;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  if (select count(*) from public.disputes) <> 1 then raise exception 'FAIL assigned workshop cannot read the dispute'; end if;
end $$;
rollback;
set role service_role;
do $$ declare ok boolean := false; begin
  begin perform public.resolve_dispute((select id from public.disputes limit 1), 'resolved', 'partial_refund', 99999999, true, 3000, 'trop', '00000000-0000-0000-0000-00000000000a');
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'FAIL refund above order total'; end if;
  ok := false;
  begin perform public.resolve_dispute((select id from public.disputes limit 1), 'rejected', 'none', 0, true, 3000, 'Non retenu mais pénalité', '00000000-0000-0000-0000-00000000000a');
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'FAIL penalty on a rejected dispute'; end if;
  ok := false;
  begin perform public.resolve_dispute((select id from public.disputes limit 1), 'resolved', 'none', 5000, false, null, 'Aucune compensation mais remboursé', '00000000-0000-0000-0000-00000000000a');
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'FAIL refund recorded without a refund decision'; end if;
  ok := false;
  begin perform public.resolve_dispute((select id from public.disputes limit 1), 'resolved', 'partial_refund', 0, false, null, 'Partiel sans montant', '00000000-0000-0000-0000-00000000000a');
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'FAIL partial refund without amount'; end if;
  perform public.resolve_dispute((select id from public.disputes limit 1), 'resolved', 'reprint', 0, true, 3000, 'Défaut prouvé par la photo de contrôle', '00000000-0000-0000-0000-00000000000a');
  if (select amount from public.vendor_ledger where type = 'penalty') <> -3000 then raise exception 'FAIL penalty not in the ledger'; end if;
  ok := false;
  begin perform public.resolve_dispute((select id from public.disputes limit 1), 'rejected', 'none', 0, false, 0, 'x', '00000000-0000-0000-0000-00000000000a');
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'FAIL dispute resolved twice'; end if;
end $$;
reset role;

-- 19. Équipe et disponibilités des ateliers (E21)
insert into auth.users (id, phone) values ('00000000-0000-0000-0000-0000000000d1', '221770000010'); -- format Supabase (sans +)
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.invite_vendor_member((select id from public.organizations where name = 'Atelier Médina'), '+221770000010', 'operator');
insert into public.vendor_closures (vendor_id, starts_on, ends_on, reason) select id, current_date + 3, current_date + 5, 'Tabaski' from public.organizations where name = 'Atelier Médina';
commit;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
do $$ declare ok boolean := false; begin
  if exists (select 1 from public.vendor_closures) then raise exception 'FAIL other workshop reads closures'; end if;
  if exists (select 1 from public.my_vendor_invitations()) then raise exception 'FAIL invitation visible to another phone'; end if;
  begin perform public.accept_vendor_invitation((select id from public.vendor_invitations limit 1));
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL invitation accepted by another phone'; end if;
end $$;
rollback;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
do $$ begin
  if (select count(*) from public.my_vendor_invitations()) <> 1 then raise exception 'FAIL invited person does not see the invitation'; end if;
end $$;
select public.accept_vendor_invitation((select id from public.my_vendor_invitations() limit 1));
commit;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
do $$ declare ok boolean := false; n int; begin
  if app.vendor_role((select id from public.organizations where name = 'Atelier Médina')) <> 'operator' then raise exception 'FAIL operator membership'; end if;
  if not exists (select 1 from public.fulfillments) then raise exception 'FAIL operator cannot see the workshop orders'; end if;
  if exists (select 1 from public.vendor_ledger) or exists (select 1 from public.payouts) then raise exception 'FAIL operator reads the money'; end if;
  if exists (select 1 from public.vendor_offers) or exists (select 1 from public.vendor_price_grids) or exists (select 1 from public.vendor_zone_capabilities) or exists (select 1 from public.vendor_offer_variants)
    then raise exception 'FAIL operator reads the offers and price grids'; end if;
  begin perform public.invite_vendor_member((select id from public.organizations where name = 'Atelier Médina'), '+221770000011', 'operator');
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL operator invited someone'; end if;
  update public.vendor_profiles set capacity_per_day = 999;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL operator changed the workshop capacity'; end if;
  ok := false;
  begin insert into public.vendor_closures (vendor_id, starts_on, ends_on) select id, current_date, current_date from public.organizations where name = 'Atelier Médina';
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL operator added a closure'; end if;
end $$;
rollback;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
do $$ declare ok boolean := false; begin
  if (select count(*) from public.vendor_team((select id from public.organizations where name = 'Atelier Médina'))) <> 2 then raise exception 'FAIL owner cannot list the team'; end if;
  if not exists (select 1 from public.vendor_offers) or not exists (select 1 from public.vendor_price_grids) then raise exception 'FAIL owner cannot read own offers'; end if;
  perform public.set_vendor_member((select id from public.organizations where name = 'Atelier Médina'), '00000000-0000-0000-0000-0000000000d1', 'manager');
  if (select role from public.memberships where user_id = '00000000-0000-0000-0000-0000000000d1') <> 'manager' then raise exception 'FAIL role change'; end if;
  begin perform public.set_vendor_member((select id from public.organizations where name = 'Atelier Médina'), '00000000-0000-0000-0000-0000000000a1', null);
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'FAIL last owner removed'; end if;
end $$;
commit;
begin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1'); -- now a manager
do $$ declare ok boolean := false; begin
  begin perform public.invite_vendor_member((select id from public.organizations where name = 'Atelier Médina'), '+221770000012', 'manager');
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL manager invited a manager'; end if;
  perform public.invite_vendor_member((select id from public.organizations where name = 'Atelier Médina'), '+221770000012', 'operator');
end $$;
rollback;

select 'ALL RLS TESTS PASSED' as result;
