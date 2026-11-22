# Audit du logo SAWWA (référence v0)

Fichier analysé : `design/logo/logo-reference-v0.webp` (image matricielle 1536 × 1024, fournie le 22/11/2026).

## 1. Ce qui fonctionne — à garder
| Élément | Pourquoi c'est bon |
|---|---|
| **S en ruban + W anguleux** | Les deux lettres se lisent. Le contraste courbe/angle raconte bien « façonner » : la matière souple (le tissu, le S) prend une forme construite (le W). |
| **Le losange ocre** | Meilleure idée du logo. Il évoque à la fois le point diacritique de l'écriture arabe et le losange des textiles ouest-africains, sans folklore. Il peut devenir un **atome de marque** autonome (puce, chargement, favicon, étiquette tissée, bouton). |
| **Le mot SAWWA** | Géométrique, solide, lisible. Les **A sans barre avec un losange** sont une signature mémorable et cohérente avec le symbole. Les W pointus donnent du rythme. |
| **Couleurs chaudes** | Brun + terracotta + ocre : cohérent avec la palette de départ. |

## 2. Principe directeur : fidélité
**Consigne du porteur du projet (22/11/2026)** : ne pas dénaturer le logo ni le SW ; la touche calligraphique arabe est essentielle.

Ce qui fait cette touche et qui ne doit **pas** changer :
- le **S en ruban à épaisseur variable** (plein et délié, comme un trait de calame), avec son repli qui crée le volume ;
- le **mouvement du W** dont la dernière branche s'envole comme une terminaison calligraphique ;
- le **losange-point** au-dessus du symbole (évocation de la *nuqta*) ;
- la composition générale, les proportions et le rapport symbole/mot.

Le travail consiste donc en une **vectorisation fidèle** (redessin propre des mêmes formes, pas une réinterprétation), plus des **versions techniques** dérivées pour les usages où l'original ne peut pas être reproduit physiquement.

## 3. Ajustements techniques (sans toucher à l'identité)
| # | Constat | Ce que l'on fait dans le logo principal | Ce que l'on fait seulement dans les versions techniques |
|---|---|---|---|
| 1 | Motif intérieur (triangles, points) | **Conservé**, redessiné proprement | Retiré sous 64 px et en broderie < 40 mm |
| 2 | Dégradé du ruban terracotta | Traduit par **2 ou 3 aplats** (clair / foncé) qui gardent l'effet de volume du ruban | Une seule couleur en monochrome |
| 3 | Pointes très effilées | **Gardées effilées** (c'est la calligraphie) ; seule l'extrême pointe est arrondie de façon invisible | Légèrement épaissies pour la broderie (≥ 1 mm au fil) |
| 4 | Image matricielle générée | Redessin vectoriel fidèle par un designer, superposé à l'original pour contrôle | — |
| 5 | Losanges | **Tous conservés** (symbole et mot) | Icône : losange-point seul conservé |
| 6 | Symbole plus large que haut | Inchangé | Version icône : le symbole est recentré dans un carré, sans être redessiné |
| 7 | Antériorité de marque | Recherche INPI/EUIPO/WIPO avant dépôt (classes 25, 35, 40, 42) | — |

**Contrôle de fidélité** : le vecteur final est superposé à l'image d'origine ; l'écart des contours doit rester invisible à taille normale. Tu valides côte à côte avant toute utilisation.

## 3 bis. Déclinaisons
| Version | Contenu | Usage |
|---|---|---|
| **Principale** | Logo complet fidèle (symbole + motif + losanges + SAWWA) en aplats | Site, documents, packaging, réseaux |
| **Symbole** | S+W + losange-point, sans le mot | Réseaux sociaux, tampon, étiquettes |
| **Brodable** | Symbole fidèle, motif retiré sous 40 mm, pointes renforcées | Broderie poitrine, casquette |
| **Icône** | Symbole recentré dans un carré ; sous 24 px, losange seul | Favicon, application |
| Monochrome, négatif (ivoire sur brun) | Toutes les versions | Gravure, sérigraphie 1 couleur, fonds sombres |

## 4. Couleurs relevées dans le logo vs palette du dossier
| Rôle | Logo (relevé) | Palette du dossier | Proposition |
|---|---|---|---|
| Brun | #2A1509 (plus chaud, plus rouge) | #24221F (neutre) | **Adopter le brun du logo** pour la marque (#2A1A12, légèrement adouci) ; garder #24221F pour le texte d'interface |
| Terracotta | #BB5316 (plus orangé, plus saturé) | #B76545 | Choisir **un** terracotta de référence. Je recommande celui du logo, plus vivant : `terracotta-600 #B5562A`, action `terracotta-700 #93421D` (contraste vérifié en phase 1) |
| Ocre (losange) | ≈ #A8671D | absent | **Ajouter `ocre #B07A2A`** (décoratif, losange, médailles, mise en avant) |
| Ivoire | #F8E9D7 | #F2E9D8 | Équivalents, garder #F2E9D8 |

→ Décision **D10** mise à jour.

## 5. Brief de vectorisation (phase 1)
1. Redessiner fidèlement les mêmes formes (calque sur l'original), en conservant le plein-délié calligraphique.
2. Traduire le dégradé en 2–3 aplats ; garder motif et losanges.
3. Dériver les versions Symbole / Brodable / Icône, monochrome et négatif.
4. Tests : 16 px, 32 px, broderie 15 mm et 30 mm, sérigraphie 1 couleur, gravure laser sur gourde.
5. Livrables : SVG, PDF vectoriel, PNG, fichier de broderie DST de référence, guide d'usage d'une page.
