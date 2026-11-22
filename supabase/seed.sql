-- Données de référence (pas de données fictives de clients). Rejouable.
insert into public.organizations (kind, status, name, country)
values ('platform', 'active', 'SAWWA', 'SN')
on conflict do nothing;

insert into public.techniques (key, name, constraints) values
  ('dtg', '{"fr":"Impression directe (DTG)","en":"Direct to garment"}', '{"minDpi":200,"maxColors":null,"minStrokeMm":0.5}'),
  ('dtf', '{"fr":"Transfert DTF","en":"DTF transfer"}', '{"minDpi":200,"maxColors":null,"minStrokeMm":0.5}'),
  ('embroidery', '{"fr":"Broderie","en":"Embroidery"}', '{"maxColors":12,"minStrokeMm":1,"minTextHeightMm":5,"noGradients":true}'),
  ('screen_print', '{"fr":"Sérigraphie","en":"Screen printing"}', '{"maxColors":6,"minStrokeMm":0.3,"noGradients":true}'),
  ('sublimation', '{"fr":"Sublimation","en":"Sublimation"}', '{"minDpi":200}'),
  ('uv', '{"fr":"Impression UV","en":"UV printing"}', '{"minDpi":300}'),
  ('engraving', '{"fr":"Gravure","en":"Engraving"}', '{"maxColors":1,"minStrokeMm":0.3}'),
  ('flock', '{"fr":"Flocage","en":"Flock"}', '{"maxColors":3,"minStrokeMm":1}')
on conflict (key) do nothing;

insert into public.categories (slug, name, sort) values
  ('vetements', '{"fr":"Vêtements","en":"Clothing"}', 10),
  ('accessoires', '{"fr":"Accessoires","en":"Accessories"}', 20),
  ('cadeaux-photo', '{"fr":"Cadeaux photo","en":"Photo gifts"}', 30),
  ('objets', '{"fr":"Objets","en":"Objects"}', 40)
on conflict (slug) do nothing;
