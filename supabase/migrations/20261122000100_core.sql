-- SAWWA — migration 1 : identité, rôles, catalogue de référence, ateliers, règles de prix, journal d'audit.
-- RLS = deuxième barrière. Les règles métier restent dans packages/ (pricing, workflow).

create extension if not exists pgcrypto;

-- ───────────────────────────── Types ─────────────────────────────
create type public.org_kind as enum ('customer_org', 'vendor', 'platform');
create type public.org_status as enum ('pending', 'active', 'suspended', 'rejected');
create type public.member_role as enum (
  -- organisations clientes et ateliers
  'owner', 'manager', 'operator',
  -- équipe SAWWA (organisation de type platform)
  'super_admin', 'ops', 'catalog', 'vendor_manager', 'support', 'finance'
);
create type public.publish_status as enum ('draft', 'active', 'archived');
create type public.technique_key as enum ('dtg', 'dtf', 'embroidery', 'screen_print', 'sublimation', 'uv', 'engraving', 'flock');

-- ───────────────────────────── Identité ─────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  email text,
  locale text not null default 'fr',
  country char(2) not null default 'SN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  kind public.org_kind not null,
  status public.org_status not null default 'pending',
  name text not null check (length(trim(name)) > 0),
  legal_name text,
  country char(2) not null default 'SN',
  ninea text,
  rccm text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Une seule organisation « plateforme » (l'équipe SAWWA).
create unique index organizations_single_platform on public.organizations (kind) where kind = 'platform';

create table public.memberships (
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, organization_id)
);
create index memberships_org on public.memberships (organization_id);

-- Création automatique du profil à l'inscription.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, phone, email) values (new.id, new.phone, new.email)
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────── Fonctions d'autorisation (RLS) ─────────────────────
-- security definer : lisent memberships sans dépendre de ses propres politiques (évite la récursion).
create schema if not exists app;

create function app.has_platform_role(roles public.member_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    join public.organizations o on o.id = m.organization_id
    where m.user_id = auth.uid() and o.kind = 'platform'
      and (m.role = 'super_admin' or m.role = any (roles))
  )
$$;

create function app.is_member(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.organization_id = org)
$$;

create function app.is_org_manager(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.organization_id = org and m.role in ('owner', 'manager')
  )
$$;

grant usage on schema app to anon, authenticated;
grant execute on all functions in schema app to anon, authenticated;

-- Candidature atelier : l'utilisateur connecté crée un atelier « pending » et en devient propriétaire.
create function public.apply_as_vendor(p_name text, p_ninea text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare org_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  insert into public.organizations (kind, status, name, ninea) values ('vendor', 'pending', p_name, p_ninea)
  returning id into org_id;
  insert into public.memberships (user_id, organization_id, role) values (auth.uid(), org_id, 'owner');
  insert into public.vendor_profiles (organization_id) values (org_id);
  return org_id;
end $$;

-- ───────────────────────────── Catalogue de référence ─────────────────────────────
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id),
  slug text not null unique,
  name jsonb not null, -- {"fr": "...", "en": "..."}
  sort int not null default 0,
  status public.publish_status not null default 'active'
);

create table public.techniques (
  key public.technique_key primary key,
  name jsonb not null,
  constraints jsonb not null default '{}' -- couleurs max, épaisseur min (mm), dpi min, formats
);

create table public.base_products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id),
  slug text not null unique,
  name jsonb not null,
  description jsonb not null default '{}',
  attributes jsonb not null default '{}', -- matière, grammage, composition
  size_chart jsonb,
  status public.publish_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.base_product_variants (
  id uuid primary key default gen_random_uuid(),
  base_product_id uuid not null references public.base_products (id) on delete cascade,
  color_key text not null,
  color_hex char(7) not null check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  size text not null,
  unique (base_product_id, color_key, size)
);

create table public.product_views (
  id uuid primary key default gen_random_uuid(),
  base_product_id uuid not null references public.base_products (id) on delete cascade,
  key text not null, -- front, back, left_sleeve…
  mockup_assets jsonb not null default '{}',
  sort int not null default 0,
  unique (base_product_id, key)
);

create table public.zones (
  id uuid primary key default gen_random_uuid(),
  base_product_id uuid not null references public.base_products (id) on delete cascade,
  view_id uuid not null references public.product_views (id) on delete cascade,
  key text not null, -- front_center, chest_left…
  max_width_mm int not null check (max_width_mm > 0),
  max_height_mm int not null check (max_height_mm > 0),
  anchor jsonb not null default '{}', -- repère physique + décalage (ex. 70 mm sous le col)
  allowed_techniques public.technique_key[] not null default '{}',
  unique (base_product_id, key)
);

-- ───────────────────────────── Ateliers et offres ─────────────────────────────
create table public.vendor_profiles (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  address text,
  city text,
  latitude double precision,
  longitude double precision,
  equipment jsonb not null default '[]',
  capacity_per_day int check (capacity_per_day is null or capacity_per_day > 0),
  lead_time_days int check (lead_time_days is null or lead_time_days > 0),
  payout_method text, -- wave, orange_money, bank_transfer (détails dans le coffre du prestataire, pas ici)
  quality_score numeric(4, 2),
  updated_at timestamptz not null default now()
);

create table public.vendor_offers (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.organizations (id) on delete cascade,
  base_product_id uuid not null references public.base_products (id),
  status public.publish_status not null default 'draft',
  min_qty int not null default 1 check (min_qty > 0),
  lead_time_days int not null default 5 check (lead_time_days > 0),
  stock_mode text not null default 'made_to_order' check (stock_mode in ('made_to_order', 'stock')),
  created_at timestamptz not null default now(),
  unique (vendor_id, base_product_id)
);

create table public.vendor_offer_variants (
  offer_id uuid not null references public.vendor_offers (id) on delete cascade,
  variant_id uuid not null references public.base_product_variants (id),
  available boolean not null default true,
  stock_qty int check (stock_qty is null or stock_qty >= 0),
  primary key (offer_id, variant_id)
);

create table public.vendor_zone_capabilities (
  offer_id uuid not null references public.vendor_offers (id) on delete cascade,
  zone_id uuid not null references public.zones (id),
  technique public.technique_key not null,
  max_width_mm int not null check (max_width_mm > 0),
  max_height_mm int not null check (max_height_mm > 0),
  max_colors int,
  primary key (offer_id, zone_id, technique)
);

-- Grille de prix versionnée (schéma VendorPriceGrid de packages/pricing, validé par l'application).
-- Immuable : on crée une nouvelle version au lieu de modifier.
create table public.vendor_price_grids (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.vendor_offers (id) on delete cascade,
  version int not null check (version > 0),
  currency char(3) not null default 'XOF',
  grid jsonb not null,
  valid_from timestamptz not null default now(),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (offer_id, version)
);

-- ───────────────────────────── Règles SAWWA ─────────────────────────────
create table public.price_rule_sets (
  id uuid primary key default gen_random_uuid(),
  version int not null unique check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  currency char(3) not null default 'XOF',
  rules jsonb not null, -- schéma PlatformRuleSet de packages/pricing
  activated_at timestamptz,
  activated_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create unique index price_rule_sets_one_active on public.price_rule_sets (currency) where status = 'active';

-- ───────────────────────────── Journal d'audit ─────────────────────────────
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);

create function app.forbid_change() returns trigger language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end $$;
create trigger audit_log_append_only before update or delete on public.audit_log
  for each row execute function app.forbid_change();
create trigger price_grids_immutable before update on public.vendor_price_grids
  for each row execute function app.forbid_change();

-- ───────────────────────────── updated_at ─────────────────────────────
create function app.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger touch before update on public.profiles for each row execute function app.touch_updated_at();
create trigger touch before update on public.organizations for each row execute function app.touch_updated_at();
create trigger touch before update on public.base_products for each row execute function app.touch_updated_at();
create trigger touch before update on public.vendor_profiles for each row execute function app.touch_updated_at();

-- ───────────────────────────── RLS ─────────────────────────────
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.categories enable row level security;
alter table public.techniques enable row level security;
alter table public.base_products enable row level security;
alter table public.base_product_variants enable row level security;
alter table public.product_views enable row level security;
alter table public.zones enable row level security;
alter table public.vendor_profiles enable row level security;
alter table public.vendor_offers enable row level security;
alter table public.vendor_offer_variants enable row level security;
alter table public.vendor_zone_capabilities enable row level security;
alter table public.vendor_price_grids enable row level security;
alter table public.price_rule_sets enable row level security;
alter table public.audit_log enable row level security;

-- Profils : chacun le sien ; support et ops lisent.
create policy profiles_self_read on public.profiles for select to authenticated
  using (id = auth.uid() or app.has_platform_role('{support,ops,vendor_manager}'));
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Organisations : membres et équipe SAWWA. Statut modifiable seulement par vendor_manager.
create policy orgs_read on public.organizations for select to authenticated
  using (app.is_member(id) or app.has_platform_role('{ops,vendor_manager,support,finance}'));
create policy orgs_admin_write on public.organizations for update to authenticated
  using (app.has_platform_role('{vendor_manager}')) with check (app.has_platform_role('{vendor_manager}'));

create policy memberships_read on public.memberships for select to authenticated
  using (user_id = auth.uid() or app.is_org_manager(organization_id) or app.has_platform_role('{ops,vendor_manager,support}'));
create policy memberships_admin_write on public.memberships for all to authenticated
  using (app.has_platform_role('{}')) with check (app.has_platform_role('{}')); -- super_admin seulement

-- Catalogue : lecture publique de ce qui est actif ; écriture par l'équipe catalogue.
create policy categories_public on public.categories for select to anon, authenticated
  using (status = 'active' or app.has_platform_role('{catalog}'));
create policy categories_write on public.categories for all to authenticated
  using (app.has_platform_role('{catalog}')) with check (app.has_platform_role('{catalog}'));

create policy techniques_public on public.techniques for select to anon, authenticated using (true);
create policy techniques_write on public.techniques for all to authenticated
  using (app.has_platform_role('{catalog}')) with check (app.has_platform_role('{catalog}'));

create policy base_products_public on public.base_products for select to anon, authenticated
  using (status = 'active' or app.has_platform_role('{catalog,ops,vendor_manager}'));
create policy base_products_write on public.base_products for all to authenticated
  using (app.has_platform_role('{catalog}')) with check (app.has_platform_role('{catalog}'));

create policy variants_public on public.base_product_variants for select to anon, authenticated
  using (exists (select 1 from public.base_products p where p.id = base_product_id
                 and (p.status = 'active' or app.has_platform_role('{catalog,ops,vendor_manager}'))));
create policy variants_write on public.base_product_variants for all to authenticated
  using (app.has_platform_role('{catalog}')) with check (app.has_platform_role('{catalog}'));

create policy views_public on public.product_views for select to anon, authenticated
  using (exists (select 1 from public.base_products p where p.id = base_product_id
                 and (p.status = 'active' or app.has_platform_role('{catalog,ops,vendor_manager}'))));
create policy views_write on public.product_views for all to authenticated
  using (app.has_platform_role('{catalog}')) with check (app.has_platform_role('{catalog}'));

create policy zones_public on public.zones for select to anon, authenticated
  using (exists (select 1 from public.base_products p where p.id = base_product_id
                 and (p.status = 'active' or app.has_platform_role('{catalog,ops,vendor_manager}'))));
create policy zones_write on public.zones for all to authenticated
  using (app.has_platform_role('{catalog}')) with check (app.has_platform_role('{catalog}'));

-- Ateliers : chaque atelier voit et gère uniquement ses propres données.
create policy vendor_profiles_own on public.vendor_profiles for select to authenticated
  using (app.is_member(organization_id) or app.has_platform_role('{ops,vendor_manager}'));
create policy vendor_profiles_edit on public.vendor_profiles for update to authenticated
  using (app.is_org_manager(organization_id) or app.has_platform_role('{vendor_manager}'))
  with check (app.is_org_manager(organization_id) or app.has_platform_role('{vendor_manager}'));

create policy offers_read on public.vendor_offers for select to authenticated
  using (app.is_member(vendor_id) or app.has_platform_role('{ops,vendor_manager,catalog}'));
create policy offers_write on public.vendor_offers for all to authenticated
  using (app.is_org_manager(vendor_id) or app.has_platform_role('{vendor_manager}'))
  with check (app.is_org_manager(vendor_id) or app.has_platform_role('{vendor_manager}'));

create policy offer_variants_read on public.vendor_offer_variants for select to authenticated
  using (exists (select 1 from public.vendor_offers o where o.id = offer_id
                 and (app.is_member(o.vendor_id) or app.has_platform_role('{ops,vendor_manager,catalog}'))));
create policy offer_variants_write on public.vendor_offer_variants for all to authenticated
  using (exists (select 1 from public.vendor_offers o where o.id = offer_id
                 and (app.is_org_manager(o.vendor_id) or app.has_platform_role('{vendor_manager}'))))
  with check (exists (select 1 from public.vendor_offers o where o.id = offer_id
                 and (app.is_org_manager(o.vendor_id) or app.has_platform_role('{vendor_manager}'))));

create policy capabilities_read on public.vendor_zone_capabilities for select to authenticated
  using (exists (select 1 from public.vendor_offers o where o.id = offer_id
                 and (app.is_member(o.vendor_id) or app.has_platform_role('{ops,vendor_manager,catalog}'))));
create policy capabilities_write on public.vendor_zone_capabilities for all to authenticated
  using (exists (select 1 from public.vendor_offers o where o.id = offer_id
                 and (app.is_org_manager(o.vendor_id) or app.has_platform_role('{vendor_manager}'))))
  with check (exists (select 1 from public.vendor_offers o where o.id = offer_id
                 and (app.is_org_manager(o.vendor_id) or app.has_platform_role('{vendor_manager}'))));

create policy grids_read on public.vendor_price_grids for select to authenticated
  using (exists (select 1 from public.vendor_offers o where o.id = offer_id
                 and (app.is_member(o.vendor_id) or app.has_platform_role('{ops,vendor_manager,finance}'))));
create policy grids_insert on public.vendor_price_grids for insert to authenticated
  with check (exists (select 1 from public.vendor_offers o where o.id = offer_id
                 and (app.is_org_manager(o.vendor_id) or app.has_platform_role('{vendor_manager}'))));

-- Règles SAWWA : finance les gère, ops les lit.
create policy rules_read on public.price_rule_sets for select to authenticated
  using (app.has_platform_role('{finance,ops,catalog}'));
create policy rules_write on public.price_rule_sets for all to authenticated
  using (app.has_platform_role('{finance}')) with check (app.has_platform_role('{finance}'));

-- Audit : écrit par le serveur (service_role, qui contourne la RLS), lu par super_admin.
create policy audit_read on public.audit_log for select to authenticated using (app.has_platform_role('{}'));

-- Les fonctions sensibles ne sont pas appelables par anon.
revoke execute on function public.apply_as_vendor(text, text) from public, anon;
grant execute on function public.apply_as_vendor(text, text) to authenticated;
