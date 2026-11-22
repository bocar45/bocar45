-- SAWWA — migration 3 : créations enregistrées, versions figées, commandes, ordres de fabrication, historique, fichiers.
-- Les écritures de commande passent par des fonctions appelées par le serveur (service_role) après contrôle des droits
-- et calcul du prix en TypeScript (packages/pricing, packages/workflow). La RLS encadre les lectures.

-- ───────────────────────────── Créations ─────────────────────────────
create table public.designs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  base_product_id uuid not null references public.base_products (id),
  title text not null default 'Ma création',
  document jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index designs_owner on public.designs (owner_id, updated_at desc);
create trigger touch before update on public.designs for each row execute function app.touch_updated_at();

-- Version figée d'une création, référencée par les commandes. Immuable.
create table public.design_versions (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references public.designs (id) on delete restrict,
  number int not null,
  document jsonb not null,
  sha256 text not null,
  preflight jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (design_id, number)
);
create trigger design_versions_immutable before update or delete on public.design_versions
  for each row execute function app.forbid_change();

-- ───────────────────────────── Commandes ─────────────────────────────
create sequence public.order_number_seq;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  customer_id uuid not null references auth.users (id),
  payment_status text not null default 'awaiting_payment' check (payment_status in ('awaiting_payment', 'paid', 'refunded', 'cancelled')),
  currency char(3) not null default 'XOF',
  subtotal bigint not null check (subtotal >= 0),
  shipping bigint not null default 0 check (shipping >= 0),
  discount bigint not null default 0 check (discount >= 0),
  tax bigint not null check (tax >= 0),
  total bigint not null check (total >= 0),
  deposit_due bigint,
  quote_snapshot jsonb not null, -- versions des règles et grilles + requête complète (packages/pricing Quote.snapshot)
  shipping_address jsonb not null, -- nom, téléphone, quartier, repère, ville, point GPS
  paid_at timestamptz,
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_customer on public.orders (customer_id, created_at desc);
create trigger touch before update on public.orders for each row execute function app.touch_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  design_version_id uuid not null references public.design_versions (id),
  base_product_id uuid not null references public.base_products (id),
  color_key text not null,
  sizes jsonb not null, -- {"M": 10, "L": 5}
  quantity int not null check (quantity > 0),
  unit_price bigint not null check (unit_price >= 0),
  line_total bigint not null check (line_total >= 0),
  decorations jsonb not null -- zones, techniques, tailles imprimées : ce que l'atelier doit produire
);

-- Ordre de fabrication (un par atelier). Statuts = packages/workflow FULFILLMENT_STATUSES.
create table public.fulfillments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  vendor_id uuid references public.organizations (id),
  status text not null default 'pending_assignment' check (status in (
    'pending_assignment', 'assigned', 'proof_review', 'changes_requested', 'proof_approved',
    'in_production', 'quality_check', 'shipped', 'delivered', 'rejected_by_vendor', 'on_hold', 'cancelled')),
  proof_round int not null default 0,
  held_from text,
  sla_due_at timestamptz,
  vendor_cost bigint, -- coût atelier figé à l'affectation (jamais montré au client)
  carrier text,
  tracking_number text,
  qc_photos text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index fulfillments_vendor on public.fulfillments (vendor_id, status);
create index fulfillments_order on public.fulfillments (order_id);
create trigger touch before update on public.fulfillments for each row execute function app.touch_updated_at();

create table public.status_events (
  id bigint generated always as identity primary key,
  fulfillment_id uuid references public.fulfillments (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  event text not null,
  from_status text,
  to_status text,
  actor_user_id uuid,
  actor_role text not null,
  payload jsonb not null default '{}', -- motif, commentaire, version de création…
  at timestamptz not null default now()
);
create index status_events_order on public.status_events (order_id, at);
create trigger status_events_append_only before update or delete on public.status_events
  for each row execute function app.forbid_change();

-- ───────────────────────────── Fonctions serveur (service_role) ─────────────────────────────
-- Création atomique : version figée + commande + lignes + ordre de fabrication + événement.
create function public.create_order(
  p_customer uuid, p_design uuid, p_document jsonb, p_sha256 text, p_preflight jsonb,
  p_items jsonb, p_totals jsonb, p_quote jsonb, p_address jsonb
) returns table (order_id uuid, order_number text)
language plpgsql security definer set search_path = '' as $$
declare v_version uuid; v_order uuid; v_number text; v_fulfillment uuid; item jsonb; v_product uuid;
begin
  select base_product_id into v_product from public.designs where id = p_design and owner_id = p_customer;
  if not found then raise exception 'design not found for this customer' using errcode = '42501'; end if;

  insert into public.design_versions (design_id, number, document, sha256, preflight)
  values (p_design, coalesce((select max(number) from public.design_versions where design_id = p_design), 0) + 1, p_document, p_sha256, p_preflight)
  returning id into v_version;

  v_number := 'SW-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.order_number_seq')::text, 6, '0');
  insert into public.orders (number, customer_id, subtotal, shipping, discount, tax, total, deposit_due, quote_snapshot, shipping_address)
  values (v_number, p_customer, (p_totals->>'subtotal')::bigint, coalesce((p_totals->>'shipping')::bigint, 0), coalesce((p_totals->>'discount')::bigint, 0),
          (p_totals->>'tax')::bigint, (p_totals->>'total')::bigint, (p_totals->>'deposit_due')::bigint, p_quote, p_address)
  returning id into v_order;

  for item in select * from jsonb_array_elements(p_items) loop
    insert into public.order_items (order_id, design_version_id, base_product_id, color_key, sizes, quantity, unit_price, line_total, decorations)
    values (v_order, v_version, v_product, item->>'color_key', item->'sizes', (item->>'quantity')::int,
            (item->>'unit_price')::bigint, (item->>'line_total')::bigint, item->'decorations');
  end loop;

  insert into public.fulfillments (order_id) values (v_order) returning id into v_fulfillment;
  insert into public.status_events (fulfillment_id, order_id, event, to_status, actor_user_id, actor_role, payload)
  values (v_fulfillment, v_order, 'order_placed', 'pending_assignment', p_customer, 'customer', jsonb_build_object('design_version', v_version));
  return query select v_order, v_number;
end $$;

-- Transition d'état calculée par packages/workflow ; contrôle optimiste sur le statut de départ.
create function public.apply_fulfillment_transition(
  p_id uuid, p_from text, p_state jsonb, p_event text, p_actor uuid, p_role text, p_payload jsonb, p_extra jsonb default '{}'
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_order uuid;
begin
  update public.fulfillments set
    status = p_state->>'status',
    vendor_id = (p_state->>'vendorId')::uuid,
    proof_round = (p_state->>'proofRound')::int,
    held_from = p_state->>'heldFrom',
    sla_due_at = case when p_extra ? 'sla_hours' then now() + make_interval(hours => (p_extra->>'sla_hours')::int) else sla_due_at end,
    vendor_cost = coalesce((p_extra->>'vendor_cost')::bigint, vendor_cost),
    carrier = coalesce(p_extra->>'carrier', carrier),
    tracking_number = coalesce(p_extra->>'tracking_number', tracking_number),
    qc_photos = case when p_extra ? 'qc_photos' then array(select jsonb_array_elements_text(p_extra->'qc_photos')) else qc_photos end
  where id = p_id and status = p_from
  returning order_id into v_order;
  if not found then raise exception 'conflict: fulfillment changed meanwhile' using errcode = '40001'; end if;
  insert into public.status_events (fulfillment_id, order_id, event, from_status, to_status, actor_user_id, actor_role, payload)
  values (p_id, v_order, p_event, p_from, p_state->>'status', p_actor, p_role, p_payload);
end $$;

-- Paiement confirmé (pilote : confirmation manuelle par la finance ; ensuite : webhook de l'agrégateur).
create function public.mark_order_paid(p_order uuid, p_actor uuid, p_reference text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.orders set payment_status = 'paid', paid_at = now(), payment_reference = p_reference
  where id = p_order and payment_status = 'awaiting_payment';
  if not found then raise exception 'order is not awaiting payment' using errcode = '40001'; end if;
  insert into public.status_events (order_id, event, actor_user_id, actor_role, payload)
  values (p_order, 'payment_confirmed', p_actor, 'admin', jsonb_build_object('reference', p_reference));
end $$;

revoke execute on function public.create_order(uuid, uuid, jsonb, text, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.apply_fulfillment_transition(uuid, text, jsonb, text, uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.mark_order_paid(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.create_order(uuid, uuid, jsonb, text, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.apply_fulfillment_transition(uuid, text, jsonb, text, uuid, text, jsonb, jsonb) to service_role;
grant execute on function public.mark_order_paid(uuid, uuid, text) to service_role;

-- ───────────────────────────── RLS (lectures) ─────────────────────────────
alter table public.designs enable row level security;
alter table public.design_versions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.fulfillments enable row level security;
alter table public.status_events enable row level security;

create function app.vendor_has_order(p_order uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.fulfillments f where f.order_id = p_order and f.vendor_id is not null and app.is_member(f.vendor_id))
$$;
grant execute on function app.vendor_has_order(uuid) to authenticated;

create policy designs_owner on public.designs for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy designs_admin_read on public.designs for select to authenticated using (app.has_platform_role('{ops,support}'));

create policy versions_read on public.design_versions for select to authenticated
  using (exists (select 1 from public.designs d where d.id = design_id and d.owner_id = auth.uid())
         or app.has_platform_role('{ops,support}')
         or exists (select 1 from public.order_items i where i.design_version_id = design_versions.id and app.vendor_has_order(i.order_id)));

-- Le client voit ses commandes ; l'atelier ne voit pas la table orders (ni prix public ni coordonnées complètes).
create policy orders_customer on public.orders for select to authenticated
  using (customer_id = auth.uid() or app.has_platform_role('{ops,support,finance}'));
create policy order_items_read on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
         or app.has_platform_role('{ops,support,finance}')
         or app.vendor_has_order(order_id));
create policy fulfillments_read on public.fulfillments for select to authenticated
  using ((vendor_id is not null and app.is_member(vendor_id))
         or exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
         or app.has_platform_role('{ops,support,finance,vendor_manager}'));
create policy status_events_read on public.status_events for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
         or app.has_platform_role('{ops,support,finance}')
         or (fulfillment_id is not null and exists (select 1 from public.fulfillments f where f.id = fulfillment_id and f.vendor_id is not null and app.is_member(f.vendor_id))));

-- ───────────────────────────── Fichiers (Supabase Storage) ─────────────────────────────
insert into storage.buckets (id, name, public) values ('design-assets', 'design-assets', false), ('qc-photos', 'qc-photos', false)
on conflict (id) do nothing;

-- Images des créations : chaque client écrit et lit dans son dossier <user_id>/…
create policy design_assets_own on storage.objects for all to authenticated
  using (bucket_id = 'design-assets' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'design-assets' and (storage.foldername(name))[1] = auth.uid()::text);
-- Photos de contrôle qualité : dossier <vendor_id>/… réservé aux membres de l'atelier.
create function app.is_member_folder(p_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare f text := (storage.foldername(p_name))[1];
begin
  if f !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  return app.is_member(f::uuid);
end $$;
grant execute on function app.is_member_folder(text) to authenticated;
create policy qc_photos_vendor on storage.objects for all to authenticated
  using (bucket_id = 'qc-photos' and app.is_member_folder(name))
  with check (bucket_id = 'qc-photos' and app.is_member_folder(name));
-- Les ateliers lisent les images des créations via des URL signées générées par le serveur.
