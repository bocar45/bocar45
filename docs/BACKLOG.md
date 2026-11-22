# SAWWA — Liste des étapes

Une étape = un livrable court, avec des **critères d'acceptation vérifiables**. Elle n'est terminée que lorsque l'agent
`sawwa-validateur` a rendu le verdict **VALIDÉ** (consigné dans `docs/VALIDATIONS.md`). On ne commence l'étape suivante
qu'après ce verdict, et on l'enchaîne **automatiquement** dès que le verdict est VALIDÉ (sans attendre le porteur, sauf action 🧑‍💼 requise).

Statuts : ✅ validée · 🔎 à valider · ⏳ à faire · 🧑‍💼 dépend d'une action du porteur du projet.

**Ordre de travail actuel** : E14 → E18 → E18c → E15 → E16 → E17 → E18d → E20 → E21 → E22 → E18b (détourage) → E18b → … ; E11, E12, E13, E19 attendent des actions du porteur.

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

## E10 — Correction de la création par le client ✅
**But** : après « correction demandée », le client corrige dans le studio et renvoie au BAT.
- [x] Depuis la commande, « Corriger ma création » ouvre le studio sur la version commandée.
- [x] Le renvoi crée une **nouvelle version figée**, rattachée à la commande, et passe l'ordre en « BAT en cours » (`resubmit_design`).
- [x] Le prix est recalculé : identique ou inférieur → accepté ; supérieur → affichage de la différence et confirmation explicite (paiement complémentaire géré par la finance en pilote).
- [x] L'ancienne version reste consultable dans l'historique ; l'atelier voit le numéro de BAT.
- [x] Contrôles de fabrication refaits côté serveur ; tests SQL et TypeScript.

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

## E14 — Robustesse ✅ (Sentry en attente du porteur)
- [x] Enregistrement d'une offre atelier en une seule transaction (fonction SQL `save_vendor_offer`, tout ou rien, nouvelle version de grille seulement si elle change).
- [x] Limitation de débit : calcul de prix, envoi de code SMS/e-mail (désormais envoyé par le serveur), enregistrements, commandes, corrections, candidatures, fichiers de production.
- [x] Taille et type des fichiers imposés par le stockage ; images décodées et ré-encodées avant impression (un faux fichier est refusé).
- [x] Sécurité ajoutée : une création ne peut utiliser que les images de son propriétaire.
- [x] Erreurs serveur journalisées en JSON structuré (`instrumentation.ts`).
- [ ] 🧑‍💼 Service de suivi des erreurs (Sentry ou équivalent) : compte et clé à fournir par le porteur, branchement dans `instrumentation.ts`.

## E15 — Modèles prêts à personnaliser ✅
- [x] Table `templates` (emplacements photo/texte, éléments verrouillés), RLS et tests (migration 6, section 14 de `rls.test.sql`).
- [x] Admin : créer un modèle (`/admin/modeles`), l'éditer dans le studio (`?gabarit=`), marquer les champs client, publier (contrôle app + SQL), retirer, archiver ; journal d'audit.
- [x] Client : galerie `/modeles` par occasion (et par produit depuis la fiche produit) → assistant dans le studio (`?modele=`) : photo recadrée au cadre, texte limité → aperçu 2D/3D, prix, contrôle de fabrication → commande ou « Modifier librement dans le studio ». Brouillon gardé sur l'appareil. Décision D19.
- [x] Après validation : champs non personnalisés signalés avant la commande, filtre produit dans la requête, test d'accès aux images client renforcé.
- [ ] Reporté : champ `variable` par exemplaire (E16), recadrage sur le visage (E22), popularité alimentée par les commandes.

## E16 — Commandes d'équipe : noms et numéros ✅
- [x] Champ texte « variable » dans le studio : case « Différent sur chaque pièce » (nom ou numéro, longueur max) et outil « Nom + n° » en un clic. Décision D20.
- [x] Liste nom/numéro/taille par pièce à la commande : saisie, ou liste collée depuis un tableur ou un message (colonnes dans n'importe quel ordre), contrôle en direct (taille, longueur, caractères imprimables, chiffres, débordement de la zone, numéros en double), aperçu de chaque pièce en 2D/3D. Contrôle refait sur le serveur ; tailles et quantité tirées de la liste ; prix calculé sur la pièce la plus large (même règle au studio et au serveur).
- [x] Liste figée avec la ligne de commande (migration 7 : longueur = quantité, aucune modification après commande), visible par le client, l'admin et l'atelier affecté ; correction (E10) contrôlée avec la liste figée.
- [x] Fichiers de production par pièce (PNG 300 dpi `?piece=N`, nommé taille-numéro-nom) ; zone fixe en un seul fichier ; fiche PDF avec la liste des pièces à cocher (40 par page).
- [x] Après validation : tailles de la ligne contrôlées en SQL contre la liste.
- [ ] Reporté : largeur mesurée avec les métriques de la police (aujourd'hui au prorata des lettres) ; planche d'impression multi-pièces (imposition DTF) quand un atelier pilote aura donné son format de film ; supplément de personnalisation par pièce dans les grilles atelier si les ateliers le facturent.

## E17 — Devis B2B ✅
- [x] Formulaire de demande `/devis` (organisation, contact, téléphone, produit, quantité, date souhaitée, logo dans le dossier privé du client ou une de ses créations, besoin) ; « Mes devis » dans le compte, annulation par le client.
- [x] Devis chiffré par l'équipe (ops, support) dans `/admin/devis` : produit, couleur, quantité, tailles facultatives, marquages maximaux ; prix par le moteur de prix (`bestQuote`), avec coût atelier et marge visibles en interne ; validité 30 jours (réglable) ; nouvelle version = l'ancienne est remplacée ; refus motivé. Journal d'audit.
- [x] Lien de commande : « Créer et commander au prix du devis » ouvre le studio (`?devis=`), couleur et quantité fixées, marquages contrôlés contre le devis ; le serveur réserve le devis une seule fois (`claim_b2b_quote`), le rejoue avec ses versions figées de règles et de grille (+ livraison) et vérifie que le montant est identique au devis. Décision D21.
- [ ] Plus tard : remplacement + devis + chiffres internes en une seule fonction SQL ; test unitaire de `repriceFrozen` (avec base de test).
- [x] Migration 8 : demandes et devis, devis figés (prix non modifiables, jamais supprimés), droits testés (section 16).

## E18 — Studio 3D en direct ✅ (modèles d'artiste en attente du porteur) (priorité avancée : juste après E14, demande du porteur)
**Référence** : `design/reference-studio-3d-blankbuilder.jpg` (inspiration fonctionnelle, pas de copie d'interface ni de marque).
- [x] Écran partagé dans le studio : modes « 2D », « 2D + 3D », « 3D » ; la 3D se met à jour en direct (≈ 0,5 s mesuré, capture d'écran comprise).
- [x] React Three Fiber, chargement à la demande (module séparé), repli 2D automatique sans WebGL, rendu seulement quand quelque chose change.
- [x] T-shirt, polo, hoodie, tote : modèles calibrés en millimètres sur les zones (impression devant à 7 cm sous l'encolure, logo poitrine gauche du porteur, dos lisible de derrière, manches) — tests de calibration.
- [x] Mug et gourde (enveloppe cylindrique, couture à l'arrière) et casquette (panneau avant).
- [x] Rendu : couleur exacte du produit, ombres des plis, légers plis, maille ; rotation, zoom, vues Face / Dos / Profils / Zone, « Recentrer » ; fond blanc ou ivoire.
- [x] Emplacements en un clic : « Placer ici » déplace l'élément sélectionné vers une autre zone (centré, réduit s'il dépasse).
- [x] Performances mesurées sur processeur graphique logiciel : 54–60 images/s, produit affiché en ≈ 0,65 s (serveur local). À confirmer sur un Android milieu de gamme réel en 4G (E11).
- [ ] 🧑‍💼 Modèles 3D définitifs produits par un artiste. En attendant : modèles provisoires générés par le code, signalés « modèle provisoire » (D17).

## E18b — Impression intégrale par pièces de patron 🔎 (vente : 🧑‍💼 atelier capable requis)
- [x] Patrons de référence coupé-cousu, taille M, en mm : t-shirt (devant, dos, 2 manches, bord-côte du col) et hoodie (devant, dos, 2 manches, 2 capuches, poche kangourou, 2 poignets, ceinture), marges de couture 10 mm et fond perdu 5 mm ; créés en un clic dans l'admin catalogue comme zones « sublimation » (contour stocké dans la zone). Décision D26.
- [x] Édition à plat de chaque pièce (pièce telle que coupée : motif, bord imprimé, trait de coupe, ligne de couture) avec la 3D en direct (pièces à leur place réelle, seconde manche en miroir) ; « Motif continu » (losanges, bandes tissées, damier, pois, 2 couleurs, taille réglable) posé sur tout le vêtement et raccordé exactement d'une pièce à l'autre (vérifié au rendu réel sur la couture de côté).
- [x] Fichiers de production par pièce : PNG 300 dpi couvrant le fond perdu, découpé au contour imprimé, seconde pièce d'une paire en miroir (`copie=2`) ; fiche PDF avec le trait de coupe sur l'aperçu et une page « Plan de coupe » (laize 150 cm, longueur de tissu par vêtement et totale).
- [x] Contrôle de fabrication propre à l'impression intégrale : pièce non couverte jusqu'au bord (tissu blanc aux coutures), élément hors de la pièce ; prix sur la surface entière de chaque pièce imprimée (×2 pour les paires) ; résolution contrôlée comme ailleurs.
- [ ] Plus tard : motif continu à partir d'une image du client ; repères de montage (crans) ; gradation des tailles S à XXL (patron de l'atelier pilote).
- [ ] 🧑‍💼 Au moins un atelier partenaire capable (sublimation ou impression textile + coupe-couture) avant mise en vente.

## E18c — Outils d'image du studio ✅
- [x] Retrait du fond (couleur du bord, tolérance réglable, fond seulement s'il touche le bord : l'intérieur du logo est conservé), inversion, « rogner les bords vides », recadrage en % ; la taille réelle et la position sont conservées.
- [x] Effet trame (« halftone ») : points d'une couleur d'encre, pas réglable en mm.
- [x] Vectorisation d'un logo simple en aplats (2 à 6 couleurs, palette exacte du logo, fond retiré) → élément vectoriel net à toute taille, couleurs modifiables une à une ; compté correctement par le contrôle de fabrication (broderie, sérigraphie) ; rendu identique dans l'éditeur, la 3D et les fichiers d'impression (D18).
- [x] Chaque opération crée une nouvelle image (l'original n'est pas modifié) et s'annule.
- [ ] Agrandissement sans perte (« upscale ») : reporté à l'étape IA (E22), comme prévu.

## E18d — Modération des images importées ✅ (avant le lancement public)
- [x] Déclaration de droits avant le premier import d'image (studio, photo d'un modèle, logo d'une demande de devis) ; date enregistrée sur la création (`designs.rights_declared_at`) ; enregistrement et commande refusés sans déclaration si la création contient des images importées. Décision D22.
- [x] Signalement : un atelier depuis la fiche de production, toute personne connectée depuis un modèle (`/signaler`) ; la base vérifie que la personne voit bien le contenu.
- [x] File de modération `/admin/moderation` (ops, support) : retenir (modèle retiré de la galerie, ou production de la commande mise en pause) ou classer sans suite, avec décision écrite et journal d'audit ; alerte au-delà de 48 h.
- [x] Refus motivé au BAT : motifs « marque déposée », « personnage ou œuvre protégés », « contenu interdit » (paquet `workflow`), expliqués au client avec ses options (corriger ou être remboursé).
- [ ] Plus tard : détection automatique (IA, E22) ; signalement public sans compte si les abus l'exigent.

## E19 — Humains photoréalistes (piste 3D) ⏳ 🧑‍💼
- [ ] 🧑‍💼 Casting validé, studio de scan / artiste choisi, budget accordé (`VISUALISATION_3D.md`).
- [ ] Intégration des avatars, choix de la personne, taille, mouvement, fond blanc ou ivoire, photo studio.

## E20 — Administration avancée ✅
- [x] Tableau de bord `/admin/tableau-de-bord` (ops, finance) sur 7/30/90 jours/12 mois : chiffre d'affaires TTC et HT, coût ateliers, marge brute et taux, expédiées dans le délai, retards en cours, délai moyen, taux de BAT refusés, litiges et signalements ouverts (calculs purs testés, `lib/dashboard.ts`).
- [x] Litiges et reprises : le client signale un problème sur une commande expédiée ou livrée (photos dans son dossier privé) ; l'équipe compare aux photos de contrôle et décide (refabrication, remboursement partiel ou total, rien) ; faute de l'atelier → pénalité au grand livre dans la même transaction.
- [x] Grand livre ateliers en écriture seule : gain inscrit automatiquement à la livraison (coût figé), pénalités, ajustements justifiés (finance), versements (jamais plus que le solde, verrou contre deux versements simultanés) ; relevé pour l'admin et pour l'atelier (`/pro/releve`).
- [x] Export comptable CSV (Excel FR) : commandes/TVA, grand livre, versements, litiges, par période ; protection contre l'injection de formules. Décision D23.
- [ ] Plus tard : remboursement en ligne (E13), factures et auto-factures numérotées, rapprochement des paiements.

## E21 — Espace atelier avancé ✅
- [x] Capacité par jour et fermetures (`/pro/disponibilites`) prises en compte à l'affectation : charge en cours + commande ÷ capacité, jours ouvrés du lundi au samedi, fermetures sautées ; l'admin voit « prêt le… / surchargé / fermé jusqu'au… », les ateliers disponibles sont proposés en premier, l'affectation à un atelier fermé est refusée (`lib/capacity.ts`, tests). Marge de l'affectation calculée avec `splitGross` (règle 3).
- [x] Plusieurs utilisateurs par atelier : invitation par numéro de téléphone (7 jours), acceptation par la personne connectée avec ce numéro, rôles propriétaire / gérant / opérateur ; l'opérateur ne voit ni l'argent ni les offres et ne gère ni l'équipe ni les disponibilités ; au moins un propriétaire garanti (`/pro/equipe`). Décision D24.

## E22 — IA ✅ partie gratuite (détourage) ; génération 🧑‍💼 budget
- [x] Détourage automatique dans le navigateur (« ✨ Détourer la photo ») : modèle U²-Net léger (Apache 2.0, 4,6 Mo) exécuté sur l'appareil par ONNX Runtime WebAssembly, servi par SAWWA (pas de CDN tiers, aucune image envoyée, aucun coût par image) ; ≈ 8 Mo téléchargés au premier usage puis en cache ; nouvelle image recadrée sur le sujet, taille réelle et position conservées, annulable ; ≈ 3 s mesurées. Décision D25.
- [ ] 🧑‍💼 Génération de motifs avec quotas, cache, suivi des coûts et modération : choix du fournisseur et budget par le porteur.
- [ ] Agrandissement sans perte (reporté depuis E18c) : avec la génération (même fournisseur), ou modèle local si la qualité suffit.

## E23 — Pilote fermé ⏳ 🧑‍💼
- [ ] 2 ateliers actifs, 20–50 commandes réelles.
- [ ] Critères go/no-go de `ROADMAP.md` (délais, défauts, refus BAT, marge réelle).

## E24 — Lancement public ⏳ 🧑‍💼
- [ ] Revue de sécurité, tests de charge, CGV/CGU/confidentialité relues, déclaration CDP, SEO, mesure d'audience.
