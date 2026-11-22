-- SAWWA — migration 4 : correction de la création par le client (E10).
-- Chaque ligne de commande garde l'historique de ses versions figées ; le renvoi au BAT est atomique.

create table public.order_item_versions (
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  design_version_id uuid not null references public.design_versions (id),
  proof_round int not null,
  surcharge bigint not null default 0 check (surcharge >= 0), -- supplément TTC accepté par le client (encaissé par la finance)
  created_at timestamptz not null default now(),
  primary key (order_item_id, design_version_id)
);
create trigger order_item_versions_append_only before update or delete on public.order_item_versions
  for each row execute function app.forbid_change();

-- Les versions déjà commandées entrent dans l'historique.
insert into public.order_item_versions (order_item_id, design_version_id, proof_round)
select i.id, i.design_version_id, 0 from public.order_items i
on conflict do nothing;

-- create_order enregistre aussi la première version dans l'historique.
create or replace function public.create_order(
  p_customer uuid, p_design uuid, p_document jsonb, p_sha256 text, p_preflight jsonb,
  p_items jsonb, p_totals jsonb, p_quote jsonb, p_address jsonb
) returns table (order_id uuid, order_number text)
language plpgsql security definer set search_path = '' as $$
declare v_version uuid; v_order uuid; v_number text; v_fulfillment uuid; v_item uuid; item jsonb; v_product uuid;
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
            (item->>'unit_price')::bigint, (item->>'line_total')::bigint, item->'decorations')
    returning id into v_item;
    insert into public.order_item_versions (order_item_id, design_version_id, proof_round) values (v_item, v_version, 0);
  end loop;

  insert into public.fulfillments (order_id) values (v_order) returning id into v_fulfillment;
  insert into public.status_events (fulfillment_id, order_id, event, to_status, actor_user_id, actor_role, payload)
  values (v_fulfillment, v_order, 'order_placed', 'pending_assignment', p_customer, 'customer', jsonb_build_object('design_version', v_version));
  return query select v_order, v_number;
end $$;

/**
 * Renvoi au BAT après correction : nouvelle version figée + rattachement à la ligne + transition (calculée par
 * packages/workflow, contrôle optimiste sur 'changes_requested') + événement, en une seule transaction.
 */
create function public.resubmit_design(
  p_order uuid, p_customer uuid, p_document jsonb, p_sha256 text, p_preflight jsonb,
  p_decorations jsonb, p_surcharge bigint, p_state jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_item public.order_items; v_design uuid; v_version uuid; v_f uuid;
begin
  if not exists (select 1 from public.orders where id = p_order and customer_id = p_customer) then
    raise exception 'order not found for this customer' using errcode = '42501';
  end if;
  select * into v_item from public.order_items where order_id = p_order order by id limit 1;
  select design_id into v_design from public.design_versions where id = v_item.design_version_id;

  update public.fulfillments set status = p_state->>'status', proof_round = (p_state->>'proofRound')::int,
    sla_due_at = now() + interval '24 hours'
  where order_id = p_order and status = 'changes_requested'
  returning id into v_f;
  if not found then raise exception 'conflict: order is not waiting for a correction' using errcode = '40001'; end if;

  insert into public.design_versions (design_id, number, document, sha256, preflight)
  values (v_design, (select max(number) from public.design_versions where design_id = v_design) + 1, p_document, p_sha256, p_preflight)
  returning id into v_version;
  update public.order_items set design_version_id = v_version, decorations = p_decorations where id = v_item.id;
  insert into public.order_item_versions (order_item_id, design_version_id, proof_round, surcharge)
  values (v_item.id, v_version, (p_state->>'proofRound')::int, greatest(p_surcharge, 0));
  insert into public.status_events (fulfillment_id, order_id, event, from_status, to_status, actor_user_id, actor_role, payload)
  values (v_f, p_order, 'resubmit_design', 'changes_requested', p_state->>'status', p_customer, 'customer',
          jsonb_build_object('design_version', v_version, 'surcharge', greatest(p_surcharge, 0)));
  return v_version;
end $$;
revoke execute on function public.resubmit_design(uuid, uuid, jsonb, text, jsonb, jsonb, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.resubmit_design(uuid, uuid, jsonb, text, jsonb, jsonb, bigint, jsonb) to service_role;

-- Fonctions de contrôle (security definer : évitent que les règles d'accès se bloquent en chaîne).
create function app.is_order_customer(p_order uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.orders o where o.id = p_order and o.customer_id = auth.uid())
$$;
create function app.vendor_can_read_version(p_version uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.order_item_versions v join public.order_items i on i.id = v.order_item_id
                 where v.design_version_id = p_version and app.vendor_has_order(i.order_id))
$$;
grant execute on function app.is_order_customer(uuid), app.vendor_can_read_version(uuid) to authenticated;

-- Lecture de l'historique : client propriétaire, équipe SAWWA, atelier affecté.
alter table public.order_item_versions enable row level security;
create policy order_item_versions_read on public.order_item_versions for select to authenticated
  using (exists (select 1 from public.order_items i where i.id = order_item_id
                 and (app.is_order_customer(i.order_id) or app.vendor_has_order(i.order_id)))
         or app.has_platform_role('{ops,support,finance}'));

-- L'atelier affecté peut aussi lire les versions précédentes de la commande (comparaison des BAT).
drop policy versions_read on public.design_versions;
create policy versions_read on public.design_versions for select to authenticated
  using (exists (select 1 from public.designs d where d.id = design_id and d.owner_id = auth.uid())
         or app.has_platform_role('{ops,support}')
         or app.vendor_can_read_version(id));
