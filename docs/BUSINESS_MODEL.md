# Livrable E — Modèle économique et tarification

## 1. Construction du prix (modèle recommandé : SAWWA revendeur)
```
coût atelier  = vierge(variante) + Σ zones[ coût technique(zone, taille marquage, couleurs, palier qté) ]
              + frais de préparation (répartis sur la quantité) + options
prix public HT = arrondi( max( coût atelier × (1 + marge%(catégorie, technique, pays)),
                               coût atelier + marge plancher€ ) )
livraison     = grille transporteur (poids, pays) ± subvention SAWWA
TVA           = selon pays de livraison et statut client (B2C / B2B UE autoliquidé)
total TTC     = Σ prix public + livraison − remise + TVA
```
- **Marge plancher** : interdit structurellement la marge négative (remise incluse : une promo ne peut pas descendre sous `coût atelier + plancher`).
- **Un seul calcul, un seul endroit** : `packages/pricing` (fonction pure `price(input, ruleSet, vendorGrid) → breakdown`). Le studio, le panier, le devis, le paiement et l'admin l'appellent tous.
- **Versionné** : `price_rule_sets.version` + `vendor_price_grids.version` + entrées → enregistrés dans `quotes.pricing_snapshot`. Une commande garde son prix pour toujours ; le changement de règle s'applique aux nouveaux devis seulement.
- **Routage et prix** : le prix public est calculé sur l'**offre de référence** (médiane des ateliers qualifiés ou atelier préférentiel), pas sur l'atelier finalement choisi. Si SAWWA route vers un atelier plus cher (urgence, capacité), SAWWA absorbe l'écart : le client n'est jamais refacturé.
- **Ce que voit le client** : prix unitaire, détail « produit / personnalisation devant / dos », frais de préparation (broderie), paliers de quantité (« dès 25 pièces : 14,90 € »), livraison, remise, TTC. Pas de ligne « marge SAWWA ».

### Quatre cas couverts
| Cas | Traitement |
|---|---|
| Commande simple | Prix instantané, paiement direct, BAT atelier sous 24 h |
| Validation atelier nécessaire (broderie, gros visuel) | Prix instantané + frais de préparation affichés, BAT obligatoire |
| Commande complexe | Devis manuel (admin + atelier) → lien de paiement, valable 30 j |
| Volume | Paliers dégressifs automatiques jusqu'à un seuil (ex. 250 pièces), devis au-delà |

## 2. Paiement des ateliers
- L'atelier est payé à son **coût déclaré** (snapshot de sa grille au moment de l'affectation).
- Gain inscrit au grand livre à l'état `delivered` (ou `shipped` + 7 jours sans réclamation).
- Virement bimensuel (UE : SEPA ; Afrique : virement ou Wave/Orange Money selon D5), auto-facture générée par SAWWA sous mandat.
- Pénalités : reprise à la charge de l'atelier en cas de défaut de fabrication prouvé (photo QC vs réclamation).

## 3. Alternative : marketplace pure (pour comparaison)
Le vendeur fixe le prix public, SAWWA prélève 15–20 % via Stripe Connect.
- **Pour** : SAWWA ne porte ni la TVA produit ni la responsabilité de fabrication.
- **Contre** : revenu par commande divisé par ~2, pas de contrôle du prix, doublons et incohérences du catalogue, routage impossible, conformité marketplace (DAC7, DSA, KYC vendeurs), client confronté à plusieurs vendeurs.
Recommandation : **non pour la V1**, possible plus tard pour les « boutiques créateurs ».

## 4. Sources de revenus
| Source | V1 | Commentaire |
|---|---|---|
| Marge sur la vente (prix public − coût atelier) | ✅ | Revenu principal |
| Frais de préparation (broderie, sérigraphie) | ✅ | Marge modeste, couvre le coût |
| Marge livraison | ✅ légère | Ne pas faire de la livraison un centre de profit visible |
| Offre Pro (B2B) : gestionnaire dédié, palettes de marque, échantillons | S | Abonnement ou marge spécifique |
| Crédits IA au-delà du quota gratuit | S | Doit au moins couvrir le coût |
| Boutiques créateurs (commission sur ventes de designs) | L | |
| Abonnement atelier, visibilité payante | ❌ au lancement | Freine le recrutement de l'offre |

## 5. Simulation (hypothèses à valider avec de vrais devis ateliers)
**Panier B2C type** : 1,6 article, 38 € TTC (31,70 € HT). Coût atelier 18 €. Paiement 1,5 % + 0,25 € = 0,82 €. Réserve réclamations/reprises 3 % du HT = 0,95 €. Technique (stockage, rendu, emails, IA) 0,30 €.
→ **Contribution ≈ 11,60 € par commande B2C** (≈ 37 % du HT) **avant acquisition client**.

**Panier B2B type** : 50 t-shirts logo brodé cœur, 540 € TTC (450 € HT). Coût atelier 300 €. Paiement 8,35 €. Réserve 2 % = 9 €. Technique 1 €.
→ **Contribution ≈ 131 € par commande B2B.**

| Scénario / mois | B2C | B2B | Contribution | Coûts fixes tech & outils* | Résultat avant marketing et salaires |
|---|---|---|---|---|---|
| Pilote (mois 1–3) | 150 | 10 | 3 050 € | 500 € | **≈ 2 550 €** |
| Traction (an 1) | 800 | 50 | 15 830 € | 1 200 € | **≈ 14 600 €** |
| Croissance (an 2) | 4 000 | 200 | 72 600 € | 4 000 € | **≈ 68 600 €** |
*Hébergement, base, stockage, Sentry, emails, outils, 3D/IA au forfait. Hors salaires, hors production d'assets (mockups, modèles 3D : budget initial ~5–12 k€ pour 6–8 produits).

**Lecture**
- 10 commandes B2B rapportent autant que ~110 commandes B2C. **Le B2B porte la rentabilité au départ.**
- Le coût d'acquisition B2C (souvent 8–20 € par premier achat en publicité payante) peut absorber toute la contribution d'une première commande B2C : la croissance B2C doit s'appuyer sur le contenu, la communauté, les créateurs, le bouche-à-oreille et la récurrence.
- Le paiement est le premier coût variable, devant l'IA et l'infrastructure. L'IA ne pèse que si elle est gratuite et illimitée : d'où les quotas.
- Seuil de rentabilité indicatif avec une équipe de 2 personnes (~9 k€/mois chargés) , 2 k€ de marketing et 1,2 k€ de coûts fixes tech (≈ 12,2 k€/mois) : **≈ 65 commandes B2B + 320 B2C par mois**.

Fichier tableur détaillé à produire en Phase 1 une fois les grilles réelles de 2–3 ateliers obtenues.
