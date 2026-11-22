-- SAWWA — migration 2 : cohérence du catalogue, offres réservées aux ateliers actifs, activation des règles de prix.

-- ── Publication d'un produit : variantes, vues et zones obligatoires (miroir de publishBlockers()) ──
create function app.check_product_publishable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    if not exists (select 1 from public.base_product_variants v where v.base_product_id = new.id)
       or not exists (select 1 from public.product_views w where w.base_product_id = new.id)
       or not exists (select 1 from public.zones z where z.base_product_id = new.id)
       or exists (select 1 from public.zones z where z.base_product_id = new.id and cardinality(z.allowed_techniques) = 0)
    then
      raise exception 'product % is not complete: variants, views and zones with techniques are required', new.slug
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
create trigger product_publishable before insert or update of status on public.base_products
  for each row execute function app.check_product_publishable();

-- Une zone appartient à une vue du même produit.
create function app.check_zone_view() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.product_views v where v.id = new.view_id and v.base_product_id = new.base_product_id) then
    raise exception 'zone view belongs to another product' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger zone_view before insert or update on public.zones
  for each row execute function app.check_zone_view();

-- ── Offres : seul un atelier ACTIF (ou l'équipe ateliers) peut écrire ──
create function app.can_manage_vendor(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.has_platform_role('{vendor_manager}')
      or (app.is_org_manager(org)
          and exists (select 1 from public.organizations o where o.id = org and o.kind = 'vendor' and o.status = 'active'))
$$;
grant execute on function app.can_manage_vendor(uuid) to authenticated;

drop policy offers_write on public.vendor_offers;
create policy offers_write on public.vendor_offers for all to authenticated
  using (app.can_manage_vendor(vendor_id)) with check (app.can_manage_vendor(vendor_id));

drop policy offer_variants_write on public.vendor_offer_variants;
create policy offer_variants_write on public.vendor_offer_variants for all to authenticated
  using (exists (select 1 from public.vendor_offers o where o.id = offer_id and app.can_manage_vendor(o.vendor_id)))
  with check (exists (select 1 from public.vendor_offers o where o.id = offer_id and app.can_manage_vendor(o.vendor_id)));

drop policy capabilities_write on public.vendor_zone_capabilities;
create policy capabilities_write on public.vendor_zone_capabilities for all to authenticated
  using (exists (select 1 from public.vendor_offers o where o.id = offer_id and app.can_manage_vendor(o.vendor_id)))
  with check (exists (select 1 from public.vendor_offers o where o.id = offer_id and app.can_manage_vendor(o.vendor_id)));

drop policy grids_insert on public.vendor_price_grids;
create policy grids_insert on public.vendor_price_grids for insert to authenticated
  with check (exists (select 1 from public.vendor_offers o where o.id = offer_id and app.can_manage_vendor(o.vendor_id)));

-- Les ateliers actifs lisent aussi les produits publiés pour composer leurs offres (déjà public), rien de plus.

-- Variante et zone d'une offre = celles du produit de l'offre ; capacité ≤ zone de référence.
create function app.check_offer_variant() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.vendor_offers o join public.base_product_variants v on v.base_product_id = o.base_product_id
    where o.id = new.offer_id and v.id = new.variant_id
  ) then
    raise exception 'variant does not belong to the offer product' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger offer_variant_product before insert or update on public.vendor_offer_variants
  for each row execute function app.check_offer_variant();

create function app.check_capability() returns trigger
language plpgsql set search_path = '' as $$
declare z public.zones;
begin
  select zz.* into z from public.zones zz join public.vendor_offers o on o.base_product_id = zz.base_product_id
  where zz.id = new.zone_id and o.id = new.offer_id;
  if not found then raise exception 'zone does not belong to the offer product' using errcode = 'check_violation'; end if;
  if new.technique <> all (z.allowed_techniques) then
    raise exception 'technique % not allowed on zone %', new.technique, z.key using errcode = 'check_violation';
  end if;
  if new.max_width_mm > z.max_width_mm or new.max_height_mm > z.max_height_mm then
    raise exception 'capability larger than zone % (% x % mm)', z.key, z.max_width_mm, z.max_height_mm
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger capability_within_zone before insert or update on public.vendor_zone_capabilities
  for each row execute function app.check_capability();

-- ── Règles de prix : une seule version active, activation tracée ──
create function public.activate_price_rule_set(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.price_rule_sets;
begin
  if not app.has_platform_role('{finance}') then
    raise exception 'finance role required' using errcode = '42501';
  end if;
  select * into r from public.price_rule_sets where id = p_id for update;
  if not found then raise exception 'rule set not found'; end if;
  if r.status <> 'draft' then raise exception 'only a draft can be activated'; end if;
  update public.price_rule_sets set status = 'retired' where status = 'active' and currency = r.currency;
  update public.price_rule_sets set status = 'active', activated_at = now(), activated_by = auth.uid() where id = p_id;
  insert into public.audit_log (actor_user_id, action, entity_type, entity_id, after)
  values (auth.uid(), 'price_rules.activate', 'price_rule_set', p_id::text, jsonb_build_object('version', r.version, 'rules', r.rules));
end $$;
revoke execute on function public.activate_price_rule_set(uuid) from public, anon;
grant execute on function public.activate_price_rule_set(uuid) to authenticated;

-- Une version activée ou retirée ne se modifie plus (seul le statut change, via la fonction ci-dessus).
create function app.freeze_rule_set() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status <> 'draft' and (new.rules is distinct from old.rules or new.version <> old.version) then
    raise exception 'an activated rule set is immutable; create a new version' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger rule_set_frozen before update on public.price_rule_sets
  for each row execute function app.freeze_rule_set();
