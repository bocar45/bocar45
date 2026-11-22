# Livrable G — Plan d'exécution

## 1. Structure du dépôt (à créer en phase 2)
```
/
├─ CLAUDE.md               instructions permanentes (court)
├─ PROJECT.md              vision
├─ docs/                   AUDIT, PRODUCT_SPEC, DESIGN_SYSTEM, ARCHITECTURE, DATABASE,
│                          BUSINESS_MODEL, ROADMAP, EXECUTION, DECISIONS, API (phase 2)
├─ design/                 maquettes, logo sources, assets de marque
├─ apps/web/               Next.js : app/(client) app/studio app/pro app/admin app/api/v1
├─ apps/worker/            tâches pg-boss
├─ packages/               domain, design-schema, render, preflight, pricing, workflow,
│                          db, payments, ai, ui, studio, viewer3d
├─ tooling/                configs partagées (tsconfig, eslint)
└─ .github/workflows/      CI
```
Outils : pnpm workspaces + Turborepo, TypeScript strict, ESLint + Prettier, Vitest, Playwright, Changesets non nécessaire (pas de paquet publié).

## 2. Documentation vivante
| Fichier | Règle de mise à jour |
|---|---|
| `CLAUDE.md` | ≤ 60 lignes. Uniquement des règles stables et l'index. |
| `docs/DECISIONS.md` | Une entrée par décision structurante (contexte, choix, alternatives, conséquences). Jamais réécrite, seulement complétée (« remplacée par D-xx »). |
| `docs/ROADMAP.md` | Cases cochées à chaque livraison. |
| `docs/API.md` | Généré depuis les schémas Zod (OpenAPI), pas écrit à la main. |
| `docs/DATABASE.md` | Mis à jour dans la même branche que la migration. |
| README par paquet | 10–20 lignes : rôle, API publique, invariants. Permet de travailler sur un paquet sans lire le reste. |

## 3. Méthode de travail et optimisation des tokens
- **Une session = une tâche bornée** issue de la roadmap (ex. « moteur de prix : paliers de quantité »). Le prompt cite les fichiers concernés.
- Lecture ciblée : `CLAUDE.md` → README du paquet → fichiers concernés. Pas d'exploration globale.
- **Règles métier centralisées** dans des paquets purs : une modification de prix touche `packages/pricing` et ses tests, rien d'autre.
- Tests comme spécification : les tables de cas du moteur de prix et du workflow servent aussi de documentation.
- Génération plutôt que rédaction : types DB → Drizzle, API → OpenAPI, tokens → CSS.
- Compte rendu de fin de tâche ≤ 10 lignes : fait / reste / décisions / risques.
- Pas de refactor opportuniste hors du périmètre de la tâche.
- Pour le studio et la 3D (zones à fort risque), prototypes jetables courts **avant** l'implémentation définitive.

## 4. Git
- `main` : toujours déployable, protégée, fusion par pull request uniquement.
- Branches courtes : `feat/<module>-<sujet>`, `fix/…`, `docs/…`, `chore/…`.
- Commits conventionnels (`feat(pricing): paliers dégressifs`).
- CI obligatoire avant fusion : types, lint, tests unitaires, tests d'intégration, build.
- Environnements : `preview` par PR (données factices), `staging` (Stripe test, données de démonstration), `production` — **déploiement en production uniquement sur ton accord explicite**.
- Versions : tags `v0.x` par phase livrée ; migrations DB numérotées et jamais modifiées après fusion.
- Secrets : uniquement dans le gestionnaire de l'hébergeur ; `.env.example` versionné sans valeurs.

## 5. Ce dont j'ai besoin de toi pour démarrer la phase 1
1. Arbitrage des décisions de `docs/DECISIONS.md` (au minimum D1 à D5).
2. Le **fichier du logo** (SVG/AI/PDF, sinon PNG ≥ 2000 px).
3. Les contacts ou profils des ateliers envisagés (pays, techniques, machines), même informels.
4. Le pays de l'entité juridique qui facturera.
