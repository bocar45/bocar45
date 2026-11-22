# Décisions

Statuts : 🟡 **à arbitrer** · 🟢 validée (D1–D13 validées le 22/11/2026) · 🔴 rejetée · ⚪ remplacée.
Format : problème → recommandation → alternatives → coût → avis CTO.

---

## D1 🟢 Marché de lancement — **Sénégal / UEMOA** (validé le 22/11/2026)
- **Choix** : facturation au Sénégal, XOF, TVA 18 %, paiement mobile money (Wave, Orange Money) et carte via agrégateur, ateliers à Dakar. Détail : `MARCHE_SENEGAL.md`.

*Analyse initiale :*
- **Problème** : paiement, fiscalité, ateliers, logistique et langue dépendent du premier marché.
- **Recommandation** : lancer **un seul marché de facturation**, celui où se trouvent ton entité juridique et tes deux premiers ateliers. Si c'est la France : Stripe, TVA FR, ateliers FR, livraison UE ; l'identité ouest-africaine reste la signature de marque. Si c'est le Sénégal : mobile money (Wave/Orange Money via agrégateur), XOF, ateliers à Dakar, livraison locale. Structure multi-pays prête dans les deux cas.
- **Alternatives** : double lancement France + Sénégal (×2 sur paiement, fiscalité, logistique, support).
- **Avis CTO** : un seul marché au départ. Le second suit après le pilote (phase 10).
- **J'ai besoin de** : pays de l'entité juridique, localisation des ateliers pressentis.

## D2 🟢 Modèle juridique : revendeur ou marketplace
- **Recommandation** : **SAWWA revendeur** (merchant of record), ateliers sous-traitants. Détail : `AUDIT.md §2.1`, `BUSINESS_MODEL.md §3`.
- **Alternative** : marketplace pure avec commission (Stripe Connect).
- **Coût** : revendeur = TVA et garantie portées par SAWWA, mais intégration paiement plus simple et revenu par commande ~×2.
- **Avis CTO** : revendeur en V1 ; marketplace pour les boutiques créateurs en V2. À confirmer avec ton expert-comptable.

## D3 🟢 Catalogue de référence SAWWA + offres ateliers
- **Recommandation** : SAWWA gère les produits de référence (zones, mockups, 3D) ; les ateliers y attachent des offres (prix, variantes, techniques, délais). Produits inédits sur demande validée.
- **Alternative** : chaque atelier crée librement ses produits (doublons, pas de 3D/mockups cohérents, pas de routage).
- **Avis CTO** : fortement recommandé ; c'est ce qui rend le studio, la 3D et le routage possibles.

## D4 🟢 Le client ne choisit pas l'atelier
- **Recommandation** : SAWWA affecte (semi-automatique en V1). L'atelier n'est pas affiché sur la fiche produit (éventuellement « fabriqué à Dakar / en France »).
- **Alternative** : choix de l'atelier par le client.
- **Avis CTO** : routage SAWWA. Garde la maîtrise de la qualité et du prix.

## D5 🟢 Paiement — agrégateur UEMOA (Wave, Orange Money, cartes), acompte B2B, pas de paiement à la livraison pour le personnalisé

*Analyse initiale :*
- **Recommandation** : Stripe (cartes, Apple/Google Pay, SEPA pour le B2B) si marché UE ; agrégateur UEMOA (CinetPay, PayDunya ou Wave Business — à comparer sur devis) si marché Sénégal. Interface `PaymentProvider` commune. Virement bancaire pour les devis B2B importants.
- **Avis CTO** : le mode test seulement jusqu'à ton feu vert pour le pilote.

## D6 ⚪ Périmètre rendu 3D (remplacée par D6b)
- **Recommandation** : V1 mockups photo réalistes pour tout ; 3D pour mug (phase 7), gourde et casquette ; turntable vêtement en V2 sur t-shirt et hoodie. Pas de mannequin animé en V1.
- **Coût** : mockups ≈ 150–400 € par produit ; 3D objet rigide ≈ 300–800 € ; vêtement animé ≈ 1 500–5 000 €.
- **Avis CTO** : les mockups photo convertissent aussi bien et coûtent 10× moins ; la 3D vient quand le catalogue est stable.

## D6b 🟢 3D complète en visualisation, mannequin homme/femme
- **Demande** (22/11/2026) : édition en 2D, visualisation en 3D (rotation, zoom), mannequin homme ou femme qui porte et fait bouger le vêtement.
- **Recommandation** : visionneuse 3D intégrée au studio (mode « Produit » + mode « Porté »), **humains numériques photoréalistes** (casting de 8 personnes de toutes origines : africaines, arabes, métisses, claires ; 2 corps de base partagés), tailles, 5 animations, rendu photo studio côté serveur ; vêtements skinnés d'abord, simulation textile pré-calculée pour les animations vitrines. Production des assets en **piste parallèle dès la phase 1**. Détail : `VISUALISATION_3D.md`.
- **Coût** : ≈ 25–60 k€ pour le premier lot (≈ 15–30 k€ en variante 4 personnes) ; fonctionnement quasi nul.
- **Avis CTO** : faisable et différenciant si l'on limite le « porté » aux best-sellers (t-shirt, hoodie, polo) et que l'on garde un repli 2D.

## D7 🟢 Périmètre IA V1
- **Recommandation** : V1 = détourage (navigateur) + pré-contrôle intelligent. Génération d'illustrations/motifs en phase 8 avec quotas et crédits. Pas de « logo vectoriel brodable » généré.
- **Avis CTO** : l'IA générative est un bon argument marketing, mais elle ne sauve pas un studio ou un prix médiocre. On la branche sur un socle mesuré.

## D8b 🟢 Supabase + Vercel (choix du porteur, 22/11/2026)
- **Choix** : **Supabase** (PostgreSQL, Auth, Storage, Realtime, files de tâches) + **Vercel** (application Next.js). Remplace Drizzle, Better Auth, pg-boss et R2 de la proposition initiale.
- **Règles qui restent** : la logique métier vit dans nos paquets TypeScript (`pricing`, `workflow`…), pas dans la base. La sécurité par lignes (RLS) de Supabase sert de **deuxième barrière**, en plus des vérifications serveur.
- **Migrations** : SQL versionné dans `supabase/migrations`, types TypeScript générés depuis la base.
- **Connexion** : Supabase Auth par **téléphone + code** (SMS ou WhatsApp via le fournisseur SMS configuré dans Supabase) et par e-mail en secours.
- **Fichiers** : Supabase Storage (buckets privés + URLs signées). Les fichiers 3D lourds pourront passer sur un CDN sans frais de sortie si le trafic l'exige.
- **Rendus lourds** (exports 300 dpi, photo studio 3D) : fonctions Node sur Vercel au début ; worker dédié si la charge le demande.
- **Régions** : Supabase eu-west-3 (Paris) et Vercel cdg1 (Paris), les plus proches de Dakar parmi les offres disponibles.
- **Coût** : Supabase Pro ≈ 25 $/mois, Vercel Pro ≈ 20 $/mois par membre (l'offre gratuite Vercel interdit l'usage commercial). Plus le fournisseur SMS/WhatsApp à l'usage.
- **Création des comptes et des projets** : faite par le porteur du projet (ou sur son accord explicite). Rien n'est créé ni déployé sans son feu vert.

## D8 ⚪ Stack et hébergement (remplacée par D8b)
- **Recommandation** : TypeScript, Next.js, PostgreSQL + Drizzle, pg-boss, Cloudflare R2, Better Auth, Fabric.js, React Three Fiber. Hébergement UE (Vercel ou conteneurs Scaleway/Fly + Postgres managé UE). Détail : `ARCHITECTURE.md`.
- **Alternative** : Supabase (Postgres + Auth + Storage tout-en-un) — plus rapide à démarrer, compatible avec cette architecture si l'on garde la logique métier dans nos paquets et pas dans la base. Acceptable si tu préfères un seul fournisseur.
- **Avis CTO** : recommandation ci-dessus ; Supabase est un plan B honorable.

## D9 🟢 Priorité B2B
- **Recommandation** : traiter les commandes d'équipe/organisations (répartition par tailles, devis, broderie) comme cœur de la V1, et le B2C comme vitrine.
- **Avis CTO** : c'est ce qui rend le modèle viable avant d'avoir un budget d'acquisition.

## D10 🟢 Identité : ajustements proposés
- Ajout d'une couleur **indigo** fonctionnelle et de teintes d'accessibilité (terracotta-700, olive-700, sable-700).
- Typographies : Fraunces (titres éditoriaux) + Manrope (interface), ou alternative tout-géométrique Jost + Manrope.
- Mot SAWWA conservé tel que dessiné dans le logo fourni.
- Recherche d'antériorité de marque avant dépenses marketing.
- Logo reçu le 22/11/2026 et audité (`LOGO_AUDIT.md`). **Consigne du porteur : ne pas dénaturer le logo ni le SW, préserver la touche calligraphique arabe.** → vectorisation fidèle ; simplifications réservées aux versions techniques (broderie, icône).
- Palette alignée sur le logo : terracotta #B5562A (action #93421D, blanc 6,9:1), brun de marque #2A1A12, ajout **ocre #B07A2A** (décoratif).

## D11 🟢 Ordre de développement
- **Recommandation** : tranche verticale (1 produit, 1 atelier, studio → livraison réelle) avant d'élargir. Voir `ROADMAP.md`.
- **Alternative** : phases horizontales du dossier initial.

## D12 🟢 Modèles prêts à personnaliser et catalogue élargi
- **Demande** : s'inspirer de Vistaprint (produits prédéfinis, ex. mug photo où l'on ajoute sa photo).
- **Recommandation** : système de **modèles** (emplacements photo/texte, éléments verrouillés, champs par exemplaire) avec parcours guidé puis studio complet ; 30–60 modèles au lancement ; catalogue élargi par univers et occasions locales, progressivement. Détail : `BENCHMARK_CATALOGUE.md`.
- **Avis CTO** : priorité haute. Le parcours guidé convertit mieux que la page blanche pour le grand public ; le studio libre reste pour les créateurs et les organisations.

## D13 🟢 Réseau de designers
- **Recommandation** : graphistes partenaires (dont designers d'Afrique de l'Ouest) qui créent des modèles payés en royalties et proposent un service « Faire appel à un designer ». Phase V1.x.

## D14 🟢 Studio : éditeur SVG natif plutôt que Fabric.js (décision CTO, 22/11/2026)
- **Problème** : `ARCHITECTURE.md` prévoyait Fabric.js comme moteur d'édition, branché sur notre format de document.
- **Choix** : éditeur construit directement en **SVG**, piloté par le SAWWA Design Document (millimètres réels).
- **Pourquoi** : le format est déjà en mm et les fichiers de production seront produits en SVG → ce que voit le client est exactement ce que reçoit l'atelier ; pas de conversion Fabric ↔ document à maintenir ; aucune dépendance lourde ; même code de rendu pour l'aperçu produit (et demain la 3D et l'export).
- **Limites assumées** : pas d'édition de texte directement sur le canevas (le texte se modifie dans le panneau) ; pas d'outils vectoriels avancés. Fabric.js reste une option si ces besoins deviennent prioritaires.
- **Réversible** : oui, le document ne dépend pas de l'éditeur.

## D15 🟢 Pilote : paiement confirmé manuellement, livraison au forfait (décision CTO, 22/11/2026, réversible)
- **Problème** : l'agrégateur de paiement (Wave/Orange Money/carte) demande un compte marchand que SAWWA n'a pas encore ; les tarifs de livraison ne sont pas encore négociés.
- **Choix pour le pilote** : la commande est créée « Paiement attendu » ; SAWWA envoie les instructions de paiement par WhatsApp ; la finance confirme le paiement dans l'admin avec la référence de transaction (journalisé). Livraison : 4 forfaits fixes (retrait gratuit, Dakar 2 000, banlieue 3 000, régions 5 000 FCFA) dans `apps/web/src/lib/shipping.ts`.
- **Ensuite** : webhook de l'agrégateur → `mark_order_paid` automatique ; tarifs de livraison gérés dans l'admin (`shipping_rates`).

## D16 🟢 Prix d'une correction (décision CTO, 22/11/2026)
- **Base de comparaison** : la version commandée et la version corrigée sont chiffrées toutes les deux **avec l'atelier affecté et les règles du jour**. Le supplément mesure donc seulement l'effet de la correction (ex. marquage agrandi), jamais l'écart entre l'atelier retenu au prix initial et l'atelier affecté (cet écart reste à la charge de SAWWA). Si la version commandée ne peut plus être chiffrée chez cet atelier, le montant convenu sert de référence.
- **Faisabilité** : une correction que l'atelier affecté ne sait pas produire est refusée avec un message clair, même si un autre atelier le pourrait (pas de réaffectation silencieuse).
- Une correction qui coûte **autant ou moins** est acceptée sans remboursement de la différence (le prix convenu reste dû).
- Une correction qui coûte **plus** exige l'accord explicite du client sur le montant exact du supplément ; le supplément est enregistré et signalé à la finance (encaissement manuel pendant le pilote).
- La couleur et la répartition par tailles ne changent pas pendant une correction (ce serait une nouvelle commande).
- Chaque version garde son **devis figé** (`order_item_versions.quote`) ; le coût atelier de l'ordre est mis à jour avec celui de la version corrigée.

## D17 🟢 3D : modèles provisoires générés par le code, contrat de calibration fixe (décision CTO, 22/11/2026)
- **Problème** : la 3D en direct est demandée maintenant ; les modèles d'artiste (et les mannequins photoréalistes) demandent un budget et plusieurs semaines.
- **Choix** : vêtements modélisés à partir de leur patron en millimètres (contour réel, panneaux « gonflés », plis légers), mug/gourde/casquette en géométrie simple. Le dessin du studio est peint sur la texture à 2 px/mm avec les vraies polices.
- **Contrat stable** : `placeZone()` (où chaque zone se trouve sur le vêtement) et `uvFor()` sont testés ; les modèles d'artiste devront respecter les mêmes positions, ce qui les rend interchangeables sans toucher au studio.
- **Dépendances** : three 0.187.0, @react-three/fiber 9.8.2, @react-three/drei 10.7.9 (chargées seulement quand la 3D s'ouvre).
