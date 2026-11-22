-- SAWWA — migration 8 : devis B2B (E17).
-- Un client (association, entreprise, club) demande un devis ; l'équipe SAWWA le chiffre avec le moteur de prix
-- (packages/pricing) ; le devis est figé, valable 30 jours, et devient une commande au prix figé.

create sequence public.quote_request_number_seq;

create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('DV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.quote_request_number_seq')::text, 6, '0')),
  customer_id uuid not null references auth.users (id) default auth.uid(),
  organization_name text not null check (char_length(organization_name) between 2 and 120),
  contact_name text not null check (char_length(contact_name) between 2 and 80),
  phone text not null check (phone ~ '^\+221[0-9]{9}$'),
  base_product_id uuid references public.base_products (id),
  quantity int not null check (quantity between 1 and 100000),
  deadline date,
  message text not null default '' check (char_length(message) <= 2000),
  logo_path text check (logo_path is null or logo_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]+$'),
  design_id uuid references public.designs (id),
  status text not null default 'new' check (status in ('new', 'quoted', 'ordered', 'declined', 'cancelled')),
  staff_note text not null default '' check (char_length(staff_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quote_requests_customer on public.quote_requests (customer_id, created_at desc);
create index quote_requests_status on public.quote_requests (status, created_at);
create trigger touch before update on public.quote_requests for each row execute function app.touch_updated_at();

-- Le logo d'une demande est dans le dossier du client ; la création choisie lui appartient.
create function app.check_quote_request() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.logo_path is not null and split_part(new.logo_path, '/', 1) <> new.customer_id::text then
    raise exception 'logo must be in the customer folder' using errcode = 'check_violation';
  end if;
  if new.design_id is not null and not exists (select 1 from public.designs d where d.id = new.design_id and d.owner_id = new.customer_id) then
    raise exception 'design must belong to the customer' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger check_request before insert or update on public.quote_requests for each row execute function app.check_quote_request();

-- Devis chiffré : figé (prix, devis complet), seul son statut évolue.
create table public.b2b_quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.quote_requests (id) on delete cascade,
  version int not null check (version > 0),
  base_product_id uuid not null references public.base_products (id),
  color_key text not null,
  sizes jsonb, -- null = répartition libre par le client
  quantity int not null check (quantity > 0),
  decorations jsonb not null, -- zones, techniques, tailles maximales devisées
  currency char(3) not null default 'XOF',
  unit_price bigint not null check (unit_price >= 0),
  goods_total bigint not null check (goods_total >= 0),
  setup_fee bigint not null default 0 check (setup_fee >= 0),
  tax bigint not null check (tax >= 0),
  deposit_due bigint check (deposit_due >= 0),
  lead_time_days int not null check (lead_time_days > 0),
  snapshot jsonb not null, -- packages/pricing Quote.snapshot + atelier pressenti
  customer_note text not null default '' check (char_length(customer_note) <= 2000),
  valid_until timestamptz not null,
  status text not null default 'sent' check (status in ('sent', 'superseded', 'accepted', 'withdrawn')),
  order_id uuid references public.orders (id),
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (request_id, version)
);
create function app.freeze_b2b_quote() returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.request_id, new.version, new.base_product_id, new.color_key, new.sizes, new.quantity, new.decorations, new.unit_price,
      new.goods_total, new.setup_fee, new.tax, new.deposit_due, new.lead_time_days, new.snapshot, new.valid_until, new.customer_note)
     is distinct from
     (old.request_id, old.version, old.base_product_id, old.color_key, old.sizes, old.quantity, old.decorations, old.unit_price,
      old.goods_total, old.setup_fee, old.tax, old.deposit_due, old.lead_time_days, old.snapshot, old.valid_until, old.customer_note) then
    raise exception 'quote is frozen' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger freeze_quote before update on public.b2b_quotes for each row execute function app.freeze_b2b_quote();
-- Auteur jamais modifié ; le lien vers la commande n'est posé que par le serveur (link_b2b_quote), une seule fois.
create function app.guard_b2b_quote_link() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.created_by is distinct from old.created_by then raise exception 'quote author is frozen' using errcode = 'check_violation'; end if;
  if new.order_id is distinct from old.order_id and (old.order_id is not null or current_user in ('authenticated', 'anon')) then
    raise exception 'quote order link is set by the server only' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger guard_link before update on public.b2b_quotes for each row execute function app.guard_b2b_quote_link();

-- Chiffres internes (coût atelier, marge) : jamais lisibles par le client.
create table public.b2b_quote_internals (
  quote_id uuid primary key references public.b2b_quotes (id) on delete cascade,
  vendor_cost bigint not null check (vendor_cost >= 0),
  margin bigint not null,
  created_at timestamptz not null default now()
);
create trigger internals_append_only before update or delete on public.b2b_quote_internals for each row execute function app.forbid_change();
alter table public.b2b_quote_internals enable row level security;
create policy b2b_internals_read on public.b2b_quote_internals for select to authenticated
  using (app.has_platform_role('{ops,support,finance}'));
create policy b2b_internals_insert on public.b2b_quote_internals for insert to authenticated
  with check (app.has_platform_role('{ops,support}'));
create trigger no_delete before delete on public.b2b_quotes for each row execute function app.forbid_change();

alter table public.quote_requests enable row level security;
alter table public.b2b_quotes enable row level security;

-- Client : crée ses demandes (statut « new » seulement) et les lit ; peut annuler une demande non commandée.
create policy quote_requests_own_read on public.quote_requests for select to authenticated
  using (customer_id = auth.uid() or app.has_platform_role('{ops,support,finance}'));
create policy quote_requests_own_insert on public.quote_requests for insert to authenticated
  with check (customer_id = auth.uid() and status = 'new' and staff_note = '');
create policy quote_requests_staff_write on public.quote_requests for update to authenticated
  using (app.has_platform_role('{ops,support}')) with check (app.has_platform_role('{ops,support}'));

-- Devis : lus par le client de la demande et l'équipe ; écrits par l'équipe (ops, support) ; jamais par un atelier.
create function app.owns_quote_request(p_request uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.quote_requests r where r.id = p_request and r.customer_id = auth.uid())
$$;
grant execute on function app.owns_quote_request(uuid) to authenticated;
create policy b2b_quotes_read on public.b2b_quotes for select to authenticated
  using (app.owns_quote_request(request_id) or app.has_platform_role('{ops,support,finance}'));
create policy b2b_quotes_staff_insert on public.b2b_quotes for insert to authenticated
  with check (app.has_platform_role('{ops,support}') and status = 'sent');
create policy b2b_quotes_staff_update on public.b2b_quotes for update to authenticated
  using (app.has_platform_role('{ops,support}')) with check (app.has_platform_role('{ops,support}'));

-- Le client annule sa demande ; l'acceptation (devis → commande) passe par le serveur (service role).
create function public.cancel_quote_request(p_request uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.quote_requests set status = 'cancelled'
  where id = p_request and customer_id = auth.uid() and status in ('new', 'quoted')
    and not exists (select 1 from public.b2b_quotes q where q.request_id = p_request and q.status = 'accepted'); -- commande en cours
  if not found then raise exception 'request cannot be cancelled' using errcode = '42501'; end if;
  update public.b2b_quotes set status = 'withdrawn' where request_id = p_request and status = 'sent';
end $$;
revoke execute on function public.cancel_quote_request(uuid) from public, anon;
grant execute on function public.cancel_quote_request(uuid) to authenticated;

-- Réservation atomique d'un devis pour une commande (service role) : valable, envoyé, non expiré.
create function public.claim_b2b_quote(p_quote uuid, p_customer uuid) returns setof public.b2b_quotes
language plpgsql security definer set search_path = '' as $$
begin
  return query
  update public.b2b_quotes q set status = 'accepted'
  where q.id = p_quote and q.status = 'sent' and q.valid_until > now()
    and exists (select 1 from public.quote_requests r where r.id = q.request_id and r.customer_id = p_customer and r.status = 'quoted')
  returning q.*;
end $$;
create function public.link_b2b_quote(p_quote uuid, p_order uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.b2b_quotes set order_id = p_order where id = p_quote and status = 'accepted' and order_id is null;
  update public.quote_requests set status = 'ordered' where id = (select request_id from public.b2b_quotes where id = p_quote);
end $$;
create function public.release_b2b_quote(p_quote uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.b2b_quotes set status = 'sent' where id = p_quote and status = 'accepted' and order_id is null;
end $$;
revoke execute on function public.claim_b2b_quote(uuid, uuid), public.link_b2b_quote(uuid, uuid), public.release_b2b_quote(uuid) from public, anon, authenticated;
grant execute on function public.claim_b2b_quote(uuid, uuid), public.link_b2b_quote(uuid, uuid), public.release_b2b_quote(uuid) to service_role;
