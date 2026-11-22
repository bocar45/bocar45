-- SAWWA — migration 9 : modération des images importées (E18d).
-- 1) Le client déclare détenir les droits sur les images qu'il importe (date enregistrée sur la création).
-- 2) Signalements (atelier, client, visiteur connecté) traités par l'équipe dans une file de modération.

alter table public.designs add column rights_declared_at timestamptz;

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('order', 'template')),
  target_id uuid not null,
  reporter_id uuid not null references auth.users (id) default auth.uid(),
  reporter_role text not null default 'customer' check (reporter_role in ('customer', 'vendor', 'staff')),
  reason text not null check (reason in ('trademark', 'protected_character', 'someone_else_photo', 'prohibited_content', 'other')),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'upheld', 'dismissed')),
  resolution_note text not null default '' check (char_length(resolution_note) <= 1000),
  resolved_by uuid references auth.users (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index content_reports_open on public.content_reports (status, created_at);

-- Un signalement vise un contenu que l'auteur peut voir : un modèle publié, ou une commande dont il est le client
-- ou l'atelier affecté. Le rôle déclaré doit correspondre.
create function app.check_content_report() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.target_type = 'template' then
    if not exists (select 1 from public.templates t where t.id = new.target_id and t.status = 'published') then
      raise exception 'unknown template' using errcode = 'check_violation';
    end if;
  elsif new.reporter_role = 'vendor' then
    if not app.vendor_has_order(new.target_id) then raise exception 'not your order' using errcode = '42501'; end if;
  elsif new.reporter_role = 'customer' then
    if not exists (select 1 from public.orders o where o.id = new.target_id and o.customer_id = new.reporter_id) then
      raise exception 'not your order' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger check_report before insert on public.content_reports for each row execute function app.check_content_report();

alter table public.content_reports enable row level security;
create policy reports_insert on public.content_reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open' and resolution_note = '' and resolved_by is null
    and (reporter_role <> 'staff' or app.has_platform_role('{ops,support}')));
create policy reports_read on public.content_reports for select to authenticated
  using (reporter_id = auth.uid() or app.has_platform_role('{ops,support}'));
-- Une décision ne porte que sur le statut et sa justification, une seule fois (depuis « open »).
create function app.guard_report_resolution() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status <> 'open' then raise exception 'report already resolved' using errcode = 'check_violation'; end if;
  if (new.target_type, new.target_id, new.reporter_id, new.reporter_role, new.reason, new.details, new.created_at)
     is distinct from (old.target_type, old.target_id, old.reporter_id, old.reporter_role, old.reason, old.details, old.created_at) then
    raise exception 'only the decision can change' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger guard_resolution before update on public.content_reports for each row execute function app.guard_report_resolution();
create policy reports_resolve on public.content_reports for update to authenticated
  using (app.has_platform_role('{ops,support}')) with check (app.has_platform_role('{ops,support}'));
