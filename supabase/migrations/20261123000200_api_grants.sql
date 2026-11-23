-- SAWWA — migration 14 : droits explicites de l'API (constaté au premier déploiement, 23/11/2026).
-- Les nouveaux projets Supabase ne donnent plus SELECT/INSERT/UPDATE/DELETE par défaut aux rôles de l'API.
-- On rétablit les droits de table habituels ; la RLS (activée sur toutes les tables) reste la barrière par ligne,
-- et les durcissements par colonne de la migration 12 sont réappliqués ensuite.

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;

-- Réapplique la migration 12 : montant atelier masqué aux utilisateurs, vue filtrée par rôle.
revoke select on public.fulfillments from anon, authenticated;
grant select (id, order_id, vendor_id, status, proof_round, held_from, sla_due_at, carrier, tracking_number, qc_photos, created_at, updated_at)
  on public.fulfillments to authenticated;
revoke all on public.fulfillment_costs from anon, authenticated;
grant select on public.fulfillment_costs to authenticated;
