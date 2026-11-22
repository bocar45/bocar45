# Modèle de données (PostgreSQL)

Conventions : identifiants `uuid` v7 (triables) exposés avec préfixe (`ord_`, `ven_`…) ; montants `bigint` en unités mineures + `currency char(3)` ; horodatages `timestamptz` ; suppression logique (`archived_at`) pour les objets référencés par des commandes ; `jsonb` uniquement pour les données dont la structure est portée par un schéma Zod versionné.

## 1. Identité et accès
| Table | Champs clés |
|---|---|
| `users` | id, email, phone, name, locale, country, status, created_at |
| `organizations` | id, type (`customer_org` \| `vendor` \| `platform`), name, legal_name, country, tax_id, status |
| `memberships` | user_id, organization_id, role (`owner`, `manager`, `operator` ; admin : `super_admin`, `ops`, `catalog`, `vendor_manager`, `support`, `finance`) |
| `sessions`, `accounts` | gérés par la librairie d'auth |
| `audit_log` | id, actor_user_id, actor_org_id, action, entity_type, entity_id, before jsonb, after jsonb, ip, at (append-only) |

Un client B2B (association, entreprise) est une `organization` de type `customer_org` : plusieurs membres peuvent partager créations et commandes.

## 2. Catalogue de référence (SAWWA)
| Table | Champs clés |
|---|---|
| `categories` | id, parent_id, slug, name_i18n jsonb, sort |
| `techniques` | id, key (`dtg`, `dtf`, `embroidery`, `screen_print`, `sublimation`, `uv`, `engraving`, `flock`), constraints jsonb (max couleurs, épaisseur min, dpi min, formats) |
| `base_products` | id, category_id, slug, name_i18n, description_i18n, attributes jsonb (matière, grammage, composition), size_chart jsonb, status |
| `base_product_variants` | id, base_product_id, color_key, color_hex, size, sku_ref |
| `views` | id, base_product_id, key (`front`, `back`, `left_sleeve`…), mockup_assets jsonb (photo, displacement, shading, mask par couleur) |
| `zones` | id, base_product_id, view_id, key (`front_center`, `chest_left`…), max_w_mm, max_h_mm, anchor (repère physique + offset), print_area_path (SVG), allowed_technique_ids[] |
| `models_3d` | id, base_product_id, kind (`product`/`worn`), body (`male`/`female`/null), glb_asset_id, uv_map jsonb (zone → région UV calibrée en mm), animations[], lod jsonb, status |
| `avatars` | id, body, glb_asset_id, skin_tones jsonb, animations[] |

## 3. Ateliers et offres
| Table | Champs clés |
|---|---|
| `vendor_profiles` | organization_id, address, geo point, ships_to countries[], equipment jsonb, capacity_per_day, lead_time_days, verification_status, quality_score, payout_details_ref |
| `vendor_documents` | id, vendor_id, type, asset_id, status, reviewed_by |
| `vendor_offers` | id, vendor_id, base_product_id, status, min_qty, lead_time_days, stock_mode (`made_to_order` \| `stock`) |
| `vendor_offer_variants` | offer_id, variant_id, available bool, stock_qty nullable, blank_cost (minor) |
| `vendor_zone_capabilities` | offer_id, zone_id, technique_id, max_w_mm, max_h_mm (≤ référence), max_colors |
| `vendor_price_grids` | id, vendor_id, version, valid_from, rules jsonb (schéma `VendorPriceGrid` : coûts par technique × zone × taille de marquage × couleurs × paliers de quantité, frais de préparation, minimums) |
| `vendor_closures` | vendor_id, from, to, reason |

## 4. Tarification plateforme
| Table | Champs clés |
|---|---|
| `price_rule_sets` | id, version, status (`draft`/`active`/`retired`), activated_at, activated_by, rules jsonb (marges par catégorie/technique/pays, arrondis psychologiques, frais de service, plancher de marge) |
| `shipping_rates` | id, zone/pays, carrier, weight brackets jsonb, currency |
| `tax_rules` | country, category, rate, valid_from |
| `promotions` | code, type, value, conditions jsonb, usage limits, valid_from/to |
| `fx_rates` | base, quote, rate, at (XOF/EUR fixe 655,957) |

## 5. Designs
| Table | Champs clés |
|---|---|
| `assets` | id, owner_org_id/user_id, kind (`upload`, `ai_generated`, `library`, `export`, `mockup`, `glb`, `vendor_file`), storage_key, mime, bytes, width_px, height_px, sha256, rights_declared_at, moderation_status |
| `designs` | id, owner (user/org), base_product_id, title, current_document jsonb (brouillon), updated_at |
| `design_versions` | id, design_id, number, document jsonb, sha256, preflight_report jsonb, created_at — **immuable** |
| `templates` | id, base_product_ids[], document jsonb (slots `photoSlot`/`textField`/`locked`/`variable`), tags (occasion, style), author_id, royalty_rate, status, popularity |
| `design_shares` | id, design_id, token, permission (`view`/`comment`), expires_at |

## 6. Devis, panier, commandes
| Table | Champs clés |
|---|---|
| `quotes` | id, kind (`instant`/`manual`), customer, lines jsonb, **pricing_snapshot jsonb** (rule_set_version, vendor_grid_version, entrées, détail du calcul), totals, currency, expires_at, status |
| `carts` / `cart_items` | items référencent design_id + variante + répartition tailles ; prix recalculé à chaque affichage |
| `orders` | id, number (`SW-2026-000123`), customer, status, currency, subtotal, shipping, discount, tax, total, quote_id, billing/shipping address snapshot, placed_at |
| `order_items` | id, order_id, design_version_id (figé), base_product_id, variant breakdown jsonb (taille → qté), unit_price, line_total, pricing_breakdown jsonb |
| `fulfillments` (ordres de fabrication) | id, order_id, vendor_id, status, sla_due_at, vendor_cost_total, assigned_by, assigned_at |
| `fulfillment_items` | fulfillment_id, order_item_id, vendor_unit_cost, production_files[] (asset ids) |
| `proofs` (BAT) | id, fulfillment_id, round, status (`pending`/`approved`/`changes_requested`/`rejected`), reason_code, comment, annotations jsonb, decided_by, decided_at |
| `status_events` | id, entity (`order`/`fulfillment`), entity_id, from, to, actor, reason, at — historique complet |
| `shipments` | id, fulfillment_id, carrier, tracking_number, label_asset_id, shipped_at, delivered_at |
| `qc_photos` | fulfillment_id, asset_id |
| `messages` | id, thread (fulfillment/order/ticket), author, body, visibility (`internal`/`vendor`/`customer`), attachments |

## 7. Paiements et finances
| Table | Champs clés |
|---|---|
| `payments` | id, order_id, provider, provider_ref, method, amount, currency, status, raw jsonb |
| `refunds` | id, payment_id, amount, reason, initiated_by, status |
| `webhook_events` | provider, event_id (**unique** → idempotence), payload, processed_at |
| `vendor_ledger` | id, vendor_id, fulfillment_id, type (`earning`/`penalty`/`adjustment`/`payout`), amount, currency, at — grand livre en écriture seule |
| `payouts` | id, vendor_id, period, amount, status, method, reference |
| `invoices` | id, number (séquence sans trou par série), type (`customer`/`vendor_self_billing`/`credit_note`), order_id/payout_id, pdf_asset_id, issued_at |

## 8. Support, IA, notifications
| Table | Champs clés |
|---|---|
| `tickets` | id, order_id, customer, category (`defect`, `delay`, `wrong_item`, `other`), status, resolution (`reprint`/`refund`/`none`), assignee |
| `reports` (modération) | id, entity, reason, reporter, status |
| `ai_usage` | id, user/org, provider, operation, input_hash, cost_micro_eur, tokens/images, cached bool, at |
| `ai_quotas` | subject, period, limit, used |
| `notifications` | id, user, channel (`email`/`whatsapp`/`sms`/`in_app`), template, payload, status, sent_at |

## 9. Invariants garantis par la base
- `order_items.design_version_id` → `design_versions` (immuable : pas de UPDATE autorisé par trigger).
- `quotes.pricing_snapshot` non modifiable une fois `accepted`.
- `webhook_events (provider, event_id)` unique.
- `invoices.number` unique par série, attribué dans une transaction.
- `vendor_ledger` : insertion seule ; le solde est une somme.
- RLS sur `fulfillments`, `fulfillment_items`, `proofs`, `messages`, `vendor_*` : `vendor_id = current_setting('app.vendor_id')` pour le rôle applicatif « pro ».

## 10. Implémentation Supabase (migrations)
| Migration | Contenu |
|---|---|
| `20261122000100_core.sql` | Identité, organisations, rôles, catalogue, ateliers, offres, grilles, règles de prix, audit, RLS |
| `20261122000200_catalog_offers_rules.sql` | Publication contrôlée d'un produit, zone ↔ vue du même produit, offres réservées aux ateliers **actifs**, capacité ≤ zone de référence et technique autorisée, activation des règles de prix (`activate_price_rule_set`, rôle finance, audit), versions activées figées |
| `20261122000300_designs_orders.sql` | Créations, versions figées (immuables), commandes (numéro SW-AAAA-000001), lignes, ordres de fabrication, historique (immuable), fonctions serveur `create_order` / `apply_fulfillment_transition` (contrôle optimiste) / `mark_order_paid`, stockage `design-assets` (dossier par client) et `qc-photos` (dossier par atelier) |
| `20261122000400_design_corrections.sql` | Historique des versions par ligne de commande (`order_item_versions`, immuable, supplément éventuel, **devis figé** `quote` par version), lecture des versions par client / atelier affecté / ops / support / **finance**, `resubmit_design` (nouvelle version + transition + événement, atomique, contrôle optimiste), lecture des versions précédentes par l'atelier affecté |
| `20261122000500_robustness.sql` | `save_vendor_offer` (offre + variantes + capacités + grille, une transaction, règles d'accès de l'atelier), `rate_limits` + `rate_limit_hit` (serveur uniquement), limites de taille et de type sur les dossiers de fichiers |
Tests : `pnpm db:test` (Postgres local jetable, sans Docker).

