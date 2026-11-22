# Performance et tenue en charge (E24b)

Mesures du 22/11/2026, sur la machine de développement (4 cœurs, 16 Go), **sans base Supabase réelle** (E11 en attente) : elles mesurent le coût propre de SAWWA (rendu des pages, moteurs). À refaire sur le projet Supabase de préproduction avant l'ouverture publique.

## Comment relancer
| Mesure | Commande |
|---|---|
| Moteurs (prix, contrôle, fichier d'impression) | `pnpm bench:engines` |
| Charge HTTP sur une version de production locale | `pnpm --filter web build && pnpm --filter web start`, puis `pnpm load:http http://localhost:3000 20 20 / /catalogue /modeles /studio/<produit>` |
| Limitation de débit sous accès simultanés | `pnpm db:test` (40 appels simultanés pour une limite de 10 → exactement 10 acceptés) |

Ne jamais lancer la charge HTTP sur le site en ligne.

## Résultats
**Moteurs** (`pnpm bench:engines`)
| Opération | Temps moyen | Débit |
|---|---|---|
| Prix en direct (moteur de prix) | 0,003 ms | ≈ 400 000 / s |
| Contrôle de fabrication + marquages (hoodie impression intégrale, 12 textes) | 0,008 ms | ≈ 120 000 / s |
| Fichier d'impression 300 dpi d'un devant de hoodie (64 × 73 cm, 65 Mpx) | 3,0 s | — |

**Pages** (20 utilisateurs simultanés, 20 s, sans base) : 0 erreur, 340 requêtes/s.
| Page | p50 | p95 | p99 |
|---|---|---|---|
| Accueil | 39 ms | 74 ms | 91 ms |
| Catalogue | 35 ms | 60 ms | 107 ms |
| Modèles | 95 ms | 139 ms | 165 ms |
| Studio | 95 ms | 139 ms | 169 ms |

**Limitation de débit** : 10 accès acceptés sur 40 simultanés, exactement la limite (le compteur est atomique dans Postgres).

## Constat et correction : mémoire des fichiers d'impression
Un fichier 300 dpi d'une grande pièce d'impression intégrale occupe jusqu'à **1,46 Go** au rendu, au-delà d'une fonction serveur de 1 Go. Mesuré : 200 dpi ≈ 0,7–1 Go, 150 dpi ≈ 0,4–0,6 Go.
→ Budget de pixels (`printDpiFor`, 25 Mpx par défaut, réglable par `PRINT_MAX_MEGAPIXELS`) : 300 dpi pour les marquages habituels et les manches, 150–200 dpi pour les grandes pièces (norme de la sublimation grand format), jamais moins de 150 dpi. Décision D28.

## Budgets à tenir en production (critères du lancement)
| Indicateur | Budget |
|---|---|
| Page publique (catalogue, fiche, modèles) | p95 < 500 ms côté serveur ; LCP < 2,5 s en 4G |
| Prix en direct (action serveur, avec base) | p95 < 300 ms |
| Fichier d'impression | < 20 s et < 800 Mo par fichier |
| Erreurs serveur sous 50 utilisateurs simultanés | 0 |

## À faire sur le vrai projet (🧑‍💼 après E11)
Charge avec base réelle (prix, commande, fichiers), index et plans de requêtes Supabase, cache du catalogue (déjà 10 min), mesure sur un Android milieu de gamme en 4G (studio 3D).
