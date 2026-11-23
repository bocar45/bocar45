# SAWWA — Marketplace et Business (SaaS) : analyse critique du CTO

> Réponse à la « Note stratégique : Marketplace et Business SaaS » (23/11/2026). Avis indépendant, puis décisions proposées (D30).

## 1. Verdict en une phrase
Les deux modèles sont complémentaires **à condition de ne pas les lancer en même temps** : la marketplace d'abord (elle existe déjà dans le code), puis une seule forme de SaaS — **la boutique en marque blanche** — vendue aux imprimeurs pilotes, sans API ni connecteurs Shopify/WooCommerce avant d'avoir 10 clients payants.

## 2. Ce qui est juste dans la note
- La cible B2B (imprimeurs, ateliers, agences) a un vrai problème : ils prennent les commandes sur WhatsApp, refont les maquettes à la main, chiffrent au feeling. Un studio + un prix automatique + un BAT est exactement ce qui leur manque.
- Le module d'import CSV/XLSX est le bon premier pas : c'est le frein n° 1 à l'adoption (personne ne ressaisit 200 références).
- L'architecture multi-locataire (tenant) est la bonne direction : SAWWA l'a déjà en partie (organisations, ateliers isolés par la RLS).

## 3. Incohérences et risques
| # | Point de la note | Problème | Gravité |
|---|---|---|---|
| 1 | Lancer Marketplace **et** Business | Deux produits, deux clientèles, deux tunnels de vente pour une équipe d'une personne. Risque n° 1 : ne finir ni l'un ni l'autre. | Élevée |
| 2 | Cannibalisation « faible » | Un atelier qui a sa boutique SAWWA n'a plus intérêt à recevoir des commandes marketplace à commission (il préfère vendre en direct). À cadrer par contrat : la marketplace apporte des **nouveaux** clients, la boutique sert **ses** clients. | Moyenne |
| 3 | Double facturation (abonnement + commission) | Si un client de la boutique de l'atelier paie, prendre aussi une commission tue l'offre. Règle : **boutique = abonnement seul** (+ frais de paiement réels) ; **marketplace = commission seule**. | Élevée |
| 4 | API publique + connecteurs Shopify/WooCommerce | Très coûteux (sécurité, versions, support), et la cible sénégalaise vend surtout sur WhatsApp/Instagram, peu sur Shopify. À repousser. | Élevée |
| 5 | Widget intégrable dans un site existant | Techniquement simple (iframe), mais peu d'imprimeurs dakarois ont un site. Utile plus tard pour les agences. | Faible |
| 6 | Encaissement pour le compte des ateliers | SAWWA deviendrait intermédiaire de paiement (agrément BCEAO, KYC). **L'argent de la boutique doit aller directement sur le compte de l'atelier** (son propre compte PayDunya/CinetPay/Wave Business). | Élevée (juridique) |
| 7 | Prix du SaaS non testés | Aucun chiffre de consentement à payer. À tester avant de coder plus. | Moyenne |
| 8 | Domaines personnalisés | Gestion DNS/TLS par client = support. Sous-domaine `boutique.sawwa…` suffit au début. | Faible |

## 4. Difficulté réelle (estimations pour l'équipe actuelle)
| Brique | État dans SAWWA | Effort restant |
|---|---|---|
| Studio 2D/3D | ✅ fait (texte, images, détourage, modèles, 3D provisoire, noms/numéros) | Modèles 3D d'artiste (🧑‍💼 budget) |
| Prix dynamique | ✅ fait (grilles atelier, paliers, techniques, marge, TVA, acompte) | Prix propres à chaque boutique : S |
| Boutique marque blanche | 🟡 démo livrée (cette étape) | Création en libre-service, domaine, paiement direct atelier : M |
| Import CSV/XLSX | ❌ | M (mapping de colonnes + validation + aperçu) |
| Widget iframe | ❌ | S |
| API publique / connecteurs | ❌ | L chacun — **non prioritaire** |

## 5. Architecture multi-locataire recommandée
- **Un locataire = une organisation** (`organizations`, déjà existante). Une boutique (`storefronts`) appartient à une organisation de type atelier.
- **Isolation par la RLS** (déjà la règle du projet) : chaque requête filtrée par `vendor_id` / `organization_id`, vérifiée côté serveur ; pas de base par client (coût et maintenance inutiles à ce stade).
- **Une boutique = une vitrine** : nom, couleurs, logo, sélection de produits **parmi les offres de l'atelier**, coefficient de prix propre. Les prix restent calculés par `packages/pricing` (règle 4) ; la boutique n'a qu'un paramètre de marge.
- **Une seule base de code** : la boutique réutilise le catalogue, le studio et le BAT ; seule l'enveloppe (couleurs, logo, en-tête) change.
- **Paiement** : compte marchand de l'atelier (plus tard, E13). SAWWA facture l'abonnement à part.

## 6. Feuille de route proposée
| Étape | Contenu | Condition |
|---|---|---|
| **E25 — Démo boutique marque blanche** | `/b/[boutique]` : vitrine aux couleurs d'un atelier, produits sélectionnés, studio et prix SAWWA. Données de démo. | Pour la présentation du 23/11 |
| E26 — Test de consentement à payer | 10 entretiens d'imprimeurs avec la démo, 3 prix testés (ci-dessous), objectif ≥ 3 préaccords. | 🧑‍💼 porteur |
| E27 — Boutique en libre-service | L'atelier crée et règle sa boutique depuis SAWWA Pro (couleurs, logo, produits, marge). | Si E26 concluant |
| E28 — Import CSV/XLSX | Assistant d'import du catalogue atelier avec aperçu et erreurs ligne par ligne. | Après E27 |
| E29 — Widget iframe | Bouton « Personnaliser » à coller sur un site. | Si demande d'agences |
| Plus tard | API publique, Shopify/WooCommerce, domaines personnalisés | ≥ 10 clients payants |

## 7. Offres d'abonnement à tester (hypothèses, à valider en E26)
| Offre | Prix mensuel (FCFA) | Contenu |
|---|---|---|
| Atelier | 15 000 | 1 boutique, 20 produits, studio, BAT, sous-domaine |
| Pro | 35 000 | Produits illimités, import CSV, 3 utilisateurs, statistiques |
| Agence | 75 000 | Plusieurs boutiques, widget, assistance prioritaire |
- **Test du consentement à payer** : présenter la démo, proposer l'offre Atelier avec **3 mois à moitié prix pour 5 ateliers fondateurs** contre un paiement d'avance ; un « oui » sans paiement ne compte pas.
- **Retour sur investissement pour l'atelier** : s'il gagne 1 h par commande (maquette + chiffrage + allers-retours WhatsApp) et traite 30 commandes/mois, l'offre à 15 000 FCFA est remboursée dès 2 à 3 commandes supplémentaires.

## 8. Réponses aux questions de la note
- **Complémentaires ?** Oui : la marketplace attire les clients finaux, la boutique fidélise les ateliers (qui deviennent aussi des fournisseurs de la marketplace).
- **Cannibalisation ?** Réelle si mal cadrée ; règle des « nouveaux clients » ci-dessus.
- **Lequel d'abord ?** Marketplace (prête), puis boutique marque blanche. Pas d'API au départ.
- **Double facturation ?** Jamais sur une même commande : abonnement **ou** commission.
- **Contrats et paiements ?** Contrat atelier (qualité, délais, litiges) déjà prévu ; pour la boutique, encaissement sur le compte de l'atelier.
- **Widget, API ou headless ?** Widget iframe d'abord ; headless/API seulement pour de gros comptes.
- **Isolation des données ?** RLS par organisation, déjà testée (20 sections de tests).
- **Quels imprimeurs viser ?** Ateliers DTF/broderie de Dakar (HLM, Colobane, Sicap) avec 2 à 10 employés et une clientèle d'entreprises/associations.

## 9. Décisions à valider par le porteur
1. Ordre : marketplace puis boutique marque blanche ; API/connecteurs repoussés (**recommandé**).
2. Règle « abonnement ou commission, jamais les deux sur une commande ».
3. Paiement des boutiques sur le compte de l'atelier (pas d'encaissement pour compte de tiers par SAWWA).
4. Grille de prix à tester : 15 000 / 35 000 / 75 000 FCFA.
