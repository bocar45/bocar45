# Audit du logo SAWWA (référence v0)

Fichier analysé : `design/logo/logo-reference-v0.webp` (image matricielle 1536 × 1024, fournie le 22/11/2026).

## 1. Ce qui fonctionne — à garder
| Élément | Pourquoi c'est bon |
|---|---|
| **S en ruban + W anguleux** | Les deux lettres se lisent. Le contraste courbe/angle raconte bien « façonner » : la matière souple (le tissu, le S) prend une forme construite (le W). |
| **Le losange ocre** | Meilleure idée du logo. Il évoque à la fois le point diacritique de l'écriture arabe et le losange des textiles ouest-africains, sans folklore. Il peut devenir un **atome de marque** autonome (puce, chargement, favicon, étiquette tissée, bouton). |
| **Le mot SAWWA** | Géométrique, solide, lisible. Les **A sans barre avec un losange** sont une signature mémorable et cohérente avec le symbole. Les W pointus donnent du rythme. |
| **Couleurs chaudes** | Brun + terracotta + ocre : cohérent avec la palette de départ. |

## 2. Problèmes à corriger
| # | Problème | Conséquence | Correction |
|---|---|---|---|
| 1 | **Motif intérieur (triangles, points) dans la panse du S** | Disparaît sous 64 px ; **impossible à broder** à 15–30 mm ; c'est aussi l'élément le plus « folklorique », contraire au cadrage. | Retirer du logo principal. Le garder seulement dans une version « signature » grand format (packaging, enseigne) et dans la trame. |
| 2 | **Dégradés et effet de matière** sur le ruban terracotta (de #BB5316 à #7E2E05) | Non reproductible en broderie, sérigraphie, gravure, tampon, fax, monochrome. | Aplats uniquement. Le relief du ruban est rendu par **une coupe nette** (un aplat clair et un aplat foncé), pas par un dégradé. |
| 3 | **Pointes très effilées** (extrémités du S et du W) | Cassent en broderie (le fil ne tient pas sous ~1 mm), bavent en petite impression. | Épaissir les terminaisons : largeur minimale ≈ 4 % de la hauteur du symbole. |
| 4 | **Image générée en matriciel** (bords irréguliers, texture, fond intégré) | Inutilisable en production (pas de vecteur), et une image générée par IA est mal protégée par le droit d'auteur. | **Redessiner entièrement en vectoriel** par un designer. Le dessin humain final est ce qui sera déposé et protégé. |
| 5 | **Trop de losanges** (au-dessus du S, dans le W, dans les deux A) | Le signe perd sa force par répétition. | Symbole : **un seul losange** (celui au-dessus, le « point »). Mot : losanges dans les A conservés. |
| 6 | **Symbole plus large que haut, asymétrique** | S'inscrit mal dans un carré (favicon, icône d'app, avatar réseaux sociaux). | Créer une version **icône** recadrée et rééquilibrée dans un carré. |
| 7 | **Deux S différents** (calligraphique dans le symbole, géométrique carré dans le mot) | Acceptable, mais à assumer. | Garder ; harmoniser les épaisseurs de trait entre symbole et mot. |
| 8 | **Proximité avec des logos génériques** (« swoosh + motif tribal ») | Risque de faible distinctivité lors du dépôt de marque. | Le redessin doit accentuer ce qui est propre à SAWWA (ruban + losange-point). Recherche d'antériorité avant dépôt (classes 25, 35, 40, 42). |

## 3. Système de logo proposé (3 niveaux)
| Niveau | Contenu | Usage | Couleurs |
|---|---|---|---|
| **Signature** | Symbole complet avec motif intérieur simplifié + mot | Packaging, enseigne, événements, très grand format | 3 aplats (brun, terracotta, ocre) |
| **Principal** | Symbole sans motif, terminaisons épaissies, un losange + mot SAWWA | Site, documents, réseaux, étiquettes | 2–3 aplats |
| **Icône** | S+W simplifié dans un carré, ou **losange seul** pour ≤ 24 px | Favicon, app, broderie ≤ 20 mm, tampon | 1 couleur |
Chaque niveau en : horizontal, vertical, positif, négatif (ivoire sur brun), monochrome, et un **fichier de broderie de référence** (testé sur tissu par l'atelier pilote).

## 4. Couleurs relevées dans le logo vs palette du dossier
| Rôle | Logo (relevé) | Palette du dossier | Proposition |
|---|---|---|---|
| Brun | #2A1509 (plus chaud, plus rouge) | #24221F (neutre) | **Adopter le brun du logo** pour la marque (#2A1A12, légèrement adouci) ; garder #24221F pour le texte d'interface |
| Terracotta | #BB5316 (plus orangé, plus saturé) | #B76545 | Choisir **un** terracotta de référence. Je recommande celui du logo, plus vivant : `terracotta-600 #B5562A`, action `terracotta-700 #93421D` (contraste vérifié en phase 1) |
| Ocre (losange) | ≈ #A8671D | absent | **Ajouter `ocre #B07A2A`** (décoratif, losange, médailles, mise en avant) |
| Ivoire | #F8E9D7 | #F2E9D8 | Équivalents, garder #F2E9D8 |

→ Décision **D10** mise à jour.

## 5. Brief de redessin (phase 1)
1. Vectoriser le symbole sur une grille (cercle + diagonales 45°/60°).
2. Aplats uniquement, terminaisons épaissies, un seul losange.
3. Versions Signature / Principal / Icône × déclinaisons.
4. Tests : 16 px, 32 px, broderie 15 mm et 30 mm, sérigraphie 1 couleur, gravure laser sur gourde.
5. Livrables : SVG, PDF vectoriel, PNG, fichier de broderie DST de référence, guide d'usage d'une page.
