# Livrable F — Roadmap

## Changement de méthode par rapport au dossier initial
Le découpage initial construit chaque brique horizontalement (studio complet, puis commandes, puis portail atelier, puis 3D…). Risque : découvrir au mois 6 que le fichier de production ne convient pas aux ateliers ou que le prix est faux.

**Proposition : une « tranche verticale » d'abord**, avec 1 produit, 1 technique et 1 atelier, du studio jusqu'à la livraison réelle. Puis on élargit. Chaque phase se termine par une démonstration sur des **données réelles** et une validation de ta part.

Complexité : S (≤ 1 semaine), M (2–3 sem.), L (4–6 sem.), en développement assisté par IA avec ta validation aux jalons.

## Phases
| # | Phase | Contenu | Dépend de | Taille |
|---|---|---|---|---|
| 0 | **Cadrage** (ce dossier) | Audit, décisions, architecture, DA | — | ✔ |
| 1 | **Identité & prototype** | Logo finalisé (sur ton fichier), tokens, maquettes cliquables des parcours clés (accueil, fiche, studio, BAT client, file atelier, admin commandes), tableur économique avec vrais devis ateliers, **recrutement de 2 ateliers pilotes** | 0 | M |
| 2 | **Socle** | Monorepo, CI, auth + rôles, organisations, schéma DB, audit log, design system en composants, admin catalogue de référence (produits, vues, zones), stockage fichiers | 1 | M |
| 3 | **Tranche verticale** | Studio V1 (texte, image, formes, calques, zones, sauvegarde) sur 1 produit (t-shirt DTG), pré-contrôle, mockup 2D, moteur de prix v1, panier, Stripe **test**, commande, design figé, export 300 dpi + fiche technique, file atelier minimale (BAT → production → expédition), emails | 2 | L |
| 4 | **Pilote fermé** | 20–50 commandes réelles (amis, 2–3 associations) avec les 2 ateliers pilotes. Mesures : conformité fichiers, délais, défauts, compréhension du prix | 3 + D1/D5 validées, paiement réel **sur ton accord** | S–M |
| 5 | **Élargissement catalogue & B2B** | **Modèles prêts à personnaliser** (assistant), occasions, 6–8 produits de référence, broderie (frais de préparation), sérigraphie par lot, répartition par tailles, devis, codes promo, offres atelier en libre-service, routage semi-automatique | 4 | L |
| 6 | **Administration opérationnelle** | Tableau de bord, SLA, litiges/reprises, grand livre ateliers, virements, export comptable, factures, modération | 3 (en parallèle de 5) | M |
| 3D-P | **Piste 3D parallèle** (démarre en phase 1) | Cahier des charges, artiste, avatars H/F, vêtements, objets ; visionneuse « Produit » en phase 3, **mannequins H/F en phase 5**, animations vitrines en phase 7. Voir `VISUALISATION_3D.md` | 1 | L |
| 7 | **3D avancée** | Simulation textile pré-calculée, broderie en relief, casquette, vidéo partageable | 5 | M |
| 8 | **IA** | Détourage (dès phase 3 si navigateur), génération de motifs/illustrations avec quotas et crédits, agrandissement, suggestions | 5 | M |
| 9 | **Lancement public** | Tests de charge, sécurité (revue + tests d'intrusion légers), CGV/CGU/confidentialité relues par un juriste, SEO, analytics, FR/EN, procédure d'incident | 5, 6 | M |
| 10 | **V2** | Turntable 3D vêtements, mobile money, boutiques créateurs, deuxième pays de facturation, application de l'API atelier | 9 | — |

## Avancement
- [x] Phase 0 — cadrage validé (22/11/2026), marché Sénégal
- [x] Phase 1 (partiel) — DA, audit logo, maquettes, kit de recrutement ateliers
- [ ] Phase 1 — vectorisation du logo, recrutement de 2 ateliers, casting 3D
- [x] Phase 2 (début) — monorepo, CI, `domain` (Money XOF), `pricing` (moteur de prix), `workflow` (machine à états) avec tests
- [x] Phase 2 — Supabase + Vercel choisis (D8b) ; migration 1 (identité, rôles, catalogue, ateliers, règles de prix, audit) avec RLS testée (`pnpm db:test`)
- [x] Phase 2 — application Next.js : connexion par téléphone + code (e-mail en secours), compte, candidature atelier, validation des ateliers par l'admin avec journal d'audit
- [x] Phase 2 — admin catalogue : produits, couleurs/tailles, vues, zones (techniques, dimensions), publication contrôlée (app + trigger SQL), audit
- [x] Phase 2 — règles de prix SAWWA versionnées (finance), activation tracée, versions activées figées
- [x] Phase 2 — espace atelier : offres (variantes, zones × techniques, grille de prix par palier, frais fixes), grille versionnée immuable ; réservé aux ateliers actifs (RLS)
- [x] Phase 2 — fiche atelier admin : simulation des prix publics par le moteur de prix
- [x] Refonte visuelle du site (direction « atelier contemporain ouest-africain », logo réel, aplats, bandes tissées)
- [x] Phase 3 (début) — catalogue public par catégorie et fiches produits ; prix « dès » et prix par quantité calculés par le moteur sur les offres actives (seuls les prix publics quittent le serveur), cache 10 min + rafraîchissement à chaque modification admin/atelier
- [x] Phase 3 — studio V1 : texte (6 polices libres), images (PNG/JPG/WebP), formes (losange, cercle, carré), zones en mm réels, déplacement/redimensionnement/rotation avec aimantation, calques (ordre, masquer, verrouiller), annuler/rétablir, raccourcis clavier, choix de technique par zone, contrôle de fabrication en direct (`@sawwa/design`), prix en direct (moteur de prix, serveur), aperçu sur le produit, brouillon enregistré sur l'appareil (images en IndexedDB)
- [x] Phase 3/4 — créations enregistrées dans le compte (images dans Supabase Storage), réouverture dans le studio, « Mes créations »
- [x] Phase 4 — commande : tailles, livraison, adresse ; contrôles et prix recalculés côté serveur ; création et devis figés ; création atomique (`create_order`) ; suivi client avec historique ; réponse à une demande de correction (produire telle quelle / annuler)
- [x] Phase 4 — admin commandes : vues à encaisser / à affecter / en cours / terminées, retards SLA, confirmation manuelle du paiement (D15), affectation avec coût et marge par atelier, pause, reprise, annulation, livraison
- [x] Phase 5 — atelier : file par étape, fiche de production (création figée, tailles, position du marquage en cm, fichiers originaux), prise en charge/refus, BAT (valider / demander correction), production, photos de contrôle, expédition
- [x] Phase 5 (E09) — fichiers de production : PNG transparent 300 dpi par zone (résolution écrite dans le fichier), images converties sans perte (WebP → PNG), fiche de production PDF A4, polices fixes fidèles au studio, accès réservé à l'atelier affecté
- [x] Phase 4/5 (E10) — correction de la création par le client : studio ouvert sur la version commandée, nouvelle version figée, renvoi au BAT atomique, prix recalculé (supplément explicitement accepté, jamais de baisse remboursée), historique des versions pour le client, l'atelier et l'admin
- [x] E14 — robustesse : offre atelier en une transaction, limitation de débit (SMS, prix, commandes, fichiers), contrôle et ré-encodage des fichiers, images limitées à celles du client, erreurs journalisées
- [x] E18 — studio 3D en direct (2D + 3D), modèles provisoires calibrés en mm (D17), emplacements en un clic
- [x] E24d — version anglaise : sélecteur de langue, espace public, connexion, devis et studio en anglais (D29)
- [x] E24c — référencement : métadonnées, robots.txt, plan du site, données structurées, pages légales provisoires (à faire relire)
- [x] E24b — tests de charge locaux : moteurs, pages, limitation de débit ; mémoire des fichiers d'impression maîtrisée (D28, `docs/PERFORMANCE.md`)
- [x] E24a — sécurité avant lancement : redirection ouverte corrigée, en-têtes de sécurité, montant atelier protégé au niveau colonne, patrons figés avec la commande (D27)
- [x] E18b (code) — impression intégrale coupé-cousu : pièces de patron, motif continu raccordé aux coutures, fichiers par pièce et plan de coupe (D26) ; vente quand un atelier capable sera recruté
- [x] E22 (partie gratuite) — détourage automatique des photos dans le navigateur, sans service externe (D25)
- [x] E21 — espace atelier avancé : capacité et fermetures prises en compte à l'affectation, équipe avec rôles (D24)
- [x] E20 — administration avancée : tableau de bord, litiges et reprises, grand livre ateliers et versements, export comptable (D23)
- [x] E18d — modération : déclaration de droits à l'import, signalements, file de modération, refus motivés au BAT (D22)
- [x] E17 — devis B2B : demande en ligne, chiffrage par l'équipe avec le moteur de prix, prix ferme 30 jours, commande au prix du devis (D21)
- [x] E16 — commandes d'équipe : nom et numéro par pièce, liste collée depuis un tableur, contrôle en direct, fichier d'impression par pièce et liste à cocher pour l'atelier (D20)
- [x] E15 — modèles prêts à personnaliser : galerie par occasion, assistant photo + texte dans le studio, création et publication par l'équipe catalogue (D19)
- [x] E18c — outils d'image : fond, inversion, rognage, recadrage, trame, vectorisation en aplats (D18)
- [ ] Suite : notifications WhatsApp/SMS, agrégateur de paiement, Sentry, test de bout en bout sur un vrai projet Supabase
- [ ] Phase 2 — créer les projets Supabase/Vercel (porteur), types générés, enregistrement d'offre atomique (RPC), test des écrans de bout en bout sur un vrai projet Supabase

## Critères d'acceptation par jalon
**Phase 1**
- [ ] Logo validé en 8 déclinaisons, testé à 16 px et en broderie simulée 15 mm.
- [ ] Maquettes cliquables des 6 parcours validées par toi + testées par 5 utilisateurs cibles (dont 2 responsables d'associations/entreprises).
- [ ] 2 ateliers pilotes ont fourni grilles de prix, contraintes techniques et formats de fichiers attendus.
- [ ] Simulation économique recalculée avec ces grilles.

**Phase 2**
- [ ] Un admin crée un produit de référence avec vues et zones sans toucher au code.
- [ ] Tests de permissions : un atelier A ne peut lire aucune donnée de l'atelier B (tests automatisés, y compris accès direct aux URLs de fichiers).
- [ ] CI verte (lint, types, tests) ; migrations rejouables sur une base vide.

**Phase 3**
- [ ] Un fichier exporté, imprimé par l'atelier pilote, correspond au design à ±2 mm et à la position annoncée.
- [ ] Le prix affiché dans le studio = prix du panier = prix payé = prix enregistré (test de bout en bout).
- [ ] Modifier un design après commande ne change pas la commande (test).
- [ ] Un BAT « correction demandée » notifie le client, qui peut corriger ou être remboursé.
- [ ] Webhook de paiement rejoué 3 fois → une seule commande.
- [ ] Studio utilisable sur mobile (iPhone SE / Android d'entrée de gamme) ; LCP catalogue < 2,5 s en 4G.

**Phase 4 (go / no-go lancement)**
- [ ] ≥ 90 % des commandes livrées dans le délai annoncé.
- [ ] Taux de défaut < 3 %, taux de refus BAT < 10 %.
- [ ] Marge réelle par commande conforme à la simulation à ±20 %.

## Stratégie de tests
| Niveau | Outil | Cible |
|---|---|---|
| Unitaires domaine | Vitest | `pricing` (tables de cas + snapshots + tests de propriété : jamais de marge négative, total = Σ lignes), `workflow` (toutes transitions autorisées/interdites), `preflight`, `design-schema` (migrations de version) |
| Rendu | Vitest + comparaison d'images | Export d'un jeu de designs de référence → comparaison pixel avec tolérance |
| Intégration | Vitest + Postgres de test | Permissions, RLS, webhooks idempotents |
| Parcours | Playwright | Créer → payer (Stripe test) → BAT → produire → expédier ; client, atelier, admin |
| Charge | k6 | Catalogue, prix en direct, upload |
| Sécurité | Revue OWASP, dépendances (audit), tests d'accès croisés | Avant phase 4 et 9 |

## Plan de lancement
1. **Pilote fermé** (phase 4) : invitations, 2 ateliers, une zone.
2. **Bêta B2B** : démarchage direct de 20–30 associations, clubs sportifs, PME, événements ; accompagnement personnalisé.
3. **Ouverture publique** FR/EN avec 6–8 produits, contenus créateurs, collaborations avec 3–5 designers.
4. Mesures hebdomadaires : conversion studio → panier, abandon au paiement, délai BAT, défauts, marge par commande, coût IA/commande.
