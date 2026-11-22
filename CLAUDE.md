# CLAUDE.md — Instructions permanentes (SAWWA)

> Fichier lu à chaque session. Rester court. Le détail est dans `docs/`.

## Contexte en 5 lignes
- SAWWA : SaaS de personnalisation et fabrication à la demande (studio → prix → commande → atelier partenaire → livraison).
- 3 espaces : client (public, SEO), pro (ateliers), admin (opérations). Un seul design system.
- Statut : décisions validées (22/11/2026). **Phase 2 en cours : socle technique.** Marché de lancement : Sénégal (XOF, sans décimales).
- Langue des docs et de l'UI : français d'abord, anglais ensuite. Code et identifiants : anglais.
- Le porteur du projet garde la main sur les grandes décisions (voir « Règles »).

## Où trouver quoi (lire uniquement ce dont la tâche a besoin)
| Besoin | Fichier |
|---|---|
| Vision, périmètre | `PROJECT.md` |
| Décisions validées / à arbitrer | `docs/DECISIONS.md` |
| Audit du concept | `docs/AUDIT.md` |
| Fonctionnalités par portail | `docs/PRODUCT_SPEC.md` |
| Identité, tokens, UI | `docs/DESIGN_SYSTEM.md` + `design/maquettes.html` |
| Architecture technique | `docs/ARCHITECTURE.md` |
| Modèle de données | `docs/DATABASE.md` |
| Prix, commissions, simulation | `docs/BUSINESS_MODEL.md` |
| Phases, critères d'acceptation | `docs/ROADMAP.md` |
| Organisation du code, Git, méthode | `docs/EXECUTION.md` |
| Logo (audit, système) | `docs/LOGO_AUDIT.md` |
| 3D, mannequins | `docs/VISUALISATION_3D.md` |
| Benchmark, catalogue, modèles | `docs/BENCHMARK_CATALOGUE.md` |
| Marché Sénégal | `docs/MARCHE_SENEGAL.md` |
| Recrutement ateliers | `docs/RECRUTEMENT_ATELIERS.md` |
| Mise en route Supabase/Vercel | `docs/SETUP_SUPABASE_VERCEL.md` |

## Stack
Next.js (Vercel) + Supabase (Postgres, Auth, Storage). Migrations SQL dans `supabase/migrations`. La RLS est une deuxième barrière : les règles métier restent dans `packages/`.

## Commandes
`pnpm install` · `pnpm test` · `pnpm typecheck` · `pnpm db:test` (migrations + RLS sur un Postgres local) · `pnpm --filter web dev`

## Paquets métier
`domain` (Money) · `pricing` (prix, grilles, prix catalogue) · `workflow` (statuts) · `catalog` (règles catalogue) · `design` (document de création, géométrie, contrôle de fabrication)

## Règles non négociables
1. Rien de déployé, publié, acheté, supprimé ou configuré sur un service externe sans accord explicite.
2. Aucun paiement réel : agrégateur de paiement en mode test (sandbox) uniquement jusqu'à validation.
3. Montants en **entiers (unités mineures) + code devise** via `packages/domain` (`Money`). XOF = 0 décimale. Jamais de float pour l'argent.
4. Tout calcul de prix passe par `packages/pricing`. Aucun calcul dans l'UI ni dans les routes.
5. Toute transition de statut de commande passe par `packages/workflow`.
6. Permissions vérifiées côté serveur ; chaque requête vendeur filtrée par `vendor_id`.
7. Une commande payée référence une **version figée** du design et un **devis figé** (snapshot). Jamais de référence mutable.
8. Nouvelle dépendance = justification d'une ligne dans le compte rendu.
9. Décision structurante → l'ajouter à `docs/DECISIONS.md` (format ADR court).

## Méthode de travail
- Une tâche = une branche = un périmètre court. Lire les fichiers ciblés, pas tout le repo.
- Compte rendu de fin de tâche : fait / non fait / décisions / prochaine étape (≤ 10 lignes).
- Mettre à jour `docs/ROADMAP.md` (case cochée) à chaque livraison.
