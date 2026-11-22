# Livrable B — Proposition produit

Priorités : **M** = indispensable au lancement (MVP) · **S** = juste après le lancement (V1.x) · **L** = plus tard (V2+).

## 1. Piliers fonctionnels
1. Catalogue de référence + offres ateliers.
2. Studio avec pré-contrôle de fabrication.
3. Rendu : mockups 2D réalistes (tous produits), 3D (produits rigides d'abord).
4. Moteur de prix et devis.
5. Workflow de commande et BAT.
6. Portail atelier.
7. Administration et finances.
8. Assistance IA (progressive).

## 2. Périmètre produits du lancement (proposition)
> Catalogue cible élargi après le benchmark Vistaprint : voir `BENCHMARK_CATALOGUE.md §4`. 3D et mannequins : `VISUALISATION_3D.md`.

| Produit de référence | Techniques V1 | Rendu V1 | 3D |
|---|---|---|---|
| T-shirt col rond coton 180 g (H/F) | DTG, DTF, broderie (cœur) | Mockups + 3D produit | Mannequin H/F (phase 5) |
| Hoodie molleton 300 g | DTF, broderie | Mockups + 3D produit | Mannequin H/F (phase 5) |
| Polo piqué | Broderie | Mockups photo | L |
| Casquette 6 pans | Broderie face/côtés | Mockups + **3D** | S |
| Tote bag coton | Sérigraphie (lot), DTF | Mockups | L |
| Mug céramique 33 cl (standard, magique) | Sublimation | **3D rotation** | M |
| Coussin | Sublimation | Mockups + 3D | S |
| Gourde inox | Gravure / UV | 3D | S |

Ajouter une famille = créer un produit de référence en admin (zones, vues, mockups), pas de code.

## 3. Parcours client
```
Accueil → Catalogue (filtres : usage, technique, délai, prix)
       → Fiche produit (variantes, techniques compatibles, zones, délai, prix « à partir de »)
       → Studio (zone active, outils, pré-contrôle en direct, prix en direct)
       → Aperçu (mockups / 3D)
       → Quantités & tailles (unitaire ou répartition d'équipe)
       → Panier → Paiement → Suivi (BAT, production, expédition)
```
Chemin B2B alternatif : « Devis équipe » → formulaire guidé (quantités, logo importé, deadline) → devis sous 24 h → paiement en ligne ou virement.

| Fonction | Priorité |
|---|---|
| Accueil, catalogue, fiche produit, recherche | M |
| Studio (voir §5) | M |
| Mockups 2D réalistes | M |
| Prix en direct dans le studio | M |
| Panier, paiement carte, emails transactionnels | M |
| Compte : créations, commandes, adresses, factures | M |
| Suivi de commande avec BAT (accepter / modifier) | M |
| Répartition par tailles (commande d'équipe) | M |
| Demande de devis | M (formulaire) → S (devis en ligne) |
| Lien de partage privé d'une création | S |
| Noms/numéros individuels (personnalisation variable) | M |
| **Modèles prêts à personnaliser** (assistant photo/texte → studio) | M |
| Occasions locales (collections) | M |
| Visionneuse 3D « Produit » (mug, t-shirt) | M |
| Mannequin homme/femme, teintes de peau, animations | S (piste 3D parallèle) |
| Faire appel à un designer SAWWA | S |
| Kit d'échantillons | S |
| Réclamation avec photos | M |
| Notifications WhatsApp | S |
| Mobile money | Selon D1 |
| Inspirations / modèles de départ éditables | S |
| IA : détourage d'image | M (bon rapport valeur/coût) |
| IA : génération d'illustrations/motifs | S |
| Boutiques créateurs et royalties | L |

## 4. Parcours atelier (portail « SAWWA Pro »)
```
Candidature → Vérification (documents, commande test) → Activation
→ Offres : sélection de produits de référence, variantes, techniques par zone, grilles de prix, délais, capacité
→ File de travail : Nouvelles → À valider (BAT) → En production → Prêtes à expédier → Expédiées
→ Paiements : relevés, factures (auto-facturation), virements
```
| Fonction | Priorité |
|---|---|
| Profil entreprise, documents, statut de validation | M |
| Offres sur produits de référence + grilles tarifaires | M (saisie possible par l'admin au début) |
| Demande de nouveau produit de référence | S |
| File de commandes avec filtres et SLA visibles | M |
| Fiche ordre : design, fichiers de production téléchargeables, fiche technique (dimensions réelles, position, couleurs, technique) | M |
| BAT : accepter / demander correction (motif normé + commentaire + annotation) / refuser | M |
| Production → QC (photo obligatoire) → expédition (transporteur + suivi) | M |
| Messagerie liée à l'ordre (client ↔ SAWWA ↔ atelier, modérée) | M (atelier ↔ SAWWA) / S (avec client) |
| Capacité et jours de fermeture | S |
| Tableau de bord revenus, statistiques | S |
| Gestion de stock réel (optionnelle par offre) | S |
| Multi-utilisateurs par atelier (rôles opérateur / gérant) | S |

**Note** : le client ne communique pas directement avec l'atelier en V1. SAWWA reste l'interlocuteur (contrôle qualité, protection contre le contournement de la plateforme).

## 5. Studio — spécification fonctionnelle
- **Zones** : onglets par vue (devant, dos, manche…). Chaque zone affiche son cadre imprimable réel (mm) et sa technique.
- **Outils (M)** : texte (polices sous licence libre, taille, couleur, interlettrage, alignement, texte courbé en S), import d'image (PNG, JPG, SVG, PDF 1 page, ≤ 25 Mo), formes simples, bibliothèque d'éléments SAWWA (motifs, icônes), calques (ordre, verrouillage, visibilité), déplacer/redimensionner/pivoter, aligner/centrer dans la zone, dupliquer/supprimer, annuler/rétablir illimité dans la session, sauvegarde automatique.
- **Pré-contrôle en direct (M)** : DPI effectif à la taille réelle (vert ≥ 200, orange 150–200, rouge < 150), élément hors zone, couleurs > limite de la technique, trait < 0,5 mm (broderie < 1 mm, texte < 5 mm de hauteur), transparence partielle en sérigraphie, image avec fond (proposer le détourage).
- **Prix en direct (M)** : recalcul à chaque changement significatif (débounce), détail par zone.
- **S** : texte en arc, groupes, guides magnétiques, palettes de marque (B2B), modèles de départ, verrouillage d'éléments pour des modèles d'équipe.
- **L** : édition vectorielle avancée (plumes, booléens).

## 6. Parcours administration
| Module | Fonctions | Priorité |
|---|---|---|
| Tableau de bord | Commandes du jour, ordres en retard sur SLA, BAT en attente, incidents, CA, marge | M |
| Commandes | Vue liste/kanban, détail avec chronologie complète, réaffectation, annulation, remboursement, note interne | M |
| Routage | Proposition d'ateliers compatibles triés (coût, délai, charge), validation manuelle | M |
| Catalogue | Produits de référence, vues, zones, mockups, modèles 3D, catégories, techniques | M |
| Ateliers | Candidatures, validation, suspension, offres, performance | M |
| Tarification | Règles de marge, frais, livraison, codes promo, historique des versions, simulateur de prix | M |
| Clients | Recherche, historique, support ; accès aux données personnelles journalisé | M |
| Support / litiges | Tickets liés aux commandes, reprises, remboursements | M |
| Modération | Signalements, file des imports suspects | S |
| Finances | Relevés ateliers, virements, export comptable, TVA | M (export) / S (rapprochement) |
| Statistiques | Conversion, abandon studio, techniques, coûts IA/stockage | S |
| Rôles | Super admin, ops commandes, catalogue, ateliers, support, finance (RBAC) | M |
| Journal d'audit | Toute action sensible horodatée, acteur, avant/après | M |

## 7. Workflow de commande (statuts)
**Commande client** : `draft → awaiting_payment → paid → in_fulfillment → partially_shipped → shipped → delivered → closed` (+ `cancelled`, `refunded`, `partially_refunded`).

**Ordre de fabrication (par atelier)** :
```
pending_assignment → assigned → proof_review ──► proof_approved → in_production → quality_check → shipped → delivered
                                   │  ▲
                                   ▼  │
                            changes_requested (client modifie ou annule)
assigned/proof_review → rejected_by_vendor → pending_assignment (réaffectation)
toute étape → on_hold (admin) | cancelled
```
Chaque transition : acteur autorisé, préconditions, effets (notification, paiement, horodatage), SLA (ex. `assigned` → acceptation sous 24 h ouvrées sinon alerte admin).

## 8. Fonctionnalités explicitement reportées
Chaussures · simulation textile en temps réel · marketplace ouverte · boutiques créateurs · abonnements vendeurs · options de visibilité payantes · génération de logos vectoriels · multi-pays fiscal complet · application mobile native (le web responsive suffit, PWA possible).
