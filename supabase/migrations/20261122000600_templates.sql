-- SAWWA — migration 6 : modèles prêts à personnaliser (E15).
-- Un modèle est un document de création (même format que `designs`) dont certains éléments sont marqués
-- « photo du client » ou « texte du client » (`field`) et d'autres verrouillés. Créés par l'équipe catalogue.

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 80),
  title text not null check (char_length(title) between 2 and 80),
  description text not null default '' check (char_length(description) <= 300),
  base_product_id uuid not null references public.base_products (id),
  occasion text not null check (occasion in ('mariage','bapteme','anniversaire','tabaski','korite','magal','rentree','fin-annee',
    'saint-valentin','fete-meres','sport','entreprise','association','humour','autre')),
  document jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  popularity int not null default 0,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (document->>'schemaVersion' = '1' and jsonb_typeof(document->'surfaces') = 'array')
);
create index templates_gallery on public.templates (status, occasion, base_product_id);
create trigger touch before update on public.templates for each row execute function app.touch_updated_at();

-- Publication : au moins un champ client, et le produit doit être en vente. Le contrôle complet (images enregistrées,
-- noms de champs uniques) est fait par l'application avec @sawwa/design (templateBlockers) ; ceci est la deuxième barrière.
create function app.check_template_publishable() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'published' then
    if not jsonb_path_exists(new.document, '$.surfaces[*].layers[*].field') then
      raise exception 'template % has no customer field', new.slug using errcode = 'check_violation';
    end if;
    if not exists (select 1 from public.base_products p where p.id = new.base_product_id and p.status = 'active') then
      raise exception 'template % : product not active', new.slug using errcode = 'check_violation';
    end if;
    if new.document->>'product' is distinct from (select p.slug from public.base_products p where p.id = new.base_product_id) then
      raise exception 'template % : document is for another product', new.slug using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
create trigger check_publishable before insert or update on public.templates
  for each row execute function app.check_template_publishable();

alter table public.templates enable row level security;
-- Tout le monde voit les modèles publiés d'un produit en vente ; l'équipe catalogue voit tout et écrit.
create policy templates_public on public.templates for select to anon, authenticated
  using ((status = 'published' and exists (select 1 from public.base_products p where p.id = base_product_id and p.status = 'active'))
    or app.has_platform_role('{catalog}'));
create policy templates_write on public.templates for all to authenticated
  using (app.has_platform_role('{catalog}')) with check (app.has_platform_role('{catalog}'));

-- Images des modèles (photos d'exemple, motifs) : lecture publique, ajout réservé à l'équipe catalogue.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('template-assets', 'template-assets', true, 26214400, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
create policy template_assets_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'template-assets');
create policy template_assets_write on storage.objects for insert to authenticated
  with check (bucket_id = 'template-assets' and app.has_platform_role('{catalog}'));
-- Pas de modification ni de suppression : une commande passée peut référencer ces images (version figée, règle 7).
