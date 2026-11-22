# @sawwa/domain
Types métier partagés. `Money` : montant entier en unité mineure + devise (XOF = 0 décimale, EUR = 2). Taux en points de base (1 800 bps = 18 %). Arrondis toujours explicites (`divRound`, `roundToStep`). `splitGross` garantit HT + TVA = TTC.
