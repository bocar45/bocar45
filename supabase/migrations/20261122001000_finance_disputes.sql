-- SAWWA — migration 10 : administration avancée (E20).
-- Grand livre des ateliers (écriture seule), versements, litiges et reprises.

-- ── Grand livre : le solde d'un atelier est la somme de ses écritures (XOF, entiers signés) ──
create table public.vendor_ledger (
  id bigint generated always as identity primary key,
  vendor_id uuid not null references public.organizations (id),
  fulfillment_id uuid references public.fulfillments (id),
  type text not null check (type in ('earning', 'penalty', 'adjustment', 'payout')),
  amount bigint not null,
  currency char(3) not null default 'XOF',
  note text not null default '' check (char_length(note) <= 500),
  created_by uuid references auth.users (id),
  at timestamptz not null default now(),
  check ((type = 'earning' and amount > 0) or (type in ('penalty', 'payout') and amount < 0) or (type = 'adjustment' and amount <> 0))
);
create index vendor_ledger_vendor on public.vendor_ledger (vendor_id, at);
create unique index vendor_ledger_one_earning on public.vendor_ledger (fulfillment_id) where type = 'earning';
create trigger ledger_append_only before update or delete on public.vendor_ledger for each row execute function app.forbid_change();

-- Gain inscrit à la livraison, au coût atelier figé à l'affectation (effet `credit_vendor_ledger` de packages/workflow).
create function app.credit_vendor_on_delivery() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered' and new.vendor_id is not null and coalesce(new.vendor_cost, 0) > 0 then
    insert into public.vendor_ledger (vendor_id, fulfillment_id, type, amount, note)
    values (new.vendor_id, new.id, 'earning', new.vendor_cost, 'Commande livrée')
    on conflict do nothing;
  end if;
  return new;
end $$;
create trigger credit_on_delivery after update on public.fulfillments for each row execute function app.credit_vendor_on_delivery();

-- ── Versements aux ateliers ──
create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.organizations (id),
  amount bigint not null check (amount > 0),
  currency char(3) not null default 'XOF',
  method text not null check (method in ('wave', 'orange_money', 'virement', 'especes')),
  reference text not null check (char_length(reference) between 3 and 120),
  created_by uuid not null references auth.users (id),
  at timestamptz not null default now()
);
create trigger payouts_append_only before update or delete on public.payouts for each row execute function app.forbid_change();

-- Versement atomique (serveur) : jamais plus que le solde ; écrit le versement et l'écriture négative ensemble.
create function public.record_payout(p_vendor uuid, p_amount bigint, p_method text, p_reference text, p_actor uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_balance bigint; v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('payout:' || p_vendor::text)); -- deux versements simultanés ne dépassent pas le solde
  select coalesce(sum(amount), 0) into v_balance from public.vendor_ledger where vendor_id = p_vendor;
  if p_amount <= 0 or p_amount > v_balance then raise exception 'amount exceeds balance' using errcode = 'check_violation'; end if;
  insert into public.payouts (vendor_id, amount, method, reference, created_by) values (p_vendor, p_amount, p_method, p_reference, p_actor) returning id into v_id;
  insert into public.vendor_ledger (vendor_id, type, amount, note, created_by) values (p_vendor, 'payout', -p_amount, p_method || ' · ' || p_reference, p_actor);
  return v_id;
end $$;
revoke execute on function public.record_payout(uuid, bigint, text, text, uuid) from public, anon, authenticated;
grant execute on function public.record_payout(uuid, bigint, text, text, uuid) to service_role;

-- ── Litiges et reprises ──
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id),
  opened_by uuid not null references auth.users (id) default auth.uid(),
  reason text not null check (reason in ('defect', 'wrong_item', 'not_received', 'late', 'other')),
  description text not null check (char_length(description) between 5 and 2000),
  photos text[] not null default '{}',
  status text not null default 'open' check (status in ('open', 'resolved', 'rejected')),
  resolution text check (resolution in ('reprint', 'partial_refund', 'full_refund', 'none')),
  refund_amount bigint check (refund_amount >= 0),
  vendor_liable boolean not null default false,
  penalty_amount bigint check (penalty_amount >= 0),
  resolution_note text not null default '' check (char_length(resolution_note) <= 2000),
  resolved_by uuid references auth.users (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index disputes_status on public.disputes (status, created_at);

-- Le client ouvre un litige sur sa commande expédiée ou livrée, avec des photos de son dossier.
create function app.check_dispute() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.orders o where o.id = new.order_id and o.customer_id = new.opened_by) then
    raise exception 'not your order' using errcode = '42501';
  end if;
  if not exists (select 1 from public.fulfillments f where f.order_id = new.order_id and f.status in ('shipped', 'delivered')) then
    raise exception 'order not shipped yet' using errcode = 'check_violation';
  end if;
  if exists (select 1 from unnest(new.photos) p where split_part(p, '/', 1) <> new.opened_by::text or p like '%..%') then
    raise exception 'photos must be in the customer folder' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger check_dispute before insert on public.disputes for each row execute function app.check_dispute();

-- Décision (serveur) : une seule fois ; pénalité éventuelle inscrite au grand livre de l'atelier, dans la même transaction.
create function public.resolve_dispute(p_dispute uuid, p_status text, p_resolution text, p_refund bigint, p_vendor_liable boolean, p_penalty bigint, p_note text, p_actor uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_order uuid; v_vendor uuid; v_fulfillment uuid; v_total bigint;
begin
  select order_id into v_order from public.disputes where id = p_dispute and status = 'open' for update;
  if not found then raise exception 'dispute not open' using errcode = 'check_violation'; end if;
  select total into v_total from public.orders where id = v_order;
  if coalesce(p_refund, 0) > v_total then raise exception 'refund exceeds order total' using errcode = 'check_violation'; end if;
  update public.disputes set status = p_status, resolution = p_resolution, refund_amount = p_refund, vendor_liable = p_vendor_liable,
    penalty_amount = p_penalty, resolution_note = p_note, resolved_by = p_actor, resolved_at = now()
  where id = p_dispute;
  if p_vendor_liable and coalesce(p_penalty, 0) > 0 then
    select id, vendor_id into v_fulfillment, v_vendor from public.fulfillments where order_id = v_order and vendor_id is not null limit 1;
    if v_vendor is null then raise exception 'no workshop on this order' using errcode = 'check_violation'; end if;
    insert into public.vendor_ledger (vendor_id, fulfillment_id, type, amount, note, created_by)
    values (v_vendor, v_fulfillment, 'penalty', -p_penalty, 'Litige : ' || left(p_note, 200), p_actor);
  end if;
end $$;
revoke execute on function public.resolve_dispute(uuid, text, text, bigint, boolean, bigint, text, uuid) from public, anon, authenticated;
grant execute on function public.resolve_dispute(uuid, text, text, bigint, boolean, bigint, text, uuid) to service_role;

alter table public.vendor_ledger enable row level security;
alter table public.payouts enable row level security;
alter table public.disputes enable row level security;

-- Atelier : lit son grand livre et ses versements. Finance et ops : tout. Écriture : fonctions serveur uniquement
-- (sauf ajustement manuel par la finance, tracé).
create policy ledger_read on public.vendor_ledger for select to authenticated
  using (app.is_member(vendor_id) or app.has_platform_role('{finance,ops}'));
create policy ledger_adjust on public.vendor_ledger for insert to authenticated
  with check (type = 'adjustment' and created_by = auth.uid() and app.has_platform_role('{finance}'));
create policy payouts_read on public.payouts for select to authenticated
  using (app.is_member(vendor_id) or app.has_platform_role('{finance,ops}'));
-- Litiges : le client ouvre et lit les siens ; l'équipe lit tout ; l'atelier affecté lit ceux de ses commandes.
create policy disputes_insert on public.disputes for insert to authenticated
  with check (opened_by = auth.uid() and status = 'open' and resolution is null and resolved_by is null and vendor_liable = false and penalty_amount is null and refund_amount is null);
create policy disputes_read on public.disputes for select to authenticated
  using (opened_by = auth.uid() or app.vendor_has_order(order_id) or app.has_platform_role('{ops,support,finance}'));
