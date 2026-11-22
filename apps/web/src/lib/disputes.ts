/** E20 — dispute labels (shared by customer, admin and workshop pages). */
export const DISPUTE_REASON: Record<string, string> = {
  defect: "Défaut de fabrication (impression, broderie, couture)", wrong_item: "Article différent de la commande (taille, couleur, création)",
  not_received: "Commande non reçue", late: "Retard important", other: "Autre",
};
export const DISPUTE_RESOLUTION: Record<string, string> = {
  reprint: "Refabrication offerte", partial_refund: "Remboursement partiel", full_refund: "Remboursement total", none: "Aucune compensation",
};
export const DISPUTE_STATUS: Record<string, string> = { open: "En cours d'examen", resolved: "Résolu", rejected: "Non retenu" };
