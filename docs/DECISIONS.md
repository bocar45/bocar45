# Décisions

Statuts : 🟡 **à arbitrer** · 🟢 validée · 🔴 rejetée · ⚪ remplacée.
Format : problème → recommandation → alternatives → coût → avis CTO.

---

## D1 🟡 Marché de lancement
- **Problème** : paiement, fiscalité, ateliers, logistique et langue dépendent du premier marché.
- **Recommandation** : lancer **un seul marché de facturation**, celui où se trouvent ton entité juridique et tes deux premiers ateliers. Si c'est la France : Stripe, TVA FR, ateliers FR, livraison UE ; l'identité ouest-africaine reste la signature de marque. Si c'est le Sénégal : mobile money (Wave/Orange Money via agrégateur), XOF, ateliers à Dakar, livraison locale. Structure multi-pays prête dans les deux cas.
- **Alternatives** : double lancement France + Sénégal (×2 sur paiement, fiscalité, logistique, support).
- **Avis CTO** : un seul marché au départ. Le second suit après le pilote (phase 10).
- **J'ai besoin de** : pays de l'entité juridique, localisation des ateliers pressentis.

## D2 🟡 Modèle juridique : revendeur ou marketplace
- **Recommandation** : **SAWWA revendeur** (merchant of record), ateliers sous-traitants. Détail : `AUDIT.md §2.1`, `BUSINESS_MODEL.md §3`.
- **Alternative** : marketplace pure avec commission (Stripe Connect).
- **Coût** : revendeur = TVA et garantie portées par SAWWA, mais intégration paiement plus simple et revenu par commande ~×2.
- **Avis CTO** : revendeur en V1 ; marketplace pour les boutiques créateurs en V2. À confirmer avec ton expert-comptable.

## D3 🟡 Catalogue de référence SAWWA + offres ateliers
- **Recommandation** : SAWWA gère les produits de référence (zones, mockups, 3D) ; les ateliers y attachent des offres (prix, variantes, techniques, délais). Produits inédits sur demande validée.
- **Alternative** : chaque atelier crée librement ses produits (doublons, pas de 3D/mockups cohérents, pas de routage).
- **Avis CTO** : fortement recommandé ; c'est ce qui rend le studio, la 3D et le routage possibles.

## D4 🟡 Le client ne choisit pas l'atelier
- **Recommandation** : SAWWA affecte (semi-automatique en V1). L'atelier n'est pas affiché sur la fiche produit (éventuellement « fabriqué à Dakar / en France »).
- **Alternative** : choix de l'atelier par le client.
- **Avis CTO** : routage SAWWA. Garde la maîtrise de la qualité et du prix.

## D5 🟡 Paiement
- **Recommandation** : Stripe (cartes, Apple/Google Pay, SEPA pour le B2B) si marché UE ; agrégateur UEMOA (CinetPay, PayDunya ou Wave Business — à comparer sur devis) si marché Sénégal. Interface `PaymentProvider` commune. Virement bancaire pour les devis B2B importants.
- **Avis CTO** : le mode test seulement jusqu'à ton feu vert pour le pilote.

## D6 ⚪ Périmètre rendu 3D (remplacée par D6b)
- **Recommandation** : V1 mockups photo réalistes pour tout ; 3D pour mug (phase 7), gourde et casquette ; turntable vêtement en V2 sur t-shirt et hoodie. Pas de mannequin animé en V1.
- **Coût** : mockups ≈ 150–400 € par produit ; 3D objet rigide ≈ 300–800 € ; vêtement animé ≈ 1 500–5 000 €.
- **Avis CTO** : les mockups photo convertissent aussi bien et coûtent 10× moins ; la 3D vient quand le catalogue est stable.

## D6b 🟡 3D complète en visualisation, mannequin homme/femme
- **Demande** (22/11/2026) : édition en 2D, visualisation en 3D (rotation, zoom), mannequin homme ou femme qui porte et fait bouger le vêtement.
- **Recommandation** : visionneuse 3D intégrée au studio (mode « Produit » + mode « Porté »), 2 avatars riggés, 5 teintes de peau, tailles, 5 animations ; vêtements skinnés d'abord, simulation textile pré-calculée pour les animations vitrines. Production des assets en **piste parallèle dès la phase 1**. Détail : `VISUALISATION_3D.md`.
- **Coût** : ≈ 10–25 k€ pour le premier lot d'assets ; coût de fonctionnement quasi nul.
- **Avis CTO** : faisable et différenciant si l'on limite le « porté » aux best-sellers (t-shirt, hoodie, polo) et que l'on garde un repli 2D.

## D7 🟡 Périmètre IA V1
- **Recommandation** : V1 = détourage (navigateur) + pré-contrôle intelligent. Génération d'illustrations/motifs en phase 8 avec quotas et crédits. Pas de « logo vectoriel brodable » généré.
- **Avis CTO** : l'IA générative est un bon argument marketing, mais elle ne sauve pas un studio ou un prix médiocre. On la branche sur un socle mesuré.

## D8 🟡 Stack et hébergement
- **Recommandation** : TypeScript, Next.js, PostgreSQL + Drizzle, pg-boss, Cloudflare R2, Better Auth, Fabric.js, React Three Fiber. Hébergement UE (Vercel ou conteneurs Scaleway/Fly + Postgres managé UE). Détail : `ARCHITECTURE.md`.
- **Alternative** : Supabase (Postgres + Auth + Storage tout-en-un) — plus rapide à démarrer, compatible avec cette architecture si l'on garde la logique métier dans nos paquets et pas dans la base. Acceptable si tu préfères un seul fournisseur.
- **Avis CTO** : recommandation ci-dessus ; Supabase est un plan B honorable.

## D9 🟡 Priorité B2B
- **Recommandation** : traiter les commandes d'équipe/organisations (répartition par tailles, devis, broderie) comme cœur de la V1, et le B2C comme vitrine.
- **Avis CTO** : c'est ce qui rend le modèle viable avant d'avoir un budget d'acquisition.

## D10 🟡 Identité : ajustements proposés
- Ajout d'une couleur **indigo** fonctionnelle et de teintes d'accessibilité (terracotta-700, olive-700, sable-700).
- Typographies : Fraunces (titres éditoriaux) + Manrope (interface), ou alternative tout-géométrique Jost + Manrope.
- Mot SAWWA dessiné sur mesure (W tronqués).
- Recherche d'antériorité de marque avant dépenses marketing.
- Logo reçu le 22/11/2026 et audité (`LOGO_AUDIT.md`) : garder S-ruban + W + losange, redessiner en vectoriel, aplats, retirer le motif intérieur du logo principal, système à 3 niveaux.
- Palette alignée sur le logo : terracotta #B5562A (action #93421D, blanc 6,9:1), brun de marque #2A1A12, ajout **ocre #B07A2A** (décoratif).

## D11 🟡 Ordre de développement
- **Recommandation** : tranche verticale (1 produit, 1 atelier, studio → livraison réelle) avant d'élargir. Voir `ROADMAP.md`.
- **Alternative** : phases horizontales du dossier initial.

## D12 🟡 Modèles prêts à personnaliser et catalogue élargi
- **Demande** : s'inspirer de Vistaprint (produits prédéfinis, ex. mug photo où l'on ajoute sa photo).
- **Recommandation** : système de **modèles** (emplacements photo/texte, éléments verrouillés, champs par exemplaire) avec parcours guidé puis studio complet ; 30–60 modèles au lancement ; catalogue élargi par univers et occasions locales, progressivement. Détail : `BENCHMARK_CATALOGUE.md`.
- **Avis CTO** : priorité haute. Le parcours guidé convertit mieux que la page blanche pour le grand public ; le studio libre reste pour les créateurs et les organisations.

## D13 🟡 Réseau de designers
- **Recommandation** : graphistes partenaires (dont designers d'Afrique de l'Ouest) qui créent des modèles payés en royalties et proposent un service « Faire appel à un designer ». Phase V1.x.
