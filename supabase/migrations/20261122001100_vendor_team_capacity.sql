-- SAWWA — migration 11 : espace atelier avancé (E21).
-- Fermetures de l'atelier (prises en compte à l'affectation) et équipe : propriétaire, gérant, opérateur.

-- ── Fermetures (congés, Tabaski, panne…) ──
create table public.vendor_closures (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.organizations (id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  reason text not null default '' check (char_length(reason) <= 200),
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 366)
);
create index vendor_closures_vendor on public.vendor_closures (vendor_id, ends_on);
alter table public.vendor_closures enable row level security;
create policy closures_read on public.vendor_closures for select to authenticated
  using (app.is_member(vendor_id) or app.has_platform_role('{ops,vendor_manager}'));
create policy closures_write on public.vendor_closures for all to authenticated
  using (app.is_org_manager(vendor_id) or app.has_platform_role('{vendor_manager}'))
  with check (app.is_org_manager(vendor_id) or app.has_platform_role('{vendor_manager}'));

-- ── Équipe : invitations par numéro de téléphone (la connexion se fait par SMS) ──
create table public.vendor_invitations (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.organizations (id) on delete cascade,
  phone text not null check (phone ~ '^\+221[0-9]{9}$'),
  role public.member_role not null check (role in ('manager', 'operator')),
  invited_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references auth.users (id),
  accepted_at timestamptz,
  revoked_at timestamptz
);
create index vendor_invitations_phone on public.vendor_invitations (phone) where accepted_at is null and revoked_at is null;
alter table public.vendor_invitations enable row level security;
create policy invitations_read on public.vendor_invitations for select to authenticated
  using (app.is_org_manager(vendor_id) or app.has_platform_role('{vendor_manager}'));

create function app.vendor_role(p_vendor uuid) returns public.member_role
language sql stable security definer set search_path = '' as $$
  select m.role from public.memberships m where m.user_id = auth.uid() and m.organization_id = p_vendor
$$;
grant execute on function app.vendor_role(uuid) to authenticated;

-- Le propriétaire invite gérants et opérateurs ; un gérant invite des opérateurs. Atelier actif seulement.
create function public.invite_vendor_member(p_vendor uuid, p_phone text, p_role public.member_role) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_role public.member_role := app.vendor_role(p_vendor); v_id uuid;
begin
  if v_role is null or v_role = 'operator' or (v_role = 'manager' and p_role <> 'operator') then
    raise exception 'not allowed to invite this role' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations o where o.id = p_vendor and o.kind = 'vendor' and o.status = 'active') then
    raise exception 'workshop not active' using errcode = '42501';
  end if;
  update public.vendor_invitations set revoked_at = now() where vendor_id = p_vendor and phone = p_phone and accepted_at is null and revoked_at is null;
  insert into public.vendor_invitations (vendor_id, phone, role, invited_by) values (p_vendor, p_phone, p_role, auth.uid()) returning id into v_id;
  return v_id;
end $$;

-- Invitations en attente pour le numéro de la personne connectée.
create function public.my_vendor_invitations() returns table (id uuid, vendor_id uuid, vendor_name text, role public.member_role, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select i.id, i.vendor_id, o.name, i.role, i.expires_at
  from public.vendor_invitations i join public.organizations o on o.id = i.vendor_id
  join auth.users u on u.id = auth.uid()
  where '+' || ltrim(u.phone, '+') = i.phone and i.accepted_at is null and i.revoked_at is null and i.expires_at > now() and o.status = 'active'
$$;

create function public.accept_vendor_invitation(p_invitation uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v public.vendor_invitations;
begin
  select i.* into v from public.vendor_invitations i join auth.users u on u.id = auth.uid()
  where i.id = p_invitation and '+' || ltrim(u.phone, '+') = i.phone and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
  for update of i;
  if not found then raise exception 'invitation not found or expired' using errcode = '42501'; end if;
  if exists (select 1 from public.memberships m join public.organizations o on o.id = m.organization_id where m.user_id = auth.uid() and o.kind = 'vendor') then
    raise exception 'already member of a workshop' using errcode = 'check_violation'; -- un compte = un atelier
  end if;
  insert into public.memberships (user_id, organization_id, role) values (auth.uid(), v.vendor_id, v.role);
  update public.vendor_invitations set accepted_by = auth.uid(), accepted_at = now() where id = v.id;
  return v.vendor_id;
end $$;

-- Membres de l'équipe (pour le propriétaire et les gérants) : rôle et numéro.
create function public.vendor_team(p_vendor uuid) returns table (user_id uuid, role public.member_role, phone text, since timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.is_org_manager(p_vendor) and not app.has_platform_role('{vendor_manager,ops}') then raise exception 'not allowed' using errcode = '42501'; end if;
  return query select m.user_id, m.role, p.phone, m.created_at from public.memberships m left join public.profiles p on p.id = m.user_id
    where m.organization_id = p_vendor order by m.created_at;
end $$;

-- Le propriétaire change un rôle ou retire un membre ; il reste toujours au moins un propriétaire.
create function public.set_vendor_member(p_vendor uuid, p_user uuid, p_role public.member_role) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if app.vendor_role(p_vendor) is distinct from 'owner' then raise exception 'owner only' using errcode = '42501'; end if;
  if p_role is not null and p_role not in ('owner', 'manager', 'operator') then raise exception 'bad role' using errcode = 'check_violation'; end if;
  if p_role is null then delete from public.memberships where organization_id = p_vendor and user_id = p_user;
  else update public.memberships set role = p_role where organization_id = p_vendor and user_id = p_user; end if;
  if not exists (select 1 from public.memberships where organization_id = p_vendor and role = 'owner') then
    raise exception 'a workshop keeps at least one owner' using errcode = 'check_violation';
  end if;
end $$;

revoke execute on function public.invite_vendor_member(uuid, text, public.member_role), public.my_vendor_invitations(), public.accept_vendor_invitation(uuid),
  public.vendor_team(uuid), public.set_vendor_member(uuid, uuid, public.member_role) from public, anon;
grant execute on function public.invite_vendor_member(uuid, text, public.member_role), public.my_vendor_invitations(), public.accept_vendor_invitation(uuid),
  public.vendor_team(uuid), public.set_vendor_member(uuid, uuid, public.member_role) to authenticated;

-- L'argent de l'atelier (grand livre, versements) : propriétaire et gérants seulement, pas les opérateurs.
drop policy ledger_read on public.vendor_ledger;
create policy ledger_read on public.vendor_ledger for select to authenticated
  using (app.is_org_manager(vendor_id) or app.has_platform_role('{finance,ops}'));
drop policy payouts_read on public.payouts;
create policy payouts_read on public.payouts for select to authenticated
  using (app.is_org_manager(vendor_id) or app.has_platform_role('{finance,ops}'));
