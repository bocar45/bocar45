# @sawwa/workflow
Machine à états des ordres de fabrication. `transition(state, event, actor) → { state, effects }`, pure.
Rôles et atelier vérifiés, données obligatoires (photo QC, suivi, motif), mise en pause/reprise, refus atelier → réaffectation. Les effets (notifications, remboursement, crédit atelier) sont exécutés par l'appelant.
`deriveOrderStatus` : statut client calculé à partir des ordres, jamais stocké à part.
