# Livrable D — Architecture technique

## 1. Principe directeur
**Monolithe modulaire en TypeScript**, une base PostgreSQL, un stockage objet, un worker asynchrone. Pas de microservices : l'équipe est petite, le domaine encore mouvant, et un monolithe bien découpé se scinde plus tard si un module le justifie (rendu de fichiers, IA).

La logique métier vit dans des **paquets purs** (sans framework), testés indépendamment. Les applications ne font qu'orchestrer.

## 2. Stack recommandée
| Couche | Choix | Pourquoi | Écarté |
|---|---|---|---|
| Langage | TypeScript strict partout | Un langage, types partagés front/back/worker, le format de design typé de bout en bout | — |
| Web | **Next.js (App Router)** | SEO du catalogue (rendu serveur), une seule app pour client + pro + admin (groupes de routes), écosystème React | Remix (bon, écosystème plus petit) ; SPA pure (SEO faible) |
| UI | Tailwind + Radix/shadcn | Accessibilité, design system maîtrisé, pas de dépendance à un kit visuel | MUI/Ant (look générique, lourd) |
| API | Route handlers Next.js `/api/v1` avec contrats **Zod** → OpenAPI | API publique propre pour une future app mobile et des intégrations ateliers | tRPC seul (pas d'API publique) |
| Base | **Supabase PostgreSQL** + migrations SQL (`supabase/migrations`) + types générés | Relationnel (commandes, argent, workflow), JSONB pour les designs, RLS en défense en profondeur | Mongo (pas de transactions fortes pour l'argent) |
| Tâches asynchrones | **Supabase Queues (pgmq) + pg_cron**, exécutées par des fonctions Vercel | Dans la même base, sans service de plus | Worker dédié si la charge l'exige |
| Stockage | **Supabase Storage** (buckets privés, URLs signées, transformations d'images) | Même fournisseur, mêmes règles d'accès que la base | CDN sans frais de sortie pour la 3D si besoin |
| CDN / images | Cloudflare + transformation d'images | Cache mondial, bon pour l'Afrique | — |
| Auth | **Supabase Auth** : téléphone + code (SMS/WhatsApp), e-mail en secours ; rôles et organisations dans nos tables | Adapté au Sénégal, intégré à la RLS | Better Auth, Clerk |
| Paiement | Agrégateur UEMOA (Wave, Orange Money, cartes) derrière l'interface `PaymentProvider` | Voir D5 et `MARCHE_SENEGAL.md` | — |
| Emails | Resend ou Brevo (UE) + gabarits React Email | Simple, peu coûteux | — |
| Observabilité | Sentry (erreurs) + logs structurés + métriques Postgres | Coût faible au départ | — |
| Tests | Vitest (domaine), Playwright (parcours) | — | — |

**Hébergement (validé — D8b)** : Next.js sur **Vercel** (cdg1), base, auth, fichiers et files de tâches sur **Supabase** (eu-west-3). Coût de départ ≈ 45–60 $/mois hors SMS. La logique métier reste dans nos paquets : changer d'hébergeur reste possible.

## 3. Découpage en modules
```
apps/
  web/            Next.js : (client) / studio / pro / admin + /api/v1
  worker/         Exécuteur pg-boss : rendu, mockups, exports, emails, IA
packages/
  domain/         Types métier partagés (Money, Ids, statuts)
  design-schema/  Format SAWWA Design (JSON, Zod), migrations de version, validations
  render/         Rendu design → SVG → PNG 300 dpi / PDF (serveur) ; même code pour l'aperçu
  preflight/      Contrôles de fabricabilité (DPI, zones, couleurs, épaisseurs)
  pricing/        Moteur de prix pur + versions de règles
  workflow/       Machine à états des commandes et ordres
  db/             Schéma Drizzle, migrations, accès filtré par tenant
  payments/       Interface PaymentProvider + adaptateurs (stripe, mobile money)
  ai/             Interface AiProvider + adaptateurs, quotas, cache, journal des coûts
  ui/             Design system (tokens, composants)
  studio/         Éditeur (Fabric.js) branché sur design-schema
  viewer3d/       React Three Fiber, chargement GLB, application des textures
```
Règle de dépendance : `apps → packages`, jamais l'inverse ; `pricing`, `workflow`, `preflight`, `design-schema` ne dépendent d'aucun framework.

## 4. Studio graphique
### Choix : **Fabric.js (v6)** comme moteur d'édition, sur notre propre format de document
| Critère | Fabric.js | Konva | SVG maison |
|---|---|---|---|
| Édition de texte en place | ✅ natif | ❌ à construire | ❌ |
| Poignées, sélection multiple, groupes | ✅ | ✅ (Transformer) | ❌ |
| Export SVG | ✅ | ❌ | ✅ |
| Sérialisation | ✅ | ✅ | — |
| Performance (centaines d'objets) | bonne | très bonne | moyenne |
| Rendu Node (serveur) | ✅ (node-canvas) | partiel | ✅ |
Pour un éditeur de personnalisation (quelques dizaines d'objets, beaucoup de texte), Fabric gagne. Konva est meilleur pour des scènes très animées, ce n'est pas notre cas.

### Décision clé : **Fabric n'est pas le format de stockage**
On stocke un **SAWWA Design Document** (JSON versionné, validé par Zod), en **millimètres réels** :
```json
{
  "schemaVersion": 1,
  "productRef": "tee-crew-180",
  "surfaces": [{
    "zoneKey": "front_center",
    "technique": "dtg",
    "widthMm": 300, "heightMm": 400,
    "layers": [
      { "id": "l1", "type": "text", "text": "TERANGA FC", "fontId": "manrope-800",
        "sizeMm": 28, "fill": "#24221F", "xMm": 150, "yMm": 60, "rotation": 0, "align": "center" },
      { "id": "l2", "type": "image", "assetId": "ast_9f…", "xMm": 150, "yMm": 200,
        "widthMm": 220, "heightMm": 220, "rotation": 0 }
    ]
  }]
}
```
Avantages : indépendant de la librairie (on peut la remplacer), rendu serveur fidèle, pré-contrôle et prix calculés sur la même source, versionnable et immuable une fois commandé, réutilisable pour la 3D (chaque surface devient une texture).

### Rendu et fichiers de production
- `packages/render` : document → **SVG** (texte converti en tracés avec les polices embarquées) → **PNG transparent 300 dpi à taille réelle** (resvg/sharp) et **PDF** vectoriel quand toutes les couches sont vectorielles.
- Livrables par ordre : un fichier par zone + **fiche technique PDF** (produit, variante, tailles × quantités, zone, dimensions, position par rapport à un repère physique — ex. « 7 cm sous le col », technique, couleurs).
- Broderie : PNG/SVG de référence + digitalisation faite par l'atelier (fichier DST/PES déposé par l'atelier dans l'ordre, conservé pour les recommandes).
- Profils colorimétriques : sRGB pour DTG/DTF/sublimation (les RIP ateliers convertissent) ; pour la sérigraphie, séparation par couleur en aplats (PMS de référence).
- **Immuabilité** : à la commande, le document est copié en `design_version` figée (hash SHA-256) ; les fichiers de production sont générés depuis cette version et jamais régénérés silencieusement.

## 5. Rendu visuel (mockups et 3D)
### Mockups 2D réalistes (tous produits, V1)
Photo HD du produit + **carte de déplacement** (plis) + **carte d'ombrage** (multiplication) + masque de zone + transformation perspective. Composition côté client en WebGL (instantané pendant l'édition) et côté serveur avec sharp pour les vignettes, emails, panier. Production des assets : shooting photo ou rendus 3D statiques par produit de référence (≈ 150–400 € par produit/couleur de base, recolorisation par teinte).

### 3D (React Three Fiber + drei)
- Modèles **GLB** compressés (Meshopt/Draco), textures **KTX2**, poids cible < 1,5 Mo par produit.
- Le design de chaque zone est rendu en texture (canvas) et appliqué sur l'**UV** de la zone (objets rigides : mug, gourde) ou en **décalque** projeté (casquette).
- Chargement différé (le studio s'ouvre sans 3D), détection de capacité de l'appareil, repli automatique sur les mockups 2D.
- V2 vêtements : turntable pré-animé (simulation textile cuite dans le GLB via CLO 3D/Marvelous Designer), design appliqué sur l'UV du patron.

## 6. Intelligence artificielle
- Interface unique `AiProvider` (génération d'image, détourage, agrandissement, suggestions texte) avec adaptateurs interchangeables.
- **Détourage** : modèle exécuté **dans le navigateur** quand l'appareil le permet (coût serveur nul), sinon API.
- **Génération d'images** (phase IA) : fournisseur externe appelé uniquement sur action explicite ; prompt enrichi par un LLM léger pour le style ; 4 propositions basse définition puis agrandissement seulement de celle choisie (économie ×4).
- Garde-fous : quotas par utilisateur (ex. 10 générations gratuites/mois, puis crédits), budget mensuel global avec coupure, cache par empreinte (prompt normalisé + paramètres), modération entrée/sortie, journal du coût par appel (`ai_usage`), filigrane invisible/métadonnées sur les images générées.
- Le résultat de l'IA arrive **comme un calque** dans le studio : le client garde la main.

## 7. Sécurité
- Auth : sessions httpOnly, 2FA obligatoire pour admin et ateliers, mots de passe hachés (argon2), connexion par lien magique pour les clients.
- **RBAC** côté serveur sur chaque route (`can(user, action, resource)`), tests de permissions automatisés.
- **Isolation ateliers** : toutes les requêtes du portail pro passent par un accès filtré `vendor_id` + **RLS PostgreSQL** activée sur les tables sensibles.
- Fichiers : bucket privé, URLs signées courte durée ; les ateliers n'accèdent qu'aux fichiers de leurs ordres affectés.
- Imports : vérification du type réel (magic bytes), taille max, ré-encodage des images, SVG assaini (pas de scripts), antivirus pour les PDF.
- Paiement : aucune donnée de carte chez nous (Stripe Elements/Checkout) ; webhooks signés et idempotents.
- Limitation de débit (auth, IA, upload, devis), protection anti-bot sur l'inscription.
- Secrets dans le gestionnaire de l'hébergeur ; jamais dans le dépôt.
- Journal d'audit append-only pour les actions admin, accès aux données personnelles, changements de prix.
- RGPD : hébergement UE, registre des traitements, export et suppression de compte (avec conservation légale des factures 10 ans), durées de conservation (designs non commandés supprimés après 24 mois d'inactivité, après avertissement).
- Sauvegardes : Postgres avec point-in-time recovery (7–30 j), réplication du bucket, test de restauration trimestriel.

## 8. Scalabilité — ce qui tient quoi
| Charge | Ce qui suffit |
|---|---|
| ≤ 10 000 commandes/mois | Architecture ci-dessus, une instance Postgres, 1–2 workers |
| Rendu lourd (exports 300 dpi, mockups) | Workers dédiés à la file `render`, mis à l'échelle horizontalement |
| Trafic catalogue | Pages statiques régénérées (ISR) + CDN |
| International | Prix/devise/langue/fiscalité déjà paramétrés dans les modèles ; CDN mondial |
Les points de sortie du monolithe identifiés à l'avance : `render` et `ai` (sans état, faciles à extraire en services).

## 9. Coûts techniques par commande (estimation)
| Poste | Coût |
|---|---|
| Stockage (design + exports + mockups, ~40 Mo, 2 ans) | ~0,02 € |
| Rendu exports et mockups | ~0,01–0,03 € |
| Emails/notifications | ~0,01–0,05 € (WhatsApp ~0,03–0,08 €/message) |
| Détourage (navigateur) | 0 € ; API ~0,01–0,05 € |
| Génération IA (4 brouillons + 1 HD) | ~0,05–0,25 € par session de génération |
| Paiement (carte UE) | ~1,5 % + 0,25 € (coût le plus élevé, et de loin) |
