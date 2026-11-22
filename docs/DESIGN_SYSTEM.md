# Livrable C — Direction artistique et design system

Visualisation : `design/maquettes.html` (palette, typographie, trame, maquettes des trois portails).

## 1. Logo SW
**Logo reçu et audité : voir `LOGO_AUDIT.md`** (forces, corrections, système à 3 niveaux, couleurs relevées). Critères de validation du redessin :

| Critère | Test concret |
|---|---|
| Lisibilité S et W | Reconnu par 4 personnes sur 5 sans explication. |
| Petite taille | Lisible en favicon 16×16 px et en broderie 15 mm (≈ 1 500 points). Pas de traits < 1 mm à 15 mm de large. |
| Broderie | ≤ 2 couleurs, pas de dégradé, pas de zones fines entrelacées serrées (le fil ne peut pas passer « dessous »). Un entrelacement S/W doit être traduit par des **coupures nettes** (gaps ≥ 0,8 mm à 15 mm). |
| Monochrome | Fonctionne en un aplat, positif et négatif. |
| Fidélité | Le plein-délié calligraphique du S et l'envol du W sont préservés (consigne du porteur). |
| Unicité | Vérifier l'antériorité (INPI/EUIPO/WIPO, classes 25, 35, 40, 42) avant tout investissement marketing. → **Décision D10.** |

**Mot SAWWA** : on conserve le dessin du logo fourni (A sans barre avec losange, W pointus). Seul ajustement possible : un interlettrage légèrement ouvert pour les petites tailles.

Déclinaisons à produire : principale, horizontale, verticale, symbole seul, mono, clair/sombre, **version brodable**, favicon 16/32, icône d'app (fond terracotta, symbole ivoire).

## 2. Signatures
| Contexte | Signature |
|---|---|
| Site FR, marchés francophones (France, Belgique, UEMOA, Maroc) | *Donner forme aux idées.* |
| Site EN, international, réseaux sociaux globaux | *Give Form to Ideas.* |
| Packaging, étiquette tissée | Anglais seul (universel, court) |
| Présentations investisseurs | Bilingue, FR en titre, EN en sous-titre (ou inverse selon l'audience) |
Jamais les deux côte à côte dans un même bloc courant ; jamais dans le logo.

## 3. Palette — audit d'accessibilité
Contrastes WCAG mesurés sur fond **ivoire #F2E9D8** :

| Couleur | Contraste | Verdict |
|---|---|---|
| Brun #24221F | 13,2:1 | ✅ texte |
| Terracotta #B76545 | 3,5:1 | ⚠️ grands titres et icônes seulement ; **échoue** pour texte courant et texte de bouton |
| Sable #A58B6A | 2,7:1 | ❌ décoratif uniquement |
| Olive #68705A | 4,3:1 | ⚠️ limite (AA exige 4,5) |
| Ivoire sur terracotta (bouton) | 3,5:1 | ❌ texte de bouton illisible pour une partie des utilisateurs |

**Corrections proposées** (la palette d'origine reste la signature de marque ; on ajoute des teintes fonctionnelles) :

| Token | Valeur | Usage | Contraste |
|---|---|---|---|
| `terracotta-600` (marque) | #B76545 | illustrations, grands aplats, icônes | — |
| `terracotta-700` (action) | #9A4E31 | boutons, liens | blanc 6,0:1 · sur ivoire 5,0:1 ✅ |
| `olive-700` | #525944 | succès, texte secondaire | 6,1:1 ✅ |
| `sable-700` | #7A6446 | texte tertiaire | 4,7:1 ✅ |
| **`indigo`** (ajout) | #2F4B7C | information, liens dans l'admin, focus | ✅ |
| `error` | #A4262C + icône | erreurs | ✅ |
| `warning` | #B07A12 + icône | avertissements | grands éléments |
| `paper` (surface) | #FBF7EF | cartes, studio | — |

**Pourquoi l'indigo** : la palette ne contient aucune couleur froide ; or une interface a besoin d'un repère pour l'information et le focus. L'indigo est une couleur textile majeure d'Afrique de l'Ouest (teintures à l'indigo, *garan* de Guinée, *adire*) : il s'ajoute par la culture, pas par la mode.

**Point de vigilance** : terracotta et rouge d'erreur sont proches. Règle : une erreur porte **toujours** une icône et un texte, jamais la couleur seule.

**Mode sombre** : fond brun #1A1917, surfaces #24221F, texte ivoire, action terracotta-400 #D08A6C. Utile pour le studio (les couleurs du design ressortent mieux sur fond neutre sombre) — option utilisateur.

**Interfaces pro/admin** : majoritairement neutres (ivoire très clair / blanc cassé, brun pour le texte), couleur réservée aux statuts. La couleur de marque domine le portail client, pas les outils.

## 4. Typographie (toutes sous licence libre OFL — pas de coût, embarquables dans les exports)
| Rôle | Police | Raison |
|---|---|---|
| Titres éditoriaux (site client) | **Fraunces** (optique « soft ») | Chaleur et caractère premium, contraste avec la géométrie du logo. |
| Interface et texte | **Manrope** | Géométrique humaniste, excellente lisibilité en petite taille, chiffres tabulaires. |
| Données (admin, références) | **JetBrains Mono** | Références de commande, montants alignés. |
| Futur arabe (RTL) | IBM Plex Sans Arabic | Prévu dans les tokens, non chargé en V1. |
Alternative tout-géométrique (si Fraunces est jugé trop éditorial) : **Jost** pour les titres. → **Décision D10.**

Polices du **studio** (pour les clients) : catalogue séparé de ~30 polices OFL sélectionnées, dont des polices aux formes inspirées des écritures et signalétiques africaines contemporaines. Toutes stockées localement (pas d'appel Google Fonts au rendu de production).

## 5. Trame SAWWA (motifs)
Un système de motifs **dérivé du symbole SW** et de la grille de construction (cercle, diagonales) : bandes, damiers et chevrons inspirés du tissage en bandes (strip weaving) et des pavages géométriques, sans copier de motifs identitaires ou sacrés (bogolan spécifiques, kente de lignées, etc.).
- Usage : fonds de section, états vides, chargements, packaging, étiquettes.
- Jamais derrière du texte courant. Opacité ≤ 12 % sur les interfaces.
- Les motifs proposés aux clients dans le studio seront **commandés à des designers africains crédités** (et rémunérés). Argument de marque, et protection contre l'appropriation maladroite.

## 6. Tokens (extrait)
```
espacement : 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96
rayons     : 2 (champs admin) · 6 (boutons) · 12 (cartes client) · 999 (pastilles)
échelle    : 12 · 14 · 16 · 18 · 22 · 28 · 36 · 48 · 64 (ratio ~1,25)
ombres     : une seule, réservée aux éléments flottants (menus, panneaux du studio)
mouvement  : 150 ms (micro), 250 ms (panneaux), 600 ms (transitions de mockup) ; respect de prefers-reduced-motion
```
Implémentation : tokens en variables CSS + Tailwind, composants accessibles (Radix UI / shadcn), documentés dans Storybook à partir de la phase 2.

## 7. Ambiance par espace
| Espace | Ambiance | Navigation |
|---|---|---|
| Client | Éditorial, photographique, aéré, terracotta dominant, trame en accents | Barre supérieure, mega-menu catalogue, CTA « Créer » permanent |
| Studio | Outil : neutre, canvas central, panneaux latéraux, couleur réservée à l'action et aux alertes | Barre d'outils gauche, propriétés droite, vues en bas, prix en haut |
| Pro (ateliers) | Opérationnel, lisible sur tablette en atelier, gros boutons d'état, SLA visibles | Barre latérale courte (File, Offres, Paiements, Profil) |
| Admin | Dense, tableaux, filtres, chiffres tabulaires, peu de couleur hors statuts | Barre latérale complète par module, recherche globale (⌘K) |

## 8. Expérience du studio (principes)
1. **On commence par le produit, pas par la page blanche** : le produit est déjà là, la zone principale sélectionnée, un bouton « Ajouter un texte » et « Importer une image » au centre.
2. **La contrainte est visible** : le cadre imprimable en pointillés, la taille réelle affichée (« 24 × 30 cm »), le pré-contrôle en pastille.
3. **Le prix suit** : affiché en permanence, il change en direct quand on ajoute une zone.
4. **L'aperçu est à un clic** : bascule canvas ↔ mockup réaliste sans quitter le studio.
5. **Mobile** : studio utilisable sur téléphone en mode simplifié (texte + image + position), édition fine sur tablette/desktop.
