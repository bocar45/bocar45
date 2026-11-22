-- SAWWA — migration 5 : robustesse (E14).

-- ── Enregistrement d'une offre atelier en une seule transaction ──
-- Appelée avec le client de l'utilisateur (security invoker) : les règles d'accès des ateliers s'appliquent.
-- La grille est construite et validée en TypeScript (packages/pricing) ; une nouvelle version n'est créée que si elle change.
create function public.save_vendor_offer(
  p_vendor uuid, p_product uuid, p_status text, p_min_qty int, p_lead_time int,
  p_variant_ids uuid[], p_capabilities jsonb, p_grid jsonb
) returns table (offer_id uuid, grid_version int, grid_changed boolean)
language plpgsql set search_path = '' as $$
#variable_conflict use_column
declare v_offer uuid; v_latest record; v_version int; v_changed boolean;
begin
  insert into public.vendor_offers (vendor_id, base_product_id, status, min_qty, lead_time_days)
  values (p_vendor, p_product, p_status::public.publish_status, p_min_qty, p_lead_time)
  on conflict (vendor_id, base_product_id) do update
    set status = excluded.status, min_qty = excluded.min_qty, lead_time_days = excluded.lead_time_days
  returning id into v_offer;

  delete from public.vendor_offer_variants where offer_id = v_offer;
  insert into public.vendor_offer_variants (offer_id, variant_id) select v_offer, unnest(p_variant_ids);

  delete from public.vendor_zone_capabilities where offer_id = v_offer;
  insert into public.vendor_zone_capabilities (offer_id, zone_id, technique, max_width_mm, max_height_mm, max_colors)
  select v_offer, (c->>'zone_id')::uuid, (c->>'technique')::public.technique_key, (c->>'max_width_mm')::int, (c->>'max_height_mm')::int, (c->>'max_colors')::int
  from jsonb_array_elements(p_capabilities) c;

  select version, grid into v_latest from public.vendor_price_grids where offer_id = v_offer order by version desc limit 1;
  v_changed := v_latest is null or (v_latest.grid - 'version') is distinct from (p_grid - 'version');
  if v_changed then
    v_version := coalesce(v_latest.version, 0) + 1;
    insert into public.vendor_price_grids (offer_id, version, currency, grid, created_by)
    values (v_offer, v_version, 'XOF', jsonb_set(p_grid, '{version}', to_jsonb(v_version)), auth.uid()); -- jamais fourni par le client
  else
    v_version := v_latest.version;
  end if;
  return query select v_offer, v_version, v_changed;
end $$;
revoke execute on function public.save_vendor_offer(uuid, uuid, text, int, int, uuid[], jsonb, jsonb) from public, anon;
grant execute on function public.save_vendor_offer(uuid, uuid, text, int, int, uuid[], jsonb, jsonb) to authenticated;

-- ── Limitation de débit (fenêtres fixes) ──
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security; -- aucune règle : accessible au serveur seulement

create function public.rate_limit_hit(p_key text, p_limit int, p_window_seconds int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
        v_hits int;
begin
  insert into public.rate_limits (key, window_start, hits) values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;
  if random() < 0.01 then delete from public.rate_limits where window_start < now() - interval '1 day'; end if;
  return v_hits <= p_limit;
end $$;
revoke execute on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

-- ── Fichiers : taille et types imposés par le stockage lui-même ──
update storage.buckets set file_size_limit = 26214400, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'] where id = 'design-assets';
update storage.buckets set file_size_limit = 15728640, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'] where id = 'qc-photos';
