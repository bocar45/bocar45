# @sawwa/pricing
Le seul calcul de prix de SAWWA : `price(request, platformRules, vendorGrid) → Quote`. Fonction pure.
- Coût atelier (vierge + marquages par palier de quantité totale + frais de préparation) → marge SAWWA (par catégorie, plancher par pièce) → TVA → arrondi au pas (50 FCFA).
- Remises plafonnées : la marge ne descend jamais sous `minMarginPerUnit × quantité`.
- Acompte au-delà d'un seuil. `snapshot` = versions des règles et de la grille + requête, à stocker avec la commande.
- Le détail par marquage (`decorations[].unitPrice`) est indicatif ; le prix de ligne fait foi.
