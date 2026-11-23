-- SAWWA — migration 13 : boutiques en marque blanche (SAWWA Business, E25 / D30).
-- Une boutique appartient à un atelier (locataire = organisation). Elle n'expose que des produits que l'atelier
-- propose réellement ; les prix restent calculés par packages/pricing à partir des grilles de l'atelier.

create table public.storefronts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.organizations (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40),
  name text not null check (char_length(name) between 2 and 60),
  tagline text not null default '' check (char_length(tagline) <= 140),
  -- couleurs de la marque (fond de l'en-tête, accent des boutons, texte sur l'en-tête)
  theme jsonb not null default '{"primary":"#1F2A44","accent":"#C9923E","onPrimary":"#FFFFFF"}'
    check (theme ?& array['primary', 'accent', 'onPrimary']
      and theme->>'primary' ~ '^#[0-9A-Fa-f]{6}$' and theme->>'accent' ~ '^#[0-9A-Fa-f]{6}$' and theme->>'onPrimary' ~ '^#[0-9A-Fa-f]{6}$'),
  contact_phone text check (contact_phone is null or contact_phone ~ '^\+221[0-9]{9}$'),
  product_ids uuid[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'active', 'suspended')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index storefronts_vendor on public.storefronts (vendor_id);
create trigger touch before update on public.storefronts for each row execute function app.touch_updated_at();

-- Une boutique ne montre que des produits actifs que son atelier propose (offre active).
-- security definer : le contrôle ne dépend pas de ce que l'appelant peut lire (la RLS décide ensuite qui peut écrire).
create function app.check_storefront() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.organizations o where o.id = new.vendor_id and o.kind = 'vendor') then
    raise exception 'a storefront belongs to a workshop' using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from unnest(new.product_ids) p
    where not exists (select 1 from public.vendor_offers vo where vo.vendor_id = new.vendor_id and vo.base_product_id = p and vo.status = 'active')
  ) then
    raise exception 'storefront products must be offered by its workshop' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger check_storefront before insert or update on public.storefronts for each row execute function app.check_storefront();

-- Lisible par un visiteur anonyme (qui ne voit pas la table organizations) : fonction de confiance.
create function app.is_active_vendor(p_vendor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organizations o where o.id = p_vendor and o.kind = 'vendor' and o.status = 'active')
$$;
grant execute on function app.is_active_vendor(uuid) to anon, authenticated;

alter table public.storefronts enable row level security;
-- Lecture publique d'une boutique active d'un atelier actif ; l'atelier et l'équipe SAWWA voient tout.
create policy storefronts_public on public.storefronts for select to anon, authenticated
  using ((status = 'active' and app.is_active_vendor(vendor_id))
    or app.is_org_manager(vendor_id) or app.has_platform_role('{vendor_manager,ops}'));
create policy storefronts_write on public.storefronts for all to authenticated
  using (app.can_manage_vendor(vendor_id)) with check (app.can_manage_vendor(vendor_id) and (is_demo = false or app.has_platform_role('{vendor_manager}')));
