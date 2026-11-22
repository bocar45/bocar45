-- SAWWA — migration 7 : commandes d'équipe, noms et numéros (E16).
-- La liste des pièces (taille, nom, numéro) est figée avec la ligne de commande, comme la version de la création
-- et le devis : l'atelier produit exactement cette liste. Contrôlée par @sawwa/design (checkRoster) avant l'appel.

alter table public.order_items add column roster jsonb;
alter table public.order_items add constraint order_items_roster_shape check (
  roster is null or (jsonb_typeof(roster) = 'array' and jsonb_array_length(roster) = quantity)
);
-- Une liste n'est jamais modifiée après la commande.
create function app.freeze_roster() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.roster is distinct from old.roster then raise exception 'roster is frozen' using errcode = 'check_violation'; end if;
  return new;
end $$;
create trigger freeze_roster before update on public.order_items for each row execute function app.freeze_roster();

-- Reprend la version de la migration 4 (historique des versions) et ajoute la liste.
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
    insert into public.order_items (order_id, design_version_id, base_product_id, color_key, sizes, quantity, unit_price, line_total, decorations, roster)
    values (v_order, v_version, v_product, item->>'color_key', item->'sizes', (item->>'quantity')::int,
            (item->>'unit_price')::bigint, (item->>'line_total')::bigint, item->'decorations', nullif(item->'roster', 'null'::jsonb))
    returning id into v_item;
    insert into public.order_item_versions (order_item_id, design_version_id, proof_round, quote) values (v_item, v_version, 0, p_quote);
  end loop;

  insert into public.fulfillments (order_id) values (v_order) returning id into v_fulfillment;
  insert into public.status_events (fulfillment_id, order_id, event, to_status, actor_user_id, actor_role, payload)
  values (v_fulfillment, v_order, 'order_placed', 'pending_assignment', p_customer, 'customer', jsonb_build_object('design_version', v_version));
  return query select v_order, v_number;
end $$;
