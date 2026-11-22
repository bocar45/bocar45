# SAWWA — Liste des étapes

Une étape = un livrable court, avec des **critères d'acceptation vérifiables**. Elle n'est terminée que lorsque l'agent
`sawwa-validateur` a rendu le verdict **VALIDÉ** (consigné dans `docs/VALIDATIONS.md`). On ne commence l'étape suivante
qu'après ce verdict.

Statuts : ✅ validée · 🔎 à valider · ⏳ à faire · 🧑‍💼 dépend d'une action du porteur du projet.

Critères communs à **toutes** les étapes (vérifiés à chaque fois, en plus des critères propres) :
- C1. `pnpm typecheck`, `pnpm test`, `pnpm db:test` et `pnpm build` passent.
- C2. Règles de `CLAUDE.md` respectées : argent en entiers via `Money`, prix calculés uniquement dans `packages/pricing`, transitions uniquement via `packages/workflow`, permissions vérifiées côté serveur, nouvelle table = RLS + tests d'accès, commandes figées (version + devis).
- C3. Pas de secret dans le dépôt, pas de donnée fictive présentée comme réelle, pas de bouton factice.
- C4. Messages d'erreur compréhensibles en français, états vides et chargements prévus.
- C5. Nouvelle logique métier = tests ; nouvelle table ou fonction SQL = tests dans `supabase/tests/rls.test.sql`.
- C6. Documentation à jour (`ROADMAP.md`, `DECISIONS.md` si décision structurante, `DATABASE.md` si migration) ; commit poussé.

---

## Déjà réalisées (avant la mise en place du validateur)
| # | Étape | Statut |
|---|---|---|
| E01 | Cadrage, audit, décisions D1–D15, direction artistique, maquettes | ✅ |
| E02 | Monorepo, `domain` (Money XOF), `pricing` (moteur de prix), `workflow` (statuts), CI | ✅ |
| E03 | Supabase : identité, rôles, catalogue, ateliers, règles de prix, audit, RLS testée | ✅ |
| E04 | Site : connexion téléphone, candidature atelier, validation admin | ✅ |
| E05 | Admin catalogue, règles de prix versionnées, offres et grilles des ateliers | ✅ |
| E06 | Refonte visuelle (logo, aplats, bandes tissées), catalogue public avec prix calculés | ✅ |
| E07 | Studio V1 (édition en mm, contrôle de fabrication, prix en direct, aperçu) | ✅ |
| E08 | Chaîne de commande : créations dans le compte, commande figée, paiement pilote, affectation, BAT, production, QC, expédition | ✅ |

---

## E09 — Fichiers de production ✅
**But** : l'atelier télécharge des fichiers prêts à imprimer, fidèles au studio.
- [x] PNG transparent par zone, taille réelle de la zone, 300 dpi (ex. 30 × 40 cm → 3543 × 4724 px).
- [x] Polices identiques au studio (instances fixes à la bonne graisse, licence OFL jointe), italique réelle quand elle existe.
- [x] Images originales en pleine résolution, jamais les aperçus.
- [x] Fiche PDF A4 : référence, produit, couleur, quantités par taille, une page par zone (technique, taille et position du marquage en cm, repère, couleurs, aperçu).
- [x] Accès réservé à l'atelier affecté (actif) et à l'équipe ops ; refusé avant affectation.
- [x] Tests du rendu SVG et du PDF.

## E10 — Correction de la création par le client ⏳
**But** : après « correction demandée », le client corrige dans le studio et renvoie au BAT.
- [ ] Depuis la commande, « Corriger ma création » ouvre le studio sur la version commandée.
- [ ] Le renvoi crée une **nouvelle version figée**, rattachée à la commande, et passe l'ordre en « BAT en cours » (`resubmit_design`).
- [ ] Le prix est recalculé : identique ou inférieur → accepté ; supérieur → affichage de la différence et confirmation explicite (paiement complémentaire géré par la finance en pilote).
- [ ] L'ancienne version reste consultable dans l'historique ; l'atelier voit le numéro de BAT.
- [ ] Contrôles de fabrication refaits côté serveur ; tests SQL et TypeScript.

## E11 — Mise en service Supabase + Vercel et test de bout en bout réel 🧑‍💼
**But** : le site tourne sur de vrais services, testé avec de vrais comptes.
- [ ] 🧑‍💼 Projets Supabase (eu-west-3) et Vercel (cdg1) créés, fournisseur SMS configuré, variables renseignées (`docs/SETUP_SUPABASE_VERCEL.md`).
- [ ] Migrations appliquées, données de référence chargées, premier super-admin.
- [ ] Types TypeScript générés depuis la base et utilisés par les clients Supabase.
- [ ] Parcours complet joué sur l'environnement de préproduction : client (création → commande), finance (paiement), ops (affectation), atelier (BAT → expédition), client (suivi), fichiers de production téléchargés.
- [ ] Rien n'est déployé en production sans accord explicite.

## E12 — Notifications WhatsApp / SMS / e-mail ⏳ 🧑‍💼
- [ ] 🧑‍💼 Choix du fournisseur (ex. WhatsApp Business via un prestataire) et clés fournies.
- [ ] Module `notifications` derrière une interface (changement de fournisseur sans toucher au métier).
- [ ] Messages aux étapes clés : commande reçue, paiement confirmé, correction demandée, BAT validé, expédiée, livrée ; atelier : nouvelle affectation, SLA proche.
- [ ] Envoi asynchrone avec reprise sur erreur et journal (`notifications`), aucun échec d'envoi ne bloque une transition.

## E13 — Paiement en ligne (agrégateur, mode test) ⏳ 🧑‍💼
- [ ] 🧑‍💼 Agrégateur choisi (PayDunya, CinetPay, PayTech ou Wave) et compte sandbox.
- [ ] Interface `PaymentProvider` ; paiement de l'acompte ou du total depuis la commande.
- [ ] Webhook signé et **idempotent** (rejouer 3 fois = un seul paiement), `mark_order_paid` automatique.
- [ ] Remboursement déclenché par l'annulation ; aucune donnée de carte chez SAWWA.

## E14 — Robustesse ⏳
- [ ] Enregistrement d'une offre atelier en une seule transaction (fonction SQL).
- [ ] Limitation de débit : calcul de prix, envoi de code SMS, envois de fichiers.
- [ ] Taille et type des fichiers vérifiés côté serveur (Storage) ; images ré-encodées.
- [ ] Surveillance des erreurs (Sentry ou équivalent) branchée.

## E15 — Modèles prêts à personnaliser ⏳
- [ ] Table `templates` (emplacements photo/texte, éléments verrouillés), RLS et tests.
- [ ] Admin : créer un modèle depuis le studio.
- [ ] Client : galerie de modèles par produit et occasion → assistant (photo, texte) → aperçu → studio complet ou commande.

## E16 — Commandes d'équipe : noms et numéros ⏳
- [ ] Champ texte « variable » dans le studio.
- [ ] Liste nom/numéro/taille par pièce à la commande ; contrôle des longueurs.
- [ ] Fichiers de production par pièce (ou planche) et fiche récapitulative.

## E17 — Devis B2B ⏳
- [ ] Formulaire de demande (quantités, logo, date souhaitée).
- [ ] Devis préparé par l'admin à partir du moteur de prix, valable 30 jours, lien de commande.

## E18 — Visionneuse 3D « Produit » ⏳
- [ ] React Three Fiber, chargement à la demande, repli 2D automatique.
- [ ] Mug (enveloppe cylindrique) et t-shirt (zones UV calibrées en mm) ; rotation, zoom, vues rapides.
- [ ] Premier rendu < 3 s en 4G, ≥ 30 i/s sur Android milieu de gamme.

## E19 — Humains photoréalistes (piste 3D) ⏳ 🧑‍💼
- [ ] 🧑‍💼 Casting validé, studio de scan / artiste choisi, budget accordé (`VISUALISATION_3D.md`).
- [ ] Intégration des avatars, choix de la personne, taille, mouvement, fond blanc ou ivoire, photo studio.

## E20 — Administration avancée ⏳
- [ ] Tableau de bord (CA, marge, délais, retards, taux de refus BAT).
- [ ] Litiges et reprises ; grand livre ateliers, relevés et versements ; export comptable.

## E21 — Espace atelier avancé ⏳
- [ ] Capacité par jour et jours de fermeture pris en compte à l'affectation.
- [ ] Plusieurs utilisateurs par atelier (propriétaire, gérant, opérateur).

## E22 — IA ⏳
- [ ] Détourage d'image dans le navigateur.
- [ ] Génération de motifs avec quotas, cache, suivi des coûts et modération.

## E23 — Pilote fermé ⏳ 🧑‍💼
- [ ] 2 ateliers actifs, 20–50 commandes réelles.
- [ ] Critères go/no-go de `ROADMAP.md` (délais, défauts, refus BAT, marge réelle).

## E24 — Lancement public ⏳ 🧑‍💼
- [ ] Revue de sécurité, tests de charge, CGV/CGU/confidentialité relues, déclaration CDP, SEO, mesure d'audience.
