-- SAWWA — migration 12 : durcissement avant lancement (E24a).
-- Le montant atelier d'une commande (fulfillments.vendor_cost) n'est lisible que par l'équipe SAWWA et par le
-- propriétaire ou les gérants de l'atelier affecté — jamais par un opérateur d'atelier ni par le client (D24).
-- La RLS filtre des lignes, pas des colonnes : on retire la colonne du droit de lecture général et on l'expose
-- par une vue filtrée.

revoke select on public.fulfillments from anon, authenticated;
grant select (id, order_id, vendor_id, status, proof_round, held_from, sla_due_at, carrier, tracking_number, qc_photos, created_at, updated_at)
  on public.fulfillments to authenticated;

create view public.fulfillment_costs with (security_barrier = true) as
  select f.id as fulfillment_id, f.order_id, f.vendor_id, f.vendor_cost
  from public.fulfillments f
  where app.has_platform_role('{ops,finance,support}') or (f.vendor_id is not null and app.is_org_manager(f.vendor_id));
revoke all on public.fulfillment_costs from anon, authenticated;
grant select on public.fulfillment_costs to authenticated;
