/** Reasons to report a content (E18d), as shown to people. */
export const REPORT_REASONS = {
  trademark: "Marque déposée utilisée sans autorisation",
  protected_character: "Personnage ou œuvre protégés (dessin animé, film, club, artiste…)",
  someone_else_photo: "Photo d'une personne sans son accord",
  prohibited_content: "Contenu interdit (haine, violence, contenu sexuel)",
  other: "Autre",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;
export const isReportReason = (v: string): v is ReportReason => Object.hasOwn(REPORT_REASONS, v);
