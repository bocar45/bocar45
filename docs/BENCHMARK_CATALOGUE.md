# Benchmark Vistaprint et catalogue élargi

Source : pages vistaprint.fr consultées le 22/11/2026 (accueil + mugs personnalisés). But : repérer ce qu'ils ont et que SAWWA n'a pas, **sans copier** leur identité ni leurs contenus.

## 1. Ce que Vistaprint fait bien (à adapter)
| Constat | Adaptation SAWWA | Priorité |
|---|---|---|
| **Produits prêts à personnaliser** : on clique sur un mug, on choisit un modèle, on ajoute sa photo et son texte | **Modèles SAWWA** : designs prêts avec emplacements photo/texte ; parcours guidé en 3 étapes, puis « Modifier dans le studio » si on veut aller plus loin (voir §3) | **M** |
| Variantes d'un même produit (mug standard, magique thermoréactif, XXL, cœur, empilable ; impression recto verso ou panoramique) | Un produit de référence = plusieurs variantes de forme et de zone ; le catalogue en tient déjà compte | M |
| **Personnalisation par noms** : plusieurs mugs avec des prénoms différents dans une seule commande | Déjà prévu (noms/numéros individuels) → **remonté en M** : clé pour équipes, mariages, entreprises | M |
| Grille de quantités avec repère « Recommandé » et guide des prix | Sélecteur de quantités avec prix unitaire par palier affiché en clair (eux ne l'affichent pas ; nous oui : avantage) | M |
| Devis au-delà d'un seuil | Déjà prévu | M |
| Bandeau de réassurance sous la bannière (livraison offerte dès X €, contact, « créez vous-même ou avec de l'aide ») | Bandeau SAWWA : BAT vérifié par l'atelier · livraison · aide d'un designer · paiement sécurisé | M |
| **Faire appel à un graphiste** | **Designers SAWWA** : réseau de graphistes, beaucoup d'Afrique de l'Ouest, rémunérés à la prestation. Revenu de service + communauté + contenu | S |
| Créateur de logo par IA | Phase IA (génération de pistes, puis redessin humain si besoin) | L |
| Kits d'échantillons gratuits pour entreprises | Kit d'échantillons textiles (matières, broderie, DTG) payant puis remboursé sur la 1re commande B2B | S |
| Livraison express | Option express si l'atelier la déclare (supplément dans le moteur de prix) | S |
| Collections thématiques et occasions | **Occasions locales** : mariages, baptêmes, Tabaski, Korité, Magal, rentrée, fêtes de fin d'année, Saint-Valentin, fête des mères, événements sportifs | M |
| Galerie de créations clients (#FaitAvecVistaPrint) | **#FaitAvecSAWWA** : galerie avec accord du client, alimentée aussi par les designers | S |
| Offre entreprise (plateforme, devis, revendeur) | Espace **Organisation** : palette et logos enregistrés, recommande, plusieurs commandeurs, facture | S |

## 2. Ce que nous ne copions pas
- **La largeur du catalogue au lancement** : Vistaprint couvre l'imprimerie papier, la signalétique, le packaging, les sites web. C'est 30 ans de fournisseurs. SAWWA démarre plus étroit et sort d'abord les familles que ses ateliers savent produire.
- L'esthétique promotionnelle (« jusqu'à -35 % », Black Friday en permanence) : contraire au positionnement premium.
- Les services hors cœur (sites web, noms de domaine, e-mail).

## 3. Modèles prêts à personnaliser — fonctionnement
**Parcours client (exemple : mug photo)**
1. Catalogue → « Mug photo » → galerie de modèles (filtres : occasion, style, couleur).
2. Clic sur un modèle → **assistant** : « Ajoutez votre photo » (import, recadrage automatique sur le visage), « Votre texte » (prénom, date, message).
3. Aperçu immédiat en **3D** (mug qui tourne).
4. Choix : **Commander** ou **Modifier dans le studio** (accès complet aux calques).

**Ce qu'est un modèle techniquement** : un document de design SAWWA avec des éléments marqués comme
- `photoSlot` : emplacement photo (masque, recadrage, résolution minimale),
- `textField` : texte modifiable (longueur max, police imposée ou non),
- `locked` : élément décoratif verrouillé (motif, cadre),
- `variable` : champ par exemplaire (prénom, numéro) pour les commandes groupées.

Le même modèle peut se décliner sur plusieurs produits (mug, coussin, t-shirt) si ses zones sont compatibles : « Ce design existe aussi sur… ».

**Qui crée les modèles** : l'équipe SAWWA au départ (30–60 modèles au lancement), puis les **designers partenaires** rémunérés par commande (royalty). C'est aussi l'amorce des boutiques créateurs prévues en V2.

Table ajoutée au modèle de données : `templates` (id, base_product_ids[], document avec slots, tags occasion/style, author_id, royalty_rate, status, popularity).

## 4. Catalogue cible par univers
Légende : **V1** lancement · **V1.x** dans les 6 mois · **V2** plus tard · ✖ hors cible.

| Univers | Produits | Phase |
|---|---|---|
| **Vêtements** | T-shirts homme/femme/enfant (col rond, col V, manches longues), polos, sweats, hoodies | V1 |
| | Débardeurs, vestes, joggings, tabliers (restauration, artisans), vêtements de travail | V1.x |
| | **Tenues d'équipe** (maillots foot/basket avec noms et numéros) | V1.x |
| **Accessoires** | Tote bags, casquettes | V1 |
| | Bonnets, sacs à dos, sacs à cordon, chaussettes personnalisées, **patchs brodés** | V1.x |
| **Cadeaux photo** | Mugs (standard, magique, XXL), coussins | V1 |
| | Plaids, puzzles, toiles et posters, plaques photo, boules de Noël, carnets | V1.x |
| **Objets publicitaires** | Gourdes, tasses de voyage | V1 |
| | Stylos, porte-clés, tapis de souris, carnets, produits gravés | V1.x |
| **Petits imprimés** (via imprimeur partenaire) | Stickers et étiquettes, cartes de visite, flyers | V1.x — cohérent avec un **« kit de marque »** : logo → t-shirts + stickers + cartes + tote |
| **Événementiel** | Roll-ups, banderoles, drapeaux, nappes | V2 (logistique volumineuse) |
| **Packaging** | Sacs papier, boîtes d'expédition, papier de soie | V2 (pour les marques créées sur SAWWA) |
| **Faire-part et papeterie** | Mariage, baptême, invitations | V2 (fort potentiel en Afrique de l'Ouest) |
| **Chaussures** | — | ✖ pour l'instant |
| **Sites web, domaines** | — | ✖ |

Ajouter une famille reste une opération d'administration (produit de référence + zones + mockups/3D + offres ateliers), sans développement, à condition qu'un atelier partenaire sache la produire.

## 5. Page d'accueil SAWWA (ordre proposé)
1. Bannière : promesse + « Ouvrir le studio » + « Devis pour une équipe ».
2. Bandeau de réassurance (BAT vérifié, livraison, aide designer, paiement sécurisé).
3. Univers (vêtements, accessoires, cadeaux photo, objets, équipes et entreprises).
4. **Occasions du moment** (calendrier local : Tabaski, rentrée, fin d'année…).
5. Modèles populaires prêts à personnaliser.
6. « Voir en 3D » : démonstration du mannequin qui porte une création.
7. Pour les organisations : commandes d'équipe, kit de marque, échantillons.
8. Designers SAWWA : collections signées.
9. #FaitAvecSAWWA.
10. Comment ça marche (créer → vérifier → fabriquer → livrer).
