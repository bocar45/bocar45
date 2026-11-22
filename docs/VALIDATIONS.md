# Journal des validations

Rempli uniquement par l'agent `sawwa-validateur` (`.claude/agents/sawwa-validateur.md`). La plus récente en haut.

## 2026-11-22 — E18b (partie code, 2e passage) — VALIDÉ
Commit examiné : 22a1ca8 (depuis 958f9c0), `git status` propre, HEAD = `origin/claude/sawwa-audit-cto-r8vt01`
Contrôles : typecheck ✅ · tests ✅ (162) · db ✅ (ALL RLS TESTS PASSED) · build ✅ (code de sortie 0). Tout relancé, build compris.
Vérification navigateur : non refaite.
Critères de l'étape :
- [x] Point 1 corrigé, motif raccordé à la vraie couture : `motifFrame` (`pattern.ts`) ancre la grille sur le vêtement vu de face, avec s = −1 pour une pièce de dos et tx = body.x + W pour la copie miroir (calcul refait : u' = W − u en X' = −X). Le même repère est appliqué dans `renderSurfaceSvg` (le miroir ne retourne que le contour, les éléments et le trait de coupe), `canvas.tsx` et la texture 3D du dos (`viewer.tsx`, `ctx.scale(-1,1)`, plage x inversée).
- [x] Test corrigé : `render.test.ts` compare le devant en X et le dos en −X − body.x, sur les 4 motifs, les deux côtés et 3 hauteurs, avec des points pris à l'intérieur des formes. Il vérifie aussi que les deux couleurs sont bien touchées. Test unitaire `motifFrame` (devant, dos, copie miroir).
- [x] Contre-épreuve indépendante refaite (mon script resvg, même côté du porteur) : le damier passe de 0/5 à 8/8 points identiques, et pois 8/8. Les seuls écarts restants (losanges, bandes) sont des pixels lissés sur les bords des formes : couleurs intermédiaires proches, décalage de 1 px dû au miroir. Aucun point intérieur ne diffère.
- [x] Remarque traitée : `blankPieces` (`preflight.ts`) signale les pièces sans impression ni motif, dans le studio et dans `placeOrder` (`actions.ts:134`), avec un test.
- [x] Les autres critères sont acquis au 1er passage (patrons, fichiers par pièce et plan de coupe, contrôle et prix côté serveur).
- 🧑‍💼 Il faut un atelier capable avant la mise en vente. La gradation S à XXL, les crans de montage et le motif à partir d'une image sont reportés.
Critères communs : C1 ✅ · C2 ✅ · C3 ✅ (pas de secret dans apps/packages/supabase ; pas de `SAWWA_PREVIEW_FIXTURE`) · C4 ✅ · C5 ✅ · C6 ✅ (D26 précisée : repère, raccord approché des manches, pièces blanches ; poussé ; aucune nouvelle dépendance dans ce passage).
Corrections à faire : aucune.
Remarques non bloquantes :
- `resubmitCorrection` n'ajoute pas `blankPieces`. Ce n'est qu'une remarque, mais le serveur devrait suivre la même règle que `placeOrder`.
- Le contour (`zones.anchor.pattern`) est relu en direct dans le catalogue au moment de la production, pas figé avec la commande. À figer quand les patrons de l'atelier arriveront.
Décision : passer à E24, partie code (revue de sécurité, tests de charge locaux, référencement, version anglaise), à découper d'abord en étape(s) avec critères dans BACKLOG. E11, E12, E13, E19, E23 et la partie non-code d'E24 attendent le porteur.

## 2026-11-22 — E18b (partie code : impression intégrale par pièces de patron) — À CORRIGER
Commit examiné : 958f9c0 (depuis ad9ad7d, wip 3f53c1f, 40989bb, 21a152f, 559d4ab inclus), `git status` propre, HEAD = `origin/claude/sawwa-audit-cto-r8vt01`
Contrôles : typecheck ✅ · tests ✅ (158, 26 fichiers) · db ✅ (ALL RLS TESTS PASSED) · build ✅ (code de sortie 0). Tout relancé.
Vérification navigateur : non refaite (mesure de l'auteur).
Critères de l'étape :
- [x] Patrons de référence t-shirt et hoodie taille M, couture 10 mm, fond perdu 5 mm, créés en un clic comme zones sublimation, contour dans `anchor.pattern`, audit (preuve : `pattern-templates.ts`, `admin/catalogue/actions.ts:159-181` derrière `guard()`, tests `pattern.test.ts` « reference patterns »). D26 écrite.
- [x] Fichiers de production par pièce : clip au contour imprimé, fond perdu, `copie=2` en miroir refusé hors paire miroir (`route.ts:107-117`), trait de coupe seulement sur la fiche, page « Plan de coupe » (`sheet.ts`, test « adds a cutting plan page »), laize 150 cm, pièces trop larges signalées.
- [x] Contrôle et prix : `checkSurface` = preflight + `patternPreflight` (pièce non couverte = remarque, élément hors pièce = bloquant), recalculé côté serveur dans `placeOrder` et `resubmitCorrection` (`actions.ts:132`, `:243`) ; prix sur la boîte entière, ×quantité (`pricing-bridge.ts`), passé à `packages/pricing` via `sanitizeDecorations` (limite portée à 20 : hoodie = 10 marquages). Tests « all-over pricing and checks ».
- [ ] **Motif continu « raccordé exactement d'une pièce à l'autre » : faux pour le damier sur la couture de côté réelle.** Le fichier du dos est dans le repère « dos vu de derrière » (la 3D le prouve : `garment.ts:91` retourne la texture du dos, et `viewer.tsx` peint la surface du dos à `body.x` dans ce repère retourné). Le point du dos cousu au point x = +250 du devant est donc en x' = −250 dans le fichier du dos, pas en +250. Or `motifOffset` ancre la grille de la même façon sur les deux pièces, et le test `render.test.ts:140-147` compare le devant en +250 au dos en +250, c'est-à-dire **au côté opposé du vêtement** : il passe par construction et ne vérifie pas la couture. Contre-épreuve exécutée (rendu resvg, même côté du porteur, dos en x' = −gx) : damier **5/5 points différents**, pois 5/5 et bandes 5/5 identiques, losanges 3/5 (écarts probablement sur les bords anti-crénelés). Les motifs symétriques par x → −x tombent juste par chance ; le damier (le motif du test) est décalé d'une demi-case à chaque couture de côté, sur le vêtement imprimé comme dans la 3D.
  → correction attendue : ancrer le motif des pièces vues de derrière (`body.panel === "back"`) en miroir du devant (grille calculée sur x = −x', ou tuile retournée), de façon identique dans `renderSurfaceSvg`, le canevas 2D et la peinture 3D du dos ; corriger le test pour comparer le même côté du porteur (dos en `−gx − back.body.x`), avec les 4 motifs et des points hors des bords des formes.
- [x] Édition à plat et 3D (pièces à leur place, manche miroir) : code relu (`canvas.tsx`, `viewer.tsx:177-192`) ; vérification visuelle de l'auteur, non refaite.
- 🧑‍💼 Atelier capable avant mise en vente ; gradation S–XXL, crans, motif image : reportés (BACKLOG).
Critères communs : C1 ✅ · C2 ✅ (aucun montant manipulé hors `pricing` ; ni table ni transition ajoutée ; action admin gardée ; version et devis figés : `allOver` est dans le document versionné) · C3 ✅ (grep secrets vide hors docs/consigne ; pas de `SAWWA_PREVIEW_FIXTURE` ; bouton « Créer les pièces » réellement branché) · C4 ✅ (messages en français : « Cette pièce n'a pas de seconde copie en miroir. », etc.) · C5 ❌ (le test de raccord ne teste pas la couture réelle, point 1) · C6 ✅ (D26, ROADMAP, BACKLOG 🔎 ; poussé ; `@resvg/resvg-js` 2.6.2 en devDependency de `render`, justifiée dans le compte rendu, même version que l'app).
Corrections à faire (par priorité) :
1. Raccord du motif au dos (miroir du repère vu de derrière) dans les fichiers, le studio et la 3D ; test de couture corrigé sur le même côté du porteur pour les 4 motifs.
Remarques non bloquantes :
- Le contour (`zones.anchor.pattern`) est relu en direct dans le catalogue à la production, pas figé avec la commande ; comme les tailles de zones avant E18b. À figer quand les patrons de l'atelier remplaceront ceux de référence.
- Sans motif continu, une pièce sans surface (ex. manches) n'est ni chiffrée ni signalée : elle sortira en tissu blanc. Une remarque « pièces non imprimées » éviterait la surprise.
- Seconde manche en miroir : avec le damier, le miroir décale aussi la grille (même cause que le point 1).
Décision : reprendre E18b

## 2026-11-22 — E22 (partie gratuite : détourage, 2e passage) — VALIDÉ
Commit examiné : 1f7025d (depuis a0330bf), `git status` propre après build, HEAD = `origin/claude/sawwa-audit-cto-r8vt01`
Contrôles : typecheck ✅ · tests ✅ (145) · db ✅ (ALL RLS TESTS PASSED) · build ✅ (code de sortie 0). Tout relancé.
Vérification navigateur : non refaite (mesure de l'auteur au 1er passage).
Critères de l'étape :
- [x] Détourage dans le navigateur, modèle et moteur servis par SAWWA, erreurs claires, recadrage annulable : acquis au 1er passage, inchangés.
- [x] Moteur non versionné : `.gitignore:13` = `apps/web/public/ort/` (commité) ; `git check-ignore -v apps/web/public/ort/ort-wasm-simd-threaded.wasm` → `.gitignore:13` ; aucun fichier non suivi après `pnpm build`.
- [x] Remarque traitée : `hasSubject` (seuil 0,5 sur la sortie brute, `segment-ops.ts:44`) appliqué avant `applyMask` (`segment.ts:41`) ; `null` → « Aucun sujet net trouvé… » (`image-tools.tsx:99`) ; test ajouté (`segment-ops.test.ts:29`).
- 🧑‍💼 Génération de motifs : en attente du budget du porteur. Agrandissement : reporté.
Critères communs : C1 ✅ · C2 ✅ (sans objet : ni argent, ni prix, ni statut) · C3 ✅ · C4 ✅ · C5 ✅ · C6 ✅ (D25, ROADMAP, BACKLOG ; poussé ; dépendance `onnxruntime-web` justifiée dans D25).
Corrections à faire : aucune.
Remarques non bloquantes :
- Le `.wasm` de 15 Mo reste dans l'historique (d139b9e) : réécriture éventuelle à la décision du porteur.
- L'auteur a commité l'entrée « À CORRIGER » de ce journal dans 1f7025d : acceptable, contenu inchangé.
Décision : passer à E18b (partie code ; la mise en vente attend un atelier capable 🧑‍💼)

## 2026-11-22 — E22 (partie gratuite : détourage) — À CORRIGER
Commit examiné : a0330bf (depuis cf8e4b0), branche à jour avec `origin`, **mais `git status` non propre : `.gitignore` modifié et non commité**
Contrôles : typecheck ✅ · tests ✅ (144, 25 fichiers) · db ✅ (ALL RLS TESTS PASSED) · build ✅ (code de sortie 0, « onnxruntime-web files copied to public/ort »). Tout relancé.
Vérification navigateur : non refaite (mesure de l'auteur : 800×600 → 2,8 s, coin transparent, centre opaque).
Critères de l'étape :
- [x] Détourage dans le navigateur, sans service externe : `segment.ts` charge `onnxruntime-web/wasm` à la demande, `wasmPaths = "/ort/"`, modèle `/models/u2netp.onnx`, 1 fil, session en cache et remise à zéro en cas d'échec ; aucun appel réseau tiers.
- [x] Modèle servi par SAWWA, licence et empreinte : `public/models/README.md` + `LICENSE-U2NET` ; SHA-256 recalculé `309c8469…4ddd8`, identique au README.
- [x] Parties pures testées : `segment-ops.test.ts` (normalisation NCHW, masque agrandi, sujet conservé, fond effacé, couleurs et original intacts).
- [x] Résultat recadré, taille réelle et position conservées, annulable : `image-tools.tsx:93-101` réutilise `crop` + `croppedGeometry` + `replacePixels` comme les outils E18c validés.
- [x] Erreurs claires en français, état de chargement dédié, taille du téléchargement annoncée (`image-tools.tsx:95-102`, `:184`).
- [x] Moteur copié à la construction (`scripts/copy-ort.mjs`, `prebuild`/`predev`), vérifié dans le journal de build.
- [ ] Moteur non versionné : **à HEAD, le motif `.gitignore` commité est `public/ort/`** ; comme il contient une barre oblique, Git l'ancre à la racine du dépôt et il **n'ignore pas** `apps/web/public/ort/`. Après tout `pnpm build`/`dev`, le `.wasm` de 15 Mo réapparaît en fichier non suivi et sera recommité au prochain `git add -A`. Le bon motif `apps/web/public/ort/` existe dans la copie de travail mais n'est ni commité ni poussé (`git diff .gitignore`).
  → correction attendue : commiter et pousser `.gitignore` avec `apps/web/public/ort/` (vérifier `git check-ignore -v apps/web/public/ort/ort-wasm-simd-threaded.wasm` après un build).
- 🧑‍💼 Génération de motifs : en attente du budget du porteur. Agrandissement : reporté (accepté, documenté dans BACKLOG E22).
Critères communs : C1 ✅ · C2 ✅ (ni argent, ni prix, ni statut touchés) · C3 ✅ (grep secrets : seulement des commentaires/grants `service_role` dans les migrations ; pas de `SAWWA_PREVIEW_FIXTURE` ; bouton réellement branché) · C4 ✅ · C5 ✅ · C6 ❌ (D25, ROADMAP, BACKLOG 🔎 à jour, nouvelle dépendance justifiée dans D25 ; mais correctif `.gitignore` non commité, état du dépôt poussé incorrect).
Corrections à faire (par priorité) :
1. Commiter et pousser le `.gitignore` corrigé (`apps/web/public/ort/`).
Remarques non bloquantes :
- Le `.wasm` de 15 Mo reste dans l'historique (d139b9e) : réécriture à décider par le porteur, pas exigée.
- `applyMask` normalise min-max : sur une image sans sujet net, le bruit du masque est étiré à 0..1, donc le message « Aucun sujet trouvé » ne se déclenchera presque jamais ; envisager un seuil sur le maximum brut (la sortie d0 est déjà une sigmoïde 0..1).
- Réordonnancement alphabétique de `apps/web/package.json` (sans effet fonctionnel).
Décision : reprendre E22 (un commit), puis passer à E18b

## 2026-11-22 — E21 (2e passage) — VALIDÉ
Commit examiné : 05a6581 (depuis 2609e7d), `git status` propre, branche à jour avec `origin`
Contrôles : typecheck ✅ · tests ✅ (142) · db ✅ (ALL RLS TESTS PASSED) · build ✅ (code de sortie 0). Tout relancé.
Vérification navigateur : non faite (pages dépendantes de la base, pas de Supabase réel).
Critères de l'étape :
- [x] Capacité et fermetures à l'affectation : acquis au 1er passage, inchangés (commentaire de `capacity.ts` corrigé).
- [x] Plusieurs utilisateurs par atelier, opérateur sans argent ni offres :
  - RLS : `offers_read`, `offer_variants_read`, `capabilities_read`, `grids_read` recréées avec `is_org_manager` (migration 11, fin) ; rôles plateforme inchangés. Les lectures de devis, catalogue public, B2B et affectation passent par le client service (`quoting.ts:34`, `catalog-public.ts:34`, `b2b.ts:39`, `assignment.ts`) et ne dépendent donc pas de ces politiques.
  - Tests section 19 : l'opérateur ne lit ni offres, ni variantes, ni capacités, ni grilles ; le propriétaire lit les siennes ; un gérant ne peut pas inviter un gérant mais peut inviter un opérateur.
  - Interface : `/pro/offres` et `/pro/offres/[productId]` redirigent l'opérateur (`!canManage`) ; `/pro/commandes/[id]` ne sélectionne plus `vendor_cost` dans la requête principale et ne le lit et l'affiche que pour propriétaire et gérant (`canSeeAmount`).
  - `accept_vendor_invitation` revérifie que l'atelier est actif.
Critères communs : C1 ✅ · C2 ✅ (permissions serveur et RLS alignées sur D24) · C3 ✅ (grep secrets vide dans apps/packages/supabase ; pas de `SAWWA_PREVIEW_FIXTURE`) · C4 ✅ · C5 ✅ (tests SQL d'accès opérateur, gérant) · C6 ✅ (D24 précisée ; poussé ; aucune nouvelle dépendance).
Corrections à faire : aucune.
Remarques non bloquantes :
- `fulfillments.vendor_cost` reste lisible par l'API pour un opérateur (montant de son propre atelier) ; écart assumé et documenté dans D24, à fermer à la revue de sécurité (E24) par privilège de colonne ou vue.
- Migration 11 modifiée sur place : acceptable tant qu'aucune base réelle ne l'a appliquée (avant E11).
Décision : passer à E22 (partie gratuite : détourage dans le navigateur ; la génération de motifs attend le budget du porteur 🧑‍💼)

## 2026-11-22 — E21 — À CORRIGER
Commit examiné : 2609e7d (depuis f013e48), `git status` propre, branche à jour avec `origin`
Contrôles : typecheck ✅ · tests ✅ (142, 24 fichiers) · db ✅ (ALL RLS TESTS PASSED) · build ✅ (code de sortie 0). Tout relancé.
Vérification navigateur : non faite (pages dépendantes de la base, pas de Supabase réel).
Critères de l'étape :
- [x] Capacité et fermetures à l'affectation : `capacityCheck` pur (lun–sam, fermetures sautées pour le travail mais pas pour la promesse, fermetures enchaînées, capacité non déclarée → délai) testé (`lib/capacity.test.ts`, 5 tests) ; charge en cours + commande ÷ capacité (`lib/assignment.ts`, statuts actifs) ; tri disponibles d'abord puis marge (`assignment.ts`, `rank`) ; affectation à un atelier fermé refusée côté serveur (`admin/commandes/actions.ts:35`) ; marge via `splitGross` de `@sawwa/domain` au taux du jeu de règles figé. `vendor_closures` : RLS + tests (autre atelier ne lit pas, opérateur n'écrit pas).
- [ ] Plusieurs utilisateurs par atelier : invitation par téléphone 7 j, acceptation par le bon numéro (format sans +), un compte = un atelier, propriétaire/gérant/opérateur, au moins un propriétaire, opérateur sans équipe ni disponibilités ni grand livre/versements : tout cela est en place et testé (section 19). **Écart** : le critère « l'opérateur ne voit ni l'argent ni les offres » n'est pas tenu.
  - `/pro/offres` et `/pro/offres/[productId]` n'ont aucun contrôle de rôle (`offres/page.tsx:9`, `offres/[productId]/page.tsx:26`) : l'opérateur y accède par URL et voit la grille de prix de l'atelier (seule l'enregistrement est refusé, `offres/actions.ts:10`).
  - `/pro/commandes/[id]/page.tsx:119` affiche à l'opérateur « Montant atelier pour cette commande : … FCFA HT » (`vendor_cost`).
  - En base, D24 affirme « les droits sont dans la base (RLS…) », mais `offers_read` et `grids_read` (migration core :343, :367) restent ouverts à `app.is_member`, donc à l'opérateur ; `fulfillments.vendor_cost` lui est lisible aussi. Aucun test SQL ne vérifie qu'un opérateur ne lit pas offres/grilles.
  → correction attendue : rediriger l'opérateur hors de `/pro/offres*` et masquer `vendor_cost` pour lui ; restreindre `offers_read` / `offer_variants_read` / `grids_read` (et capacités de zone si jugé « offre ») à `is_org_manager` pour les membres d'atelier, en vérifiant que la page commande de l'opérateur n'en dépend pas ; pour `vendor_cost`, ne pas le sélectionner pour l'opérateur (ou privilège de colonne / vue) ; ajouter les cas « opérateur ne lit ni offres ni grilles » dans la section 19.
Critères communs : C1 ✅ · C2 ❌ (montants en entiers, marge via `domain`, transitions via `runTransition`, table neuve avec RLS ; mais permission opérateur non appliquée côté serveur pour offres et montant atelier, point 1) · C3 ✅ (grep secrets vide dans apps/packages/supabase ; pas de `SAWWA_PREVIEW_FIXTURE`) · C4 ✅ (messages en français, états vides) · C5 ❌ (pas de test d'accès opérateur aux offres/grilles) · C6 ✅ (D24, DATABASE, ROADMAP, BACKLOG 🔎 ; poussé ; aucune nouvelle dépendance).
Corrections à faire (par priorité) :
1. Opérateur : interdire la lecture des offres et grilles (pages `/pro/offres*` + politiques RLS) et masquer le montant atelier de `/pro/commandes/[id]` ; tests SQL dans la section 19.
Remarques non bloquantes :
- `accept_vendor_invitation` ne revérifie pas que l'atelier est encore actif (`my_vendor_invitations` le filtre, pas l'acceptation directe par id).
- Commentaire obsolète dans `lib/capacity.ts` (« closures skipped only when `withClosures` ») : le paramètre n'existe pas.
- Pas de test SQL d'un gérant qui tenterait d'inviter un gérant (refus présent dans `invite_vendor_member`).
Décision : reprendre E21

## 2026-11-22 — E20 (2e passage) — VALIDÉ
Commit examiné : cab0fc6 (depuis 77f6f85), `git status` propre, branche à jour avec `origin`
Contrôles : typecheck ✅ · tests ✅ (137, 23 fichiers) · db ✅ (ALL RLS TESTS PASSED) · build ✅ (code de sortie 0). Tout relancé.
Vérification navigateur : non faite (pas de Supabase réel). Bout en bout réel : en attente du porteur (E11).
Critères de l'étape :
- [x] Tableau de bord : HT des articles = `splitGross(money(total − livraison), vatBps).net` de `@sawwa/domain` (`lib/dashboard.ts:41`), même découpage que `goodsNet` (`packages/pricing/src/price.ts:180`), au taux du jeu de règles figé de chaque commande (`quote_snapshot.ruleSetVersion` → `price_rule_sets`, lisible par ops/finance, `tableau-de-bord/page.tsx:26-27`). Test refait avec des montants du moteur (13 800 TTC dont 2 000 de livraison, TVA 2 105 vérifiée par `splitGross` → 10 000 HT) ; commandes payées sans atelier comptées et signalées (« marge provisoire »).
- [x] Litiges : `resolve_dispute` refuse les décisions incohérentes (migration :106-113 : non retenu avec remboursement, pénalité ou faute ; montant hors remboursement partiel ; partiel sans montant ; pénalité sans faute ou faute sans pénalité ; statut ou décision inconnus) ; l'action applique les mêmes règles avec des messages en français et n'envoie un montant que pour `partial_refund` (`admin/litiges/actions.ts:23-31`). 3 tests SQL (pénalité sur litige non retenu, remboursement avec « aucune compensation », partiel sans montant).
- [x] Grand livre, versements, relevés, export : acquis au 1er passage, inchangés ; en plus, ajustement finance sans `fulfillment_id` et non antidaté (politique `ledger_adjust`), testé (antidaté refusé, atelier refusé).
Critères communs : C1 ✅ · C2 ✅ (HT via `domain`, plus de calcul refait à la main ; permissions serveur ; tables avec RLS et tests) · C3 ✅ (grep secrets vide dans apps/packages ; pas de `SAWWA_PREVIEW_FIXTURE`) · C4 ✅ · C5 ✅ · C6 ✅ (D23 complétée : refabrication manuelle, calcul du tableau de bord ; poussé ; aucune nouvelle dépendance).
Corrections à faire : aucune.
Remarques non bloquantes :
- Si le jeu de règles d'une commande est introuvable, le taux retombe sur 1 800 pb sans le signaler (`tableau-de-bord/page.tsx:27`) ; à journaliser le jour où un 2e taux existera.
- Le refus d'un ajustement par `ops` n'est toujours pas testé (seul l'atelier l'est) ; la politique le couvre (`has_platform_role('{finance}')`).
- La migration 10 a été modifiée sur place : acceptable tant qu'aucune base réelle ne l'a appliquée (avant E11).
Décision : passer à E21

## 2026-11-22 — E20 — À CORRIGER
Commit examiné : 77f6f85 (depuis 5c2799e, wip 96f4ec0 inclus), `git status` propre, branche à jour avec `origin`
Contrôles : typecheck ✅ · tests ✅ (136, 23 fichiers) · db ✅ (ALL RLS TESTS PASSED) · build ✅ (code de sortie 0 ; routes `/admin/tableau-de-bord`, `/admin/litiges`, `/admin/finances[/vendorId]`, `/pro/releve`, `/api/export` présentes)
Vérification navigateur : non faite (pas de Supabase réel). Bout en bout réel : en attente du porteur (E11).
Critères de l'étape :
- [ ] Tableau de bord : périodes 7/30/90/365, rôles ops/finance (`tableau-de-bord/page.tsx:12`), délais, BAT refusés, litiges et signalements testés (`dashboard.test.ts`). **Écart** : le CA HT est faux dès qu'il y a des frais de livraison. `lib/dashboard.ts:38` calcule `total − tax − shipping`, or `tax` est la TVA de **tout** le total, livraison comprise (`packages/pricing/src/price.ts:179`) et `shipping` est TTC : la TVA de la livraison est retirée deux fois. Exemple réel : articles 11 800 + livraison 2 000 → tax 2 105 → affiché 9 695 au lieu de 10 000 HT ; la marge brute et son taux (critère go/no-go « marge réelle ±20 % ») sont sous-évalués. Le test ne le voit pas car son jeu de données est incohérent (`dashboard.test.ts:13` : total 13 800, tax 1 800, livraison 2 000, impossible à 18 %). → correction attendue : obtenir le HT des articles par la fonction de `packages/domain`/`packages/pricing` (`splitGross(total − livraison)`, comme `goodsNet` dans `price.ts:180`) ou lire le chiffre figé du devis, et corriger le test avec des montants issus du moteur de prix.
- [ ] Litiges : ouverture client limitée à sa commande expédiée/livrée et à ses photos (trigger `app.check_dispute`, tests section 18), photos client et de contrôle en liens signés pour l'équipe (`admin/litiges/page.tsx:24-32`), décision unique, remboursement ≤ total, pénalité au grand livre dans la même transaction (testé). **Écart** : la décision accepte des combinaisons incohérentes qui s'écrivent en comptabilité. Dans `admin/litiges/actions.ts:16-31`, « Non retenu » ou « Aucune compensation » / « Refabrication » transmettent quand même `refund` (montant saisi) et `vendor_liable`/`penalty` ; `resolve_dispute` (migration :106-115) les enregistre. Un litige « Non retenu » peut donc inscrire une pénalité irréversible au grand livre de l'atelier, et un « Aucune compensation » afficher « X FCFA remboursés » au client et dans l'export. → correction attendue : remboursement seulement pour `partial_refund` (total pour `full_refund`, sinon nul) et aucune pénalité si `rejected`, vérifié dans l'action **et** dans `resolve_dispute` (ou contrainte de table), avec un test SQL.
- [x] Grand livre en écriture seule (`forbid_change`, test de modification refusée), gain unique au coût figé par trigger à la livraison (testé, y compris double livraison), versement plafonné au solde sous verrou consultatif (`record_payout`, testé au-dessus du solde), réservé au service (atelier refusé, testé), ajustement finance justifié + audit, relevés admin et `/pro/releve` (lien vers l'ordre de fabrication correct), lecture refusée à un autre atelier (testé).
- [x] Export CSV : rôles finance/ops (`api/export/route.ts:17`), lecture avec la session (RLS), période validée, BOM + « ; » + CRLF, neutralisation `= + - @` hors nombres (`csv.test.ts`), messages d'erreur en français. D23 ajoutée.
Critères communs : C1 ✅ · C2 ❌ (montants en entiers, pas de transition de statut hors workflow, permissions serveur, tables neuves avec RLS et tests ; mais calcul HT refait à la main hors `pricing`/`domain` et faux, point 1) · C3 ✅ (grep secrets vide dans apps/packages ; pas de `SAWWA_PREVIEW_FIXTURE`) · C4 ✅ · C5 ❌ (test du tableau de bord sur des données impossibles ; pas de test des décisions incohérentes) · C6 ✅ (D23, DATABASE, ROADMAP, BACKLOG 🔎 ; poussé ; aucune nouvelle dépendance).
Corrections à faire (par priorité) :
1. Corriger le CA HT / la marge du tableau de bord (TVA de livraison retirée deux fois) en passant par `domain`/`pricing`, et refaire le test avec des montants cohérents.
2. Rendre la décision de litige cohérente (pas de remboursement hors `partial_refund`/`full_refund`, pas de pénalité si « Non retenu »), dans l'action et dans `resolve_dispute`, avec test SQL.
Remarques non bloquantes :
- Pour le rôle finance, la tuile « Signalements à modérer » affiche toujours 0 (pas de lecture RLS sur `content_reports`) : la masquer ou l'indiquer.
- Le test « finance ajuste, ops ne peut pas » (rls.test.sql, section 18) n'essaie pas l'insertion par ops ; la politique `ledger_adjust` laisse aussi la finance fixer `at` (antidater) et un `fulfillment_id` quelconque.
- Marge : les commandes payées sans atelier affecté comptent 0 de coût (marge gonflée) ; « Refabrication » n'ouvre aucun nouvel ordre de fabrication (manuel, à documenter).
Décision : reprendre E20

## 2026-11-22 — E18d (2e passage) — VALIDÉ
Commit examiné : 510e4ac (depuis 987d89c), `git status` propre, branche à jour avec `origin`
Contrôles : typecheck ✅ · tests ✅ (131) · db ✅ (ALL RLS TESTS PASSED) · build ✅ (code de sortie 0). Tout relancé.
Vérification navigateur : non refaite (pas de Supabase réel) ; l'auteur indique avoir testé deux comptes sur le même navigateur. Bout en bout réel : en attente du porteur (E11).
Critères de l'étape :
- [x] Déclaration de droits rattachée au compte : clé `sawwa:droits-images:<userId>` (`studio.tsx:66`), rien de lu ni d'écrit sans connexion (`:81-85`, `:517`) ; `saveToAccount` ouvre la fenêtre si la création contient des images importées sans accord de ce compte, puis enregistre avec `rightsDeclared` uniquement après cet accord (`:252-257`, `:280`). Un 2e compte n'hérite plus de l'accord du 1er. Contrôles serveur inchangés (enregistrement, commande, logo du devis).
- [x] Signalements, file de modération, refus motivés au BAT : acquis au 1er passage, inchangés.
- [x] Remarques du 1er passage traitées : l'ancienne création sans déclaration ouvre désormais la fenêtre à l'enregistrement ; trigger `app.guard_report_resolution` (décision unique depuis `open`, contenu du signalement figé) testé (réouverture refusée, réécriture refusée) ; test « un atelier ne lit pas la file » ajouté (section 17).
Critères communs : C1 ✅ · C2 ✅ · C3 ✅ (grep secrets vide dans apps/packages ; pas de `SAWWA_PREVIEW_FIXTURE`) · C4 ✅ · C5 ✅ · C6 ✅ (D22, DATABASE, ROADMAP ; poussé ; aucune nouvelle dépendance).
Corrections à faire : aucune.
Remarques non bloquantes :
- Le trigger a été ajouté dans la migration 9 existante au lieu d'une nouvelle migration : acceptable tant qu'aucune base réelle n'a appliqué la migration 9 (E11 pas encore fait). Après cette date, ne plus modifier une migration publiée.
- Quand la fenêtre s'ouvre depuis « Commander », la commande s'arrête après l'accord et l'enregistrement : le client doit cliquer de nouveau sur « Commander ». À fluidifier plus tard.
- Toujours ouvert : le client n'est pas prévenu automatiquement quand un signalement sur sa commande est retenu (à faire avec les notifications) ; aucun test SQL pour le rôle `support`.
Décision : passer à E20

## 2026-11-22 — E18d — À CORRIGER
Commit examiné : 987d89c (depuis 887f845, wip 05e25f4 inclus), `git status` propre, branche à jour avec `origin`
Contrôles : typecheck ✅ · tests ✅ (131, 21 fichiers) · db ✅ (ALL RLS TESTS PASSED) · build ✅ (code de sortie 0, routes `/admin/moderation` et `/signaler` présentes)
Vérification navigateur : non refaite (pas de Supabase réel) ; celle de l'auteur couvre la fenêtre de droits. Bout en bout réel : en attente du porteur (E11).
Critères de l'étape :
- [ ] Déclaration de droits : fenêtre avant l'import (`studio.tsx` `requireRights` sur l'outil Image et `guard` de l'assistant), case requise pour le logo du devis (`devis/actions.ts:34`), refus serveur à l'enregistrement (`studio/[slug]/actions.ts:45`) et à la commande (`:105`), `needsRightsDeclaration` testé (`design-ownership.test.ts:28`). **Écart** : l'accord est gardé dans `localStorage` sous une clé unique `sawwa:droits-images` (`studio.tsx:64`, `:79`), sans lien avec le compte. Sur un téléphone partagé, un deuxième compte importe sans voir la fenêtre, et `saveDesign` enregistre pour lui `rights_declared_at` (`rightsDeclared: rightsOk`, `studio.tsx:268`) : la base atteste une déclaration que cette personne n'a jamais faite. → correction attendue : rattacher l'accord au compte (clé contenant `userId`, ou relecture d'une date côté serveur) et n'envoyer `rightsDeclared` que pour un accord donné par cet utilisateur.
- [x] Signalement : atelier depuis la fiche de production (`pro/commandes/[id]/page.tsx`, section « Droits et contenu »), personne connectée depuis `/signaler?modele=` (lien dans l'assistant), limite `reportPerUser`. La base vérifie la visibilité : trigger `app.check_content_report` (modèle publié ; commande du client ou de l'atelier affecté) et politique d'insertion (`reporter_id = auth.uid()`, rôle `staff` réservé à ops/support). Tests section 17 : autre atelier refusé, commande d'un autre client refusée, modèle inconnu refusé, faux `staff` refusé, l'auteur ne voit que ses signalements et ne peut pas les trancher.
- [x] File `/admin/moderation` : `requirePlatformRole(["ops","support"])` dans la page et dans `resolveReport` ; décision écrite obligatoire (3 caractères min.) ; modèle archivé par le client serveur après contrôle du rôle ; commande mise en pause via `runTransition` `hold` (rôle admin, autorisé depuis tout statut actif, `workflow/fulfillment.ts:138`) ; `audit` `report.upheld|dismissed` ; badge « +48 h » ; onglets à traiter / traités ; état vide ; tuile dans `/admin`. Test SQL : ops lit la file et tranche.
- [x] Refus motivé au BAT : `RejectReason` étendu (`workflow/fulfillment.ts:25-29`), accepté par `vendorEvent`, libellés `REASON_LABEL`, explication et options (corriger / annuler et être remboursé) sur `compte/commandes/[id]`.
Critères communs : C1 ✅ · C2 ✅ (ni prix ni argent touchés ; mise en pause via `runTransition` ; permissions serveur ; table neuve avec RLS et tests) · C3 ❌ (point 1 : déclaration enregistrée au nom d'un compte qui ne l'a pas faite ; grep secrets vide dans apps/packages ; pas de `SAWWA_PREVIEW_FIXTURE`) · C4 ✅ · C5 ✅ · C6 ✅ (D22, DATABASE:106, ROADMAP:48, BACKLOG 🔎 ; poussé ; aucune nouvelle dépendance).
Corrections à faire (par priorité) :
1. Lier la déclaration de droits au compte (voir ci-dessus) ; vérifier qu'un 2e compte sur le même navigateur voit la fenêtre avant son premier import.
Remarques non bloquantes :
- Création avec images importées sans `rights_declared_at` (créée avant la migration 9) ouverte sur un appareil sans accord : l'enregistrement est refusé avec « case à cocher dans le studio », mais aucune case n'apparaît tant que le client ne clique pas sur Image. Ouvrir la fenêtre de droits sur cette erreur.
- `reports_resolve` laisse ops/support modifier toute colonne (cible, motif, auteur) et rouvrir un signalement ; un trigger limitant la mise à jour à `status`/`resolution_note`/`resolved_*` depuis `open` serait plus sûr.
- Une commande signalée et retenue n'informe pas le client automatiquement (contact manuel annoncé dans la file) ; à reprendre avec les notifications.
- Pas de test SQL pour le rôle `support` ni pour la lecture de la file par un atelier.
Décision : reprendre E18d

## 2026-11-22 — E17 (3e passage) — VALIDÉ
Commit examiné : a9e35f4 (depuis 1ba4942), branche à jour avec `origin`
Contrôles : typecheck ✅ · tests ✅ (130) · db ✅ (ALL RLS TESTS PASSED) · build ✅ (code de sortie 0). Tout relancé, car du code a changé.
Vérification navigateur : non refaite (pas de Supabase réel). Bout en bout sur un vrai projet : en attente du porteur (E11).
Critères de l'étape :
- [x] Formulaire, « Mes devis », annulation ; chiffrage interne hors de portée du client ; commande sur devis avec contrôle des tailles réelles ; migration 8 et section 16 : preuves du 2e passage, inchangées.
- [x] Point restant traité : `docs/DATABASE.md:106` décrit `b2b_quote_internals` (droits, ajout seul, jamais lisible par le client) et `guard_b2b_quote_link`.
- [x] Remarque traitée : `admin/devis/actions.ts` `sendB2bQuote` retire le devis (`withdrawn`) et renvoie une erreur si l'insertion des chiffres internes échoue.
Critères communs : C1 ✅ · C2 ✅ · C3 ✅ · C4 ✅ · C5 ✅ · C6 ✅ (D21, DATABASE, ROADMAP, BACKLOG ; poussé ; aucune nouvelle dépendance).
Corrections à faire : aucune.
Remarques non bloquantes :
- Dans ce cas d'échec, la version précédente a déjà été remplacée (`superseded`) : le client se retrouve sans devis valable jusqu'au nouvel envoi. L'erreur de la mise à jour `withdrawn` n'est pas vérifiée. Une fonction SQL unique (remplacement, devis et chiffres internes) réglerait les deux.
- Remarques du 2e passage toujours ouvertes : écart `lines` / `b2bSizeMix` à expliquer dans les futurs écrans ; pas de test unitaire de `repriceFrozen`.
Décision : passer à E18d

## 2026-11-22 — E17 (2e passage) — À CORRIGER
Commit examiné : 1ba4942 (depuis 6e69136), `git status` propre, branche à jour avec `origin`
Contrôles : typecheck ✅ · tests ✅ (130, 21 fichiers) · db ✅ (ALL RLS TESTS PASSED) · build ✅ (code de sortie 0)
Vérification navigateur : non refaite (pas de Supabase réel). Bout en bout sur un vrai projet : en attente du porteur (E11).
Critères de l'étape :
- [x] Formulaire `/devis`, « Mes devis », annulation : inchangés depuis le 1er passage ; `cancel_quote_request` refuse désormais une demande dont un devis est `accepted` (migration 8, testé section 16 « request cancelled while its quote is being ordered »).
- [x] Chiffrage interne : `sendB2bQuote` n'écrit plus que `q.snapshot` dans `b2b_quotes` ; coût atelier et marge dans `b2b_quote_internals` (migration 8 : RLS, lecture ops/support/finance, insertion ops/support, `forbid_change` en update/delete). Tests section 16 : client ne lit pas `b2b_quote_internals` ni `margin`/`vendorCost` dans `snapshot` ; finance lit devis et internes, n'écrit pas de devis. `compte/devis/[id]/page.tsx:17` : colonnes explicites, sans `snapshot`. `unit_price = q.lines[0].unitPrice` (moteur de prix).
- [x] Lien de commande, devis sans tailles : `repriceFrozen` (`lib/b2b.ts`) vérifie chaque taille réelle contre les variantes de la couleur présentes dans `grid.blanks` de la grille figée ; taille absente → `release_b2b_quote` + message français (`studio/[slug]/actions.ts`) ; prix recalculé avec les tailles réelles, montant du devis conservé et écart enregistré dans `quote_snapshot.b2bSizeMix` (sans coût atelier). D21 mis à jour. Trigger `guard_b2b_quote_link` (auteur figé, `order_id` posé une fois, par le serveur seulement) testé ; `link_b2b_quote` testé (lien, demande « ordered », plus libérable) ; suppression refusée testée.
- [x] Migration 8 et section 16 : voir ci-dessus.
Critères communs : C1 ✅ · C2 ✅ (entiers, prix via `packages/pricing`, aucune transition de commande ajoutée, nouvelle table avec RLS et tests) · C3 ✅ (grep secrets vide dans apps/packages ; pas de `SAWWA_PREVIEW_FIXTURE`) · C4 ✅ · C5 ✅ · C6 ❌ : `docs/DATABASE.md:106` (ligne de la migration 8) ne mentionne ni `b2b_quote_internals` ni le trigger `guard_b2b_quote_link` ; C6 exige `DATABASE.md` à jour à chaque migration.
Corrections à faire (par priorité) :
1. `docs/DATABASE.md` : ajouter `b2b_quote_internals` (coût atelier et marge, lecture ops/support/finance, insertion ops/support, append-only, jamais lisible par le client) et le verrou du lien `order_id`/`created_by` à la ligne de la migration 8.
Remarques non bloquantes :
- `sendB2bQuote` : si l'insertion dans `b2b_quote_internals` échoue, le devis est quand même envoyé, sans chiffres internes (seulement journalisé). Envisager une fonction SQL unique (devis + internes) ou un retour d'erreur.
- Quand l'écart de tailles existe, `quote_snapshot.lines` garde les lignes figées (toute la quantité sur une variante) ; la vérité est dans `b2bSizeMix`. À indiquer aux lecteurs du devis figé (finance, atelier) quand ces écrans arriveront.
- `repriceFrozen` sans test unitaire (taille manquante, écart de prix) ; les cas sont simples, mais un test protégerait la règle.
Décision : reprendre E17 (correction documentaire seule ; pas besoin de relancer les contrôles de code si seul `docs/DATABASE.md` change)

## 2026-11-22 — E17 — À CORRIGER
Commit examiné : 6e69136 (depuis 8c8e63e ; 5a401f7 = skills tiers, hors périmètre), `git status` propre, branche à jour avec `origin`
Contrôles : typecheck ✅ · tests ✅ (130, 21 fichiers) · db ✅ (ALL RLS TESTS PASSED) · build ✅ (code de sortie 0)
Vérification navigateur : non refaite (pas de Supabase réel). Bout en bout sur un vrai projet : en attente du porteur (E11).
Critères de l'étape :
- [x] Formulaire `/devis` : `(vitrine)/devis/actions.ts` (session, limite de débit, contrôles et messages français, logo limité au dossier du client) ; deuxième barrière SQL `app.check_quote_request` (logo et création du client) ; « Mes devis » `compte/devis` ; annulation `cancel_quote_request` (testée, devis retiré).
- [ ] Chiffrage par l'équipe : rôle ops/support (`admin/devis/actions.ts` `staff()`), prix par `bestQuote`, coût atelier et marge en aperçu, validité 1-90 j, version précédente remplacée, refus motivé, audit ✅ … **mais** « coût atelier et marge visibles en interne » n'est pas tenu : `sendB2bQuote` écrit `snapshot: { ...q.snapshot, vendorCost, margin }` (`admin/devis/actions.ts`, insert `b2b_quotes`) et la politique `b2b_quotes_read` (migration 8) donne au client la lecture de toutes les colonnes de ses devis, `snapshot` compris (aucune restriction de colonnes). Le client lit donc la marge SAWWA et le coût de l'atelier par l'API Supabase avec sa session ; la page `compte/devis/[id]/page.tsx:17` charge d'ailleurs `b2b_quotes(*)`. → correction attendue : point 1.
- [ ] Lien de commande : contrôles produit/couleur/quantité/tailles/`fitsQuote`, réservation atomique, rejeu `repriceFrozen` + vérification du montant, libération si échec, liaison après succès ✅ (`studio/[slug]/actions.ts`, tests SQL de `claim`/`release`) … **mais** devis sans tailles (`sizes` null) : le rejeu reprend les lignes figées (toute la quantité sur la première variante, `quoting.ts:65`) et le serveur ne vérifie pas que l'atelier figé (`snapshot.vendorId`) propose les tailles choisies par le client dans sa grille. Une commande peut ainsi partir avec des tailles que l'atelier pressenti ne fabrique pas, et `quote_snapshot.lines` ne correspond pas à `order_items.sizes`. → correction attendue : point 2.
- [x] Migration 8 : tables, devis figés (trigger `freeze_b2b_quote`, `no_delete`), versions uniques, RLS sur les deux tables ; section 16 de `rls.test.sql` (demande déjà chiffrée refusée, logo d'autrui refusé, statut non modifiable par le client, atelier sans accès, prix figé, client lecteur non écrivain, `claim` interdit au client, expiré / autre client / double réservation refusés, libération, annulation).
Critères communs : C1 ✅ · C2 ❌ (montants entiers, prix via `packages/pricing`, aucune transition de commande ajoutée ; mais donnée interne exposée au client par la RLS, point 1) · C3 ✅ (grep secrets vide ; pas de `SAWWA_PREVIEW_FIXTURE`) · C4 ✅ · C5 ✅ (`b2b.test.ts`, section 16) · C6 ✅ (D21, ROADMAP, DATABASE, BACKLOG ; aucune nouvelle dépendance ; poussé).
Corrections à faire (par priorité) :
1. Ne plus exposer coût atelier et marge au client : les retirer de `b2b_quotes.snapshot` (les recalculer à l'aperçu admin, ou les stocker dans une colonne/table lisible seulement par ops/support/finance), et ajouter dans la section 16 un test « le client ne lit ni coût atelier ni marge ». Remplacer `b2b_quotes(*)` par une liste de colonnes dans `compte/devis/[id]/page.tsx`.
2. Commande sur devis sans tailles : vérifier côté serveur que chaque taille choisie existe dans la grille de l'atelier figé pour la couleur (sinon message clair), et rejouer le prix avec les lignes réelles du client tout en gardant le montant du devis (ou, à défaut, enregistrer dans `p_quote` la répartition réelle et documenter l'écart dans D21).
Remarques non bloquantes :
- `unit_price: Math.round(goods/quantity)` est calculé dans l'action admin : chiffre d'affichage, mais à obtenir de `packages/pricing` (règle 4).
- `order_id` et `created_by` ne sont pas dans la liste figée du trigger : un membre ops/support peut relier un devis à n'importe quelle commande.
- Le client peut annuler une demande dont le devis est réservé (`accepted`) pendant la création de la commande ; `link_b2b_quote` la repasse ensuite en « ordered ». Exclure ce cas dans `cancel_quote_request`.
- Section 16 : pas de test de lecture par finance, d'écriture refusée à finance, de suppression refusée ni de `link_b2b_quote`.
Décision : reprendre E17

## 2026-11-22 — E16 — VALIDÉ
Commit examiné : 51718ff (depuis 22daeb5), `git status` propre, branche à jour avec `origin`
Contrôles : typecheck ✅ · tests ✅ (127, 20 fichiers) · db ✅ (ALL RLS TESTS PASSED) · build ✅
Vérification navigateur : non refaite (pas de Supabase réel ; faite par l'auteur avec un jeu temporaire retiré). Bout en bout sur un vrai projet : en attente du porteur (E11).
Critères de l'étape :
- [x] Texte variable : `TextLayer.perItem` validé par `parseDesign` (`document.ts`, clé name/number, longueur 1-30 / 1-3, incompatible avec `field`) ; test « refuses a variable text badly declared » ; `PerItemEditor` et outil « Nom + n° » (`roster-panel.tsx`, `studio.tsx`) ; D20.
- [x] Liste à la commande : `parseRosterText` (colonnes dans n'importe quel ordre, test dédié), `checkRoster` (taille, longueur, caractères, chiffres, débordement de zone, doublons en avertissement ; test « checks sizes, lengths, characters, digits and the print zone ») ; contrôle refait sur le serveur avec les tailles réelles de la couleur (`actions.ts` placeOrder, bloc E16) ; tailles et quantité tirées de la liste (`sizesFromRoster`) ; prix via `widestPiece` au studio (`studio.tsx`, `decorations`) et au serveur (`actions.ts`), calcul toujours dans `bestQuote`/pricing.
- [x] Liste figée : migration 7 (contrainte longueur = quantité, trigger `freeze_roster`), `create_order` reprend la version de la migration 4 (historique `order_item_versions` conservé) ; tests section 15 (liste enregistrée, modification refusée, liste de 1 pour 3 pièces refusée, client lit, autre atelier ne lit pas) ; correction contrôlée avec la liste figée et ajout de nom/numéro refusé en correction (`actions.ts` resubmitCorrection) ; affichage client/admin/atelier (`roster-list.tsx`, pages commandes).
- [x] Production : `?piece=N` (pièce inconnue → 400, zone variable sans pièce → 400, nom de fichier taille-numéro-nom), zone fixe en un seul fichier, accès inchangé (atelier affecté actif ou ops) ; fiche PDF avec liste à cocher (`sheet.ts`, test dans `render.test.ts`).
- [ ] Reporté (imposition DTF, supplément par pièce) : hors périmètre déclaré, non bloquant.
Critères communs : C1 ✅ · C2 ✅ (entiers, prix via pricing sur `widestPiece`, aucune transition ajoutée, contrôle serveur, colonne sous RLS existante + tests, liste figée comme version et devis) · C3 ✅ (grep secrets vide dans apps/packages ; pas de `SAWWA_PREVIEW_FIXTURE`) · C4 ✅ (messages français numérotés par ligne) · C5 ✅ · C6 ✅ (D20, ROADMAP, DATABASE, BACKLOG ; commit poussé ; aucune nouvelle dépendance).
Corrections à faire : aucune.
Remarques non bloquantes :
- La largeur d'une pièce est estimée au prorata du nombre de caractères (`personalize`) : « MBAYE » plus large que l'exemple à nombre égal de lettres peut déborder sans être signalé et être sous-tarifé. Mesurer avec les métriques de police quand c'est possible.
- `rls.test.sql` section 15 ne vérifie pas que l'atelier **affecté** lit la liste (seul le refus à un autre atelier est testé).
- Côté SQL, seules la forme et la longueur de la liste sont contrôlées (pas la cohérence `sizes` ↔ tailles de la liste) ; deuxième barrière à renforcer si d'autres appelants de `create_order` apparaissent.
Décision : passer à E17

## 2026-11-22 — E15 — VALIDÉ
Commit examiné : d3008f0 (depuis 308524f), `git status` propre, branche à jour avec `origin`
Contrôles : typecheck ✅ · tests ✅ (118, 19 fichiers) · db ✅ (ALL RLS TESTS PASSED) · build ✅ (`/modeles`, `/admin/modeles` générées)
Vérification navigateur : non refaite (pas de Supabase réel ; l'auteur l'a faite avec un jeu temporaire retiré). Bout en bout sur un vrai projet : en attente du porteur (E11).
Critères de l'étape :
- [x] Table `templates` + RLS + tests : `20261122000600_templates.sql` (RLS l. 45-50 : public = publié et produit actif, écriture `catalog`) ; contrôle SQL à la publication (trigger l. 26-43 : champ client, produit actif, document du bon produit) ; bucket `template-assets` insert seul, sans update/delete (l. 53-60). Tests `rls.test.sql` section 14 : publication sans champ refusée, document d'un autre produit refusé, occasion inconnue refusée, anon/atelier voient 1 modèle (publié), client ne modifie ni ne crée, client n'envoie pas d'image, catalogue voit les brouillons, suppression d'image sans effet, anon lit l'image.
- [x] Champ `field` validé (`document.ts:129-134` : photo sur image, texte sur texte, libellé ≤ 60, maxLength 1-200) ; `template.ts` (templateFields, fillText, coverCrop, fillPhoto, templateBlockers) couvert par `template.test.ts` (5 tests).
- [x] Admin : `admin/modeles/actions.ts` (rôle `catalog` via `requirePlatformRole`, `templateBlockers` avant publication, erreur 23514 traduite, audit create/statut) ; `template-actions.ts` (rôle vérifié, images obligatoirement dans `template-assets`, produit cohérent, modèle publié incomplet refusé, audit) ; `?gabarit=` → `notFound()` hors équipe catalogue (`studio/[slug]/page.tsx`).
- [x] Client : galerie `/modeles` par occasion et `?produit=`, états vide et indisponible ; assistant `?modele=` (seulement publié et du bon produit, `templates.ts` `publishedTemplate`), photo recadrée `coverCrop`, texte limité, prix et contrôle de fabrication hors du panneau assistant, « Modifier librement », brouillon par clé `:modele:<slug>`, retour après connexion sur le modèle.
- [x] Images de modèles acceptées dans une création client (`design-ownership.ts`, test ajouté) et lues par le fichier de production (`api/production/.../route.ts` via `storageRef`) ; non modifiables → règle 7 tenue.
Critères communs : C1 ✅ · C2 ✅ (aucun calcul de prix ni transition ajoutés ; permissions serveur + RLS ; table neuve avec RLS et tests) · C3 ✅ (grep secrets vide dans apps/packages ; pas de `SAWWA_PREVIEW_FIXTURE`) · C4 ✅ · C5 ✅ · C6 ✅ (D19, ROADMAP, DATABASE, BACKLOG ; commit poussé ; aucune nouvelle dépendance).
Corrections à faire : aucune.
Remarques non bloquantes :
- Le client peut commander sans remplacer la photo d'exemple ni remplir un texte (texte vide accepté par `fillText`). Signaler dans l'assistant un champ non rempli avant « Commander ».
- `listTemplates` (`templates.ts`) filtre le produit après `limit(60)` : au-delà de 60 modèles publiés, le filtre « par produit » peut en manquer. Filtrer côté requête.
- Test « anon ne lit pas design-assets » (`rls.test.sql`, fin de section 14) sans objet : aucun fichier `design-assets` n'existe à ce moment (insertion de la section 11 annulée). Insérer un fichier client avant de tester.
- Un brouillon d'assistant conservé sur l'appareil prend le pas sur une version plus récente du modèle ; acceptable, à garder en tête.
Décision : passer à E16

## 2026-11-22 — E18c — VALIDÉ
Commit examiné : 5dc90a3 (second passage ; corrections après c09736e), `git status` propre
Contrôles : typecheck ✅ · tests ✅ (112, 18 fichiers) · db ✅ (ALL RLS TESTS PASSED) · build ✅
Point du passage précédent :
1. [x] Palette de vectorisation : `dominantColors` (`image-ops.ts:197-245`) ne compte que les pixels intérieurs (4 voisins proches), choisit par fréquence (≥ 0,5 %, écart > 40) et cale chaque couleur sur la couleur exacte la plus fréquente de son groupe. Test `image-ops.test.ts` « ignores anti-aliased edges » (logo sur-échantillonné 4× puis réduit : 3 couleurs à ±8, avec et sans retrait du fond ; 5 demandées → 3). Rejoué hors navigateur sur mon logo 1000 × 750 anti-crénelé (`image-ops.ts` actuel recopié, même chaîne que `image-tools.tsx:136-160`, imagetracerjs + resvg) : direct 3/4/6/8 couleurs → exactement #2F4B7C #C9923E #2A1A12, aucun gris ; après « Retirer le fond » 3 → les mêmes, 4/6/8 → + #FFFFFF (intérieur réel du « O ») ; 2 couleurs → bleu + ocre (choix par fréquence, attendu). Version bruitée (±4) : #334F80 #CB9440 #2C1C14, à ±4. Rendu vérifié (captures) : triangle et texte bruns, disque bleu, plus de liseré. Le prix et le contrôle de fabrication ne voient donc plus de couleurs inventées.
Remarques du passage précédent : calque vectoriel ≤ 300 000 car. (`document.ts:68`, refus dans `parseDesign` `:129`, test « refuses a vector layer too detailed ») + message client dans le studio (`image-tools.tsx:161`, `ToolError`) ✅ ; document ≤ 1,5 Mo vérifié avant l'enregistrement avec message français (`studio.tsx:213`) et `bodySizeLimit: "2mb"` (`next.config.ts:8`) ✅ ; échec de `putAsset` signalé (`image-tools.tsx:33-34`, `:68`) ✅.
Critères de l'étape : retrait du fond / inversion / rogner / recadrer avec taille et position conservées [x] · trame [x] · vectorisation à palette exacte [x] · type `vector` sûr, compté, rendu identique éditeur/3D/impression [x] · nouvelle image par opération et annulation [x] (constatés au premier passage, code inchangé sur ces points) · agrandissement sans perte : reporté à E22, non bloquant.
Critères communs : C1 ✅ · C2 ✅ (nombre de couleurs envoyé au prix désormais exact) · C3 ✅ (grep secrets vide dans apps/packages ; pas de `SAWWA_PREVIEW_FIXTURE`) · C4 ✅ · C5 ✅ (palette testée sur image réaliste) · C6 ✅ (aucune nouvelle dépendance).
Corrections à faire : aucune.
Remarques non bloquantes :
- Image sans aplats (dégradé, photo) : aucun groupe n'atteint 0,5 % → `dominantColors` rend `[]` (constaté sur un dégradé 400 × 300), la vectorisation échoue avec le message générique. Prévoir un repli (prendre les groupes les plus fréquents même sous le seuil) ou un message « image trop nuancée pour être vectorisée ».
- La limite de 1,5 Mo du document n'est vérifiée que côté client ; côté serveur seule la limite de 2 Mo de Next.js joue (réponse technique). Ajouter le contrôle dans `parseDesign` ou l'action d'enregistrement.
- `document.ts:66` : le commentaire de `isSafePathData` est maintenant au-dessus des nouvelles constantes.
Décision : passer à E15

## 2026-11-22 — E18c — À CORRIGER
Commit examiné : c09736e (depuis f295a5c ; e2badf8 = verdict E18 et remarques traitées), branche `claude/sawwa-audit-cto-r8vt01` à jour avec `origin`
Contrôles : typecheck ✅ · tests ✅ (110, 18 fichiers) · db ✅ (ALL RLS TESTS PASSED) · build ✅ (rejoué sur l'arbre propre après restauration)
Vérification visuelle : produit d'exemple branché temporairement sous `E18C_PREVIEW` (`studio-data.ts`, `studio/[slug]/page.tsx`, restaurés à l'identique, `git status` propre), `next start -p 3999`, Chromium + SwiftShader 1440 px. Logo de test PIL 1000 × 750 px sur fond blanc, 3 couleurs réelles (bleu #2F4B7C, ocre #C9923E, brun #2A1A12 : triangle + texte « SAWWA »), bords anti-crénelés comme tout logo exporté. Même chaîne rejouée hors navigateur (`image-ops.ts` + imagetracerjs + resvg) : résultats identiques.
Critères de l'étape :
- [x] Retrait du fond / inversion / rogner / recadrer, taille réelle et position conservées : import 180 × 135 mm (0,18 mm/px) → « Retirer le fond » 793 px → 142,74 mm (0,18 mm/px), centre déplacé sur le centre du logo (150,200 → 153,87,202,61) ; recadrage 20 % à gauche → 114,12 mm, centre +14,24 mm (exact) ; `croppedGeometry` tient compte de la rotation (`image-tools.tsx:35-41`). Fond touchant le bord seulement : l'intérieur blanc du « O » est conservé (capture). Tests `image-ops.test.ts` (fond, œil conservé, inversion, rognage, %).
- [x] Trame : points couleur d'encre, pas en mm converti en px (`image-tools.tsx:120-121`), test « halftone dots ».
- [ ] Vectorisation « palette exacte du logo » : **non tenue sur un logo réel**. Demande 3 couleurs sur un logo à 3 couleurs → palette bleu, blanc, ocre : le **brun disparaît** (triangle et texte tracés en bleu) ; demande 4 → bleu, blanc, **#BAACA7 (couleur de liseré inventée)**, ocre, toujours sans brun ; sans retrait préalable du fond, 3 couleurs → bleu #2E436A (moyenné), **#C4C3C3 (gris de liseré)**, ocre. Le brun n'apparaît qu'à partir de 5 couleurs, avec 1 à 2 gris parasites. Conséquences : « changer chaque couleur » recolore ensemble le bleu et le brun (constaté : rouge appliqué au disque, au triangle et au texte) ; le contrôle de fabrication et le prix (`pricing-bridge.ts:13`, `solidColors`) comptent des couleurs de liseré qui n'existent pas sur le logo. Cause : `dominantColors` (`image-ops.ts:196-224`) part du point le plus éloigné, qui est un pixel d'anti-crénelage, sans tenir compte de la fréquence. Le test unitaire n'utilise qu'une image sans anti-crénelage (`image-ops.test.ts:4-15`), d'où le défaut non vu. → point 1.
- [x] Type `vector` (D18) : `isSafePathData` (`document.ts:67`, uniquement commandes de tracé et nombres, ≤ 200 000 car.), validation viewBox/chemins/couleurs (`document.ts:120-123`), test refusant `onload`, `url(#x)`, `<script>`, chaîne vide ; filtre identique à la sortie du traceur (`image-ops.ts:150`) ; attributs échappés dans le SVG d'impression (`svg.ts:32-36`, test `render.test.ts`) ; couleurs comptées (`geometry.ts:44-49`, test 13 couleurs → `TOO_MANY_COLORS`). Rendu éditeur (`canvas.tsx:169-175`), 3D (`paint.ts:43-46`, Path2D : constaté identique en 2D + 3D) et impression cohérents (même viewBox étiré).
- [x] Chaque opération crée une nouvelle image (`encode` → nouvel `idb:` ; l'original n'est pas réécrit) et s'annule : Ctrl+Z constaté après recadrage, trame, inversion et vectorisation (retour à l'image 142,74 × 110,34 mm).
- [ ] Agrandissement sans perte : reporté à E22, non bloquant.
Critères communs : C1 ✅ · C2 ⚠ (pas de calcul de prix hors `pricing`, mais le nombre de couleurs envoyé au prix est faussé par le point 1) · C3 ✅ (grep secrets vide hors docs/consigne ; pas de `SAWWA_PREVIEW_FIXTURE`) · C4 ✅ (message d'erreur français unique, état « Traitement en cours… ») · C5 ❌ (palette non testée sur une image réaliste, point 1) · C6 ✅ (ROADMAP, D18, BACKLOG ; imagetracerjs 1.2.6 justifiée dans D18, licence Unlicense vérifiée, chargée au clic).
Corrections à faire (par priorité) :
1. `dominantColors` : ignorer les pixels de liseré (ex. ne retenir comme centres de départ que des couleurs présentes sur une part significative des pixels, ou exclure les pixels dont les voisins ne sont pas de la même couleur), puis caler chaque couleur finale sur la couleur réelle la plus fréquente de son groupe (pas une moyenne). Ajouter un test avec un logo anti-crénelé (ex. 3 couleurs dessinées puis réduites) : demander 3 couleurs doit rendre exactement ces 3 couleurs (à ±8 près), sans gris de liseré, avec et sans retrait préalable du fond.
Remarques non bloquantes :
- Les actions serveur Next.js limitent le corps à 1 Mo par défaut : un logo « photo » à 6 couleurs a donné 221 Ko de chemins ; une image plus chargée pourrait empêcher l'enregistrement. Prévoir une limite de taille avec un message clair (ou `serverActions.bodySizeLimit`).
- `encode` ignore l'échec de `putAsset` (`image-tools.tsx:31`) : l'image transformée serait perdue au rechargement sans avertissement.
Décision : reprendre E18c

## 2026-11-22 — E18 — VALIDÉ
Commit examiné : f295a5c (second passage ; corrections après 062f9eb, dernier validé 59ef8c7), branche `claude/sawwa-audit-cto-r8vt01` à jour avec `origin`
Contrôles : typecheck ✅ · tests ✅ (98, 17 fichiers) · db ✅ (ALL RLS TESTS PASSED) · build ✅ (rejoué sur l'arbre propre après restauration)
Vérification visuelle : produit d'exemple branché temporairement sous `E18_PREVIEW` (`studio-data.ts`, `studio/[slug]/page.tsx`, restaurés à l'identique, `git status` propre), `next start -p 3999`, Chromium + SwiftShader (1440 px et 390 px), Chromium sans WebGL (1440 et 390 px), téléchargement des modules bloqué après chargement.
Points du passage précédent :
1. [x] Repli 2D automatique : `support.ts` (`hasWebGL`, `preferredMode`), `studio.tsx:62-69` (détection au montage, mode imposé), boutons « 2D + 3D » et « 3D » désactivés avec titre (`studio.tsx:287-289`), phrase « Vue 3D indisponible sur cet appareil : le studio fonctionne en 2D. » (`:274`). Constaté sans WebGL, bureau et mobile : mode 2D, deux boutons désactivés, phrase visible, 0 canevas, éditeur visible, plus de cadre vide. Test `move.test.ts` « studio display mode ».
2. [x] Manches : contours t-shirt et polo élargis, `sleeveCenter` déplacé (`garment.ts:27-34`) ; test « keeps the usual print sizes inside the garment » : grille 5 × 5 de points pour manches 90 × 90, poitrine 100 × 100, devant/dos 300 × 400, nuque 80 × 40, clés anglaises et françaises (`manche_gauche`, `poitrine_gauche`, `dos`, `nuque`, `coeur`), tee/polo/hoodie, plus le tote. Vue « Zone » d'une manche en trois quarts ±π/4 (`viewer.tsx:279`, `:316-317`) : carré de 81 mm visible en entier sur chaque manche (captures).
3. [x] Limite d'erreur locale `boundary.tsx` (journal `viewer3d_failed`, `onFail` → 2D) autour de `Viewer3D` (`studio.tsx:325-328`). Constaté sur mobile : modules bloqués puis clic « 3D » → studio intact, retour en 2D, texte saisi conservé, pas de page d'erreur.
Remarques du passage précédent : 2D par défaut sous 1024 px, 3D chargée à la demande (constaté : 0 canevas à l'ouverture sur 390 px, 1 après clic « 3D ») ✅ ; `toKey("Cœur")` = `coeur` (`catalog.ts:22-23`, testé) ✅ ; « Placer ici » en fonction pure `move.ts` testée (3 cas), ne réduit plus un élément qui tient ✅ ; `useDispose` sur textures et géométries, `preserveDrawingBuffer` retiré ✅.
Critères de l'étape : modes et mise à jour en direct [x] (changement de couleur visible en 3D en 167 ms, capture comprise) · module séparé, rendu à la demande, repli 2D [x] · calibration en mm et tests [x] · mug, gourde, casquette [x] (mug revu) · rendu et vues [x] · « Placer ici » [x] (texte « Devant » → « Poitrine gauche », 36 → 19,2 mm, côté porteur gauche en 3D) · performances [x] (mesurées au premier passage ; Android réel en E11) · 🧑‍💼 modèles d'artiste : en attente du porteur, non bloquant.
Critères communs : C1 ✅ · C2 ✅ (ni prix ni statut touché) · C3 ✅ (grep secrets vide hors docs/supabase/consigne ; pas de `SAWWA_PREVIEW_FIXTURE`) · C4 ✅ · C5 ✅ · C6 ✅ (ROADMAP, D17 ; commit poussé). Aucune nouvelle dépendance dans ce passage.
Corrections à faire : aucune.
Remarques non bloquantes :
- Après un échec de téléchargement, le message de `boundary.tsx` n'apparaît jamais (le cadre est démonté aussitôt par `onFail`) et la phrase affichée devient « Vue 3D indisponible sur cet appareil », inexacte pour une coupure réseau ; la 3D reste désactivée jusqu'au rechargement. Prévoir une phrase propre au réseau et un « Réessayer ».
- `hasWebGL()` crée un contexte WebGL sans le libérer (`WEBGL_lose_context`) ; une perte de contexte en cours d'usage (`webglcontextlost`) n'est pas une exception et n'est pas captée par la limite d'erreur.
- Vue « Zone » d'une manche : le zoom reste centré sur le torse, le marquage est près du bord du cadre ; mug ouvert avec le haut du rebord sous les boutons. À soigner avec les modèles définitifs.
- `docs/VISUALISATION_3D.md:129` (« Repli 2D automatique testé ») peut être coché.
Décision : passer à E18c

## 2026-11-22 — E18 — À CORRIGER
Commit examiné : 062f9eb (depuis 59ef8c7 ; f11a61d = verdict E14 et passage de E18 en cours), branche à jour avec `origin/claude/sawwa-audit-cto-r8vt01`
Contrôles : typecheck ✅ · tests ✅ (93, 16 fichiers) · db ✅ (ALL RLS TESTS PASSED) · build ✅
Vérification visuelle : produit d'exemple branché temporairement dans `studio/[slug]/page.tsx` (fichier restauré, `git status` propre), `next start -p 3999`, Chromium + SwiftShader (bureau 1440 px et mobile 390 px), puis Chromium sans WebGL.
Critères de l'étape :
- [x] Modes « 2D », « 2D + 3D », « 3D » (`studio.tsx:378`, `:444-447`) ; mise à jour en direct mesurée : texte ajouté visible en 3D sur la capture prise 0,64 s après le clic (repeinte différée de 120 ms, `viewer.tsx:38-54`).
- [~] React Three Fiber en module séparé (`next/dynamic`, `ssr: false`, `studio.tsx:363`) ✅ ; rendu à la demande (`frameloop="demand"`, `viewer.tsx:325`) ✅. **Repli 2D sans WebGL non automatique** : sans WebGL, le mode par défaut « 2D + 3D » garde un grand cadre vide « La vue 3D n'est pas disponible… », et en mode « 3D » l'éditeur 2D disparaît alors que le message affirme « L'aperçu 2D reste à jour » (`viewer.tsx:319-321`, `studio.tsx:478-488`, constaté sur mobile 390 px). Aucun repli si le module 3D ne se charge pas (réseau 4G) ou si le contexte WebGL échoue : l'erreur remonte à `app/error.tsx` et le studio entier est remplacé. → points 1 et 3.
- [~] Calibration en mm (`garment.ts:61-75`, 6 tests) : devant à 7 cm sous l'encolure, poitrine gauche côté porteur, dos miroir lisible (vu en capture, texte à l'endroit de dos) ✅. **Manches** : le test ne vérifie qu'un carré de 50 mm ; avec une zone de manche courante (80–90 mm) les coins sortent du t-shirt et du polo (script : `tee manche_gauche … OUT`, `polo … OUT`) et le carré de 90 mm apparaît tronqué sur la manche en 3D. La vue « Zone : Manche » tourne la caméra de profil pur (`viewer.tsx:315`) : le vêtement est vu par la tranche, le marquage de manche est à peine visible. → point 2.
- [x] Mug, gourde (cylindre, couture à l'arrière, `viewer.tsx:210-212`) et casquette (panneau avant, `viewer.tsx:246-249`) : texte visible face caméra (captures avec zones 200 × 80 et 100 × 55 mm).
- [x] Couleur exacte, ombres des plis (couleurs de sommets), plis légers, maille, rotation/zoom, Face/Dos/Profils/Zone/Recentrer, fond blanc/ivoire (`viewer.tsx:329-341`).
- [x] « Placer ici » : déplace l'élément, centré, réduit (vu : texte « Devant » → « Manche gauche », taille 36 → 13,2 mm) (`studio.tsx:394-412`, `:516-524`).
- [x] Performances : canevas affiché en 0,35–0,43 s, 60 images/s mesurées (requestAnimationFrame) sous SwiftShader. Android réel en 4G : à rejouer en E11.
- [ ] 🧑‍💼 Modèles d'artiste : en attente du porteur ; modèles provisoires étiquetés « (modèle provisoire) » conformément à D17. Non bloquant.
- [x] Limiteur : `rate-limit.ts:34-42` (toute exception → `logError` + laisser passer), test « client cannot even be created ».
Critères communs : C1 ✅ · C2 ✅ (aucun prix ni statut touché ; le repli `catch` du prix studio n'affiche qu'un message) · C3 ✅ (grep secrets vide hors docs/consigne ; pas de `SAWWA_PREVIEW_FIXTURE`) · C4 ❌ (point 1 : message faux et cadre vide sans WebGL ; point 3) · C5 ✅ (calibration testée, mais voir point 2) · C6 ✅ (D17, ROADMAP, VISUALISATION_3D à jour ; 3 dépendances justifiées dans D17 ; commit poussé).
Corrections à faire (par priorité) :
1. Repli 2D automatique : détecter WebGL dans `studio.tsx` (au montage) et, s'il manque, forcer le mode « 2D » et masquer/désactiver « 2D + 3D » et « 3D » (avec une phrase courte expliquant pourquoi) ; ne plus jamais afficher le cadre vide ni masquer l'éditeur.
2. Manches : agrandir la zone de manche des modèles t-shirt et polo (ou déplacer `sleeveCenter`) pour qu'un marquage de 90 × 90 mm tienne entièrement ; étendre le test « keeps every standard zone inside the garment » aux tailles courantes (manche 90 mm au moins, poitrine 100 mm, devant/dos 300 × 400) et aux clés françaises produites par `toKey` (`manche_gauche`, `poitrine_gauche`, `dos`, `nuque`). Pour la vue « Zone » d'une manche, utiliser un angle de trois quarts (≈ ±π/4) où le marquage est lisible, pas le profil pur.
3. Entourer `Viewer3D` d'une limite d'erreur (error boundary) locale : échec de chargement du module ou du contexte WebGL → message français et retour au mode 2D, sans faire tomber le studio.
Remarques non bloquantes :
- Le mode par défaut « 2D + 3D » charge le module 3D (≈ 985 Ko, 258 Ko compressés) dès l'ouverture, y compris sur mobile où la 3D pousse l'éditeur sous la ligne de flottaison (capture 390 px) : envisager « 2D » par défaut sous `xl`, la 3D à la demande.
- `toKey("Cœur")` donne `c_ur` : la règle `coeur` de `placeZone` ne s'applique jamais (le logo tombe au centre). Corriger `toKey` (œ → oe) ou la règle.
- `moveToZone` (logique de « Placer ici ») n'est pas testé : l'extraire en fonction pure testée. Il réduit aussi à 80 % un élément qui tiendrait déjà.
- Textures et géométries non libérées (`dispose`) au changement de modèle ; `preserveDrawingBuffer: true` coûte en performance si non nécessaire.
Décision : reprendre E18

## 2026-11-22 — E14 — VALIDÉ
Commit examiné : 59ef8c7 (troisième passage ; corrections après 242378e), branche à jour avec `origin/claude/sawwa-audit-cto-r8vt01`
Contrôles : typecheck ✅ · tests ✅ (86, 15 fichiers) · db ✅ (ALL RLS TESTS PASSED) · build ✅ (21 pages)
Limite : pas de Supabase réel ni de Docker (SMS/e-mails, limites du stockage, `/auth/callback` à rejouer en E11).
Point du passage précédent :
1. [x] `lib/fulfillment.ts:34-38` : conflit → message français ; sinon `logError("fulfillment_transition_failed", rpcError, { fulfillmentId, event })` et `TRY_AGAIN`. Les erreurs du moteur de statuts restent traduites (`TRANSITION_MESSAGES`, l. 44-49, couvre les 4 codes de `TransitionError`). Garde étendue : `no-raw-errors.test.ts` parcourt `app/`, `components/` et `lib/` (`log.ts` exclu), nouveaux motifs `rpcError|\w+Error` et `: xError.message }` ; vérifié que le motif ajouté détecte l'ancienne ligne de 242378e (`true`). Recherche `\.message` dans `app/ components/ lib/` : seuls restent des tests `.includes(...)`, `friendly()` (catalogue, inconnu → journalisé + `TRY_AGAIN`), des messages métier français et `rate-limit.ts:35` (journal).
Remarques du passage précédent : imports inutilisés nettoyés ✅ (aucun `READ_FAILED`/`TRY_AGAIN`/`logError` importé sans usage) ; `auth.ts:26`, `audit.ts:22`, `studio-data.ts:27`, `catalog-public.ts:49` journalisent désormais et lèvent un message sans texte technique ✅.
Passages précédents toujours corrigés : `save_vendor_offer` sans `p_user` (test 13a passe) ; actions studio/candidature/pages compte sans `error.message` (garde verte).
Critères de l'étape : offre en une transaction [x] · limitation de débit [x] · codes envoyés par le serveur [x] · contrôle des fichiers [x] · images du propriétaire [x] · erreurs journalisées [x] (`lib/log.ts` + `instrumentation.ts` + garde) · 🧑‍💼 Sentry : en attente du porteur (compte et clé), non bloquant.
Critères communs : C1 ✅ · C2 ✅ · C3 ✅ (grep secrets vide hors docs/supabase/consigne ; pas de `SAWWA_PREVIEW_FIXTURE`) · C4 ✅ · C5 ✅ · C6 ✅. Aucune nouvelle dépendance.
Corrections à faire : aucune.
Remarque non bloquante : `fulfillment.ts:24` garde `?? e.message` en repli pour un futur code de `TransitionError` non traduit ; ajouter la traduction en même temps que tout nouveau code.
Décision : passer à E18 (E11, E12, E13, E19 attendent le porteur)

## 2026-11-22 — E14 — À CORRIGER
Commit examiné : 242378e (second passage ; corrections après 8e16463, fbfd4ae = BACKLOG et image de référence seulement), branche à jour avec `origin/claude/sawwa-audit-cto-r8vt01`
Contrôles : typecheck ✅ · tests ✅ (86, 15 fichiers, dont `no-raw-errors.test.ts`) · db ✅ (ALL RLS TESTS PASSED, section 13) · build ✅
Limite : pas de Supabase réel ni de Docker (SMS/e-mails, limites du stockage, `/auth/callback` à rejouer en E11).
Points du passage précédent :
1. [~] Erreurs techniques : corrigé aux endroits cités. `lib/log.ts` (`logError`, une ligne JSON, même format que `instrumentation.ts`) ; `studio/[slug]/actions.ts:38,42` (`TRY_AGAIN`), `:124-126` (commande : journalisée, message français « Rien ne vous a été facturé »), `:200` ; `pro/candidature/actions.ts:19` ; pages `compte/creations` et `compte/commandes` (`READ_FAILED` + journal) ; même traitement dans admin, pro, studio (envoi d'image), `qc-upload.tsx`, route de production. Garde : `no-raw-errors.test.ts` parcourt `app/` et `components/`. **Mais** `lib/fulfillment.ts:33` renvoie encore `rpcError.message` brut (texte Postgres, non journalisé) dès que l'erreur n'est pas un conflit, et ce résultat est rendu tel quel au client par `compte/commandes/actions.ts:16` (`answerCorrection`), ainsi qu'à l'atelier et à l'admin. La garde ne voit pas `lib/` (motif `: rpcError.message }` hors de ses expressions). → point 1.
2. [x] `save_vendor_offer` : paramètre `p_user` retiré, `created_by = auth.uid()` (migration `20261122000500`, l. 33), signature des `revoke`/`grant` mise à jour (l. 39-40), action sans `user.id` (`pro/offres/actions.ts:29-32`). Test 13a : `FAIL grid author must be the signed-in user` (agit en `…a1`, l. 397), passe.
Remarques du passage précédent : raison `rate_limited` dédiée ✅ (`actions.ts:17`, `studio-data.ts:48`) ; limite abaissée à 8 000 px ✅ (`print-images.ts:9`) ; prévisualisation et `NEXT_PUBLIC_SITE_URL` documentées ✅ (`SETUP_SUPABASE_VERCEL.md:16`) ; adresse « unknown » inchangée (sans effet sur Vercel).
Critères de l'étape : inchangés depuis le premier passage et toujours remplis (offre en une transaction, limitation de débit, codes envoyés par le serveur, contrôle des fichiers, images du propriétaire) ; erreurs journalisées [~] (point 1) ; 🧑‍💼 Sentry en attente du porteur, non bloquant.
Critères communs : C1 ✅ · C2 ✅ · C3 ✅ (grep secrets vide hors docs/supabase/consigne ; pas de `SAWWA_PREVIEW_FIXTURE`) · C4 ❌ (point 1) · C5 ✅ · C6 ✅. Aucune nouvelle dépendance.
Corrections à faire (par priorité) :
1. `apps/web/src/lib/fulfillment.ts:33` : en dehors du conflit, `logError("fulfillment_transition_failed", rpcError, { fulfillmentId, event: event.type })` et renvoyer `TRY_AGAIN` au lieu de `rpcError.message`. Étendre `no-raw-errors.test.ts` à `lib/` pour les valeurs renvoyées (motif `: \w*[eE]rror\??\.message\b` hors `.includes`, et `logError`/`log.ts` exclus) afin que la garde couvre ce chemin.
Remarques non bloquantes :
- Imports `READ_FAILED`/`TRY_AGAIN` inutilisés ajoutés dans plusieurs fichiers (`admin/ateliers/actions.ts`, `pro/offres/actions.ts`, `compte/*/page.tsx`, `studio/[slug]/actions.ts`…) : à nettoyer.
- `lib/auth.ts:25`, `audit.ts:21`, `studio-data.ts:26`, `catalog-public.ts:48` lèvent des erreurs contenant le texte technique ; masquées par Next.js en production (page d'erreur), mais non journalisées par `logError` hors `onRequestError` : acceptable, à garder en tête.
Décision : reprendre E14

## 2026-11-22 — E14 — À CORRIGER
Commit examiné : 8e16463 (depuis 14fd680 ; 12839e8 = verdict E10 et retouches de documentation), branche à jour avec `origin/claude/sawwa-audit-cto-r8vt01`
Contrôles : typecheck ✅ · tests ✅ (85, 14 fichiers) · db ✅ (ALL RLS TESTS PASSED, section 13) · build ✅ (`/connexion`, `/api/production/[fulfillmentId]` construites)
Limite : pas de Supabase réel ni de Docker. Envoi réel des SMS/e-mails, limites du stockage et retour `/auth/callback` non joués (à rejouer en E11).
Critères de l'étape :
- [x] Offre atelier en une transaction : `save_vendor_offer` (migration `20261122000500`, l. 6-38), sans `security definer` donc soumise aux règles d'accès de l'atelier, exécution retirée à `anon`. Nouvelle version seulement si la grille change (comparaison hors `version`, l. 29-30), conflit de numéro couvert par `unique (offer_id, version)`. Tests section 13a : champs, version 2 tamponnée, grille identique non versionnée, échec au milieu (capacité trop grande) → rien de modifié, autre atelier refusé (`insufficient_privilege`). Action : `pro/offres/actions.ts` appelle la fonction, messages français, erreur inconnue journalisée. Écart : point 2.
- [x] Limitation de débit : `rate_limit_hit` (fenêtre fixe, compteur partagé en base, réservé à `service_role`, table sous RLS sans règle) ; tests 13b (client refusé, 3e appel refusé, clés indépendantes). Appliquée : envoi de code par IP puis par numéro/e-mail (`connexion/actions.ts:13,18,27`), prix par IP (`studio/[slug]/actions.ts:16`), enregistrements (l. 26), commandes (l. 57), corrections (l. 135), candidatures (`pro/candidature/actions.ts:11`), fichiers de production (`route.ts:63`, 429). Panne du compteur → requête acceptée et journalisée (test `rate-limit.test.ts`) ; plafond SMS du projet Supabase demandé en filet (`SETUP_SUPABASE_VERCEL.md:15`).
- [x] Codes envoyés par le serveur : `sendLoginCode` (numéro normalisé, e-mail validé, `next` assaini, `emailRedirectTo` = `NEXT_PUBLIC_SITE_URL/auth/callback?suite=…`, cookie PKCE posé par le client serveur, échange dans `auth/callback/route.ts`). Vérification du code SMS toujours possible dans le navigateur (`login-form.tsx:44`). Messages sans texte technique.
- [x] Fichiers : taille et types imposés par les buckets (test 13c) ; `toPrintableImage` décode et ré-encode toujours (PNG, JPEG qualité 100), faux fichier refusé (`print-images.test.ts` « refuses a file that is not an image »), 12 000 px par côté au plus, message 422 clair dans la route.
- [x] Images du propriétaire seulement : `foreignImages` (`lib/design-ownership.ts`, dossier `design-assets/<user>/`, autre bucket et `..` refusés, testé) appliqué dans `saveDesign` (l. 31), `placeOrder` (l. 86) et `resubmitCorrection` (l. 152) ; seule source d'images de la route de production = `design-assets`.
- [~] Erreurs journalisées : `instrumentation.ts` (`onRequestError`, une ligne JSON) couvre les erreurs non gérées. Mais les erreurs gérées des actions client ne sont ni journalisées ni masquées → point 1.
- [ ] 🧑‍💼 Sentry : en attente du porteur (compte et clé) ; non bloquant.
Critères communs : C1 ✅ · C2 ✅ (aucun calcul de prix ajouté, offre via la fonction SQL sous RLS, permissions serveur) · C3 ✅ (grep secrets vide hors docs/supabase/consigne ; pas de `SAWWA_PREVIEW_FIXTURE`) · C4 ❌ (point 1) · C5 ✅ · C6 ✅ (BACKLOG, ROADMAP, DATABASE l. 106, SETUP à jour). Aucune nouvelle dépendance.
Corrections à faire (par priorité) :
1. Erreurs techniques montrées au client et non journalisées, dans des fichiers touchés par E14 (remarque E10 non traitée) : `studio/[slug]/actions.ts:37` et `:41` (`Enregistrement impossible : ${error.message}`), `:123` (`La commande n'a pas pu être créée : ${error?.message}` — l'échec le plus important du parcours, invisible dans les journaux), `pro/candidature/actions.ts:18`. Attendu : `console.error(JSON.stringify({ level: "error", event: …, message }))` (même format que `instrumentation.ts`) et message français générique ; un test ou une recherche montrant qu'aucune action client ne renvoie `error.message`.
2. `save_vendor_offer` reçoit `p_user` du client et l'écrit dans `vendor_price_grids.created_by` (l. 33) : la fonction étant appelable par tout utilisateur connecté, un atelier peut attribuer une grille à quelqu'un d'autre. Utiliser `auth.uid()` dans la fonction (retirer le paramètre) et ajouter un test section 13a (`created_by` = l'utilisateur qui agit).
Remarques non bloquantes :
- `getStudioQuote` renvoie `reason: "min_qty"` quand la limite est atteinte (`actions.ts:16`) : prévoir une raison dédiée.
- Adresse « unknown » (en-têtes absents) = un seul compteur partagé ; sans effet sur Vercel, à garder en tête hors Vercel.
- 12 000 × 12 000 px ≈ 576 Mo décodés : vérifier la mémoire des fonctions Vercel ou abaisser la limite ; une image tronquée échoue au ré-encodage avec le message générique 500 (refusée quand même).
- `emailRedirectTo` dépend de `NEXT_PUBLIC_SITE_URL` (et non plus de l'origine) : les liens d'un déploiement de prévisualisation renverront vers le site principal ; à documenter en E11 avec la liste des adresses de retour autorisées.
- Pages client affichant `error.message` en lecture (`compte/creations/page.tsx:13`, `compte/commandes/page.tsx:15`) : même traitement que le point 1 au prochain passage.
Décision : reprendre E14

## 2026-11-22 — E10 — VALIDÉ
Commit examiné : 14fd680 (second passage ; corrections après 5d466ab, branche poussée sur `origin/claude/sawwa-audit-cto-r8vt01`)
Contrôles : typecheck ✅ · tests ✅ (81, dont 7 dans `apps/web/src/lib/correction.test.ts`) · db ✅ (ALL RLS TESTS PASSED, sections 11 et 12) · build ✅ (`/studio/[slug]`, `/compte|/pro|/admin/commandes/[id]` construites)
Limite : pas de Supabase réel ni de Docker, écrans non joués avec connexion (à rejouer en E11). Base vérifiée par `pnpm db:test`, logique par les tests et la lecture du code.
Points du passage précédent :
1. [x] Atelier affecté : `actions.ts:152-158` refuse sans atelier affecté puis chiffre la version commandée et la version corrigée avec `vendorId: f.vendor_id` (`bestQuote` filtre les offres de cet atelier, `quoting.ts:39`). `planCorrection` (`correction.ts:31-38`) refuse si l'atelier ne sait pas produire, avec message clair. D16 précise la base (atelier affecté + règles du jour, montant convenu en repli). Tests : `correction.test.ts` « refuses a correction the assigned workshop cannot make », « charges only the effect of a bigger print », « charges nothing … whatever the original price was », repli sur le montant convenu.
2. [x] Premier renvoi avec image : `saveToAccount` renvoie `{ id, doc: next }` (`studio.tsx:158,189`), document envoyé = `saved.doc` (`studio.tsx:402-405`), contenant les chemins `storage:` ; le contrôle serveur `onDeviceImages` ne bloque donc plus le premier clic.
3. [x] Devis figé : colonne `order_item_versions.quote jsonb not null` (migration l. 9), remplie à la commande (l. 47, `p_quote`) et au renvoi (l. 84-85) avec snapshot de `packages/pricing` (règles, grille, atelier), montants entiers, comparaison et supplément (`actions.ts:162-167`) ; `vendor_cost` mis à jour (l. 74). Tests SQL : `FAIL correction quote not frozen`, `FAIL first version quote not frozen`, `FAIL vendor cost not updated`.
4. [x] Finance : `versions_read` inclut `finance` (migration l. 117) et `order_item_versions_read` aussi (l. 111) ; test section 12 « finance sees the versions and the surcharge » (2 versions, supplément 1500). `loadVersions` ignore une version illisible (`orders.ts:34-36`), page admin robuste à `version` null (`admin/commandes/[id]/page.tsx:29,82`). Badge « Supplément » dans la liste admin (`admin/commandes/page.tsx:41,55`).
Remarques du passage précédent : pastilles de couleur désactivées en correction ✅ (`studio.tsx:249`) ; coût atelier tranché dans D16 ✅ ; brouillon local du mode correction toujours jamais restauré (non bloquant).
Critères de l'étape :
- [x] « Corriger ma création » ouvre le studio sur la version commandée (constat inchangé : `compte/commandes/[id]/page.tsx` → `studio/[slug]/page.tsx`).
- [x] Nouvelle version figée, rattachée, ordre en « BAT en cours » via `resubmit_design` (atomique, contrôle optimiste, état calculé par `transition()` de `packages/workflow`, réservée à `service_role`) ; tests SQL section 12.
- [x] Prix recalculé avec l'atelier affecté dans `packages/pricing` ; égal/inférieur accepté sans remboursement, supérieur = accord sur le montant exact (tests `correction.test.ts`).
- [x] Ancienne version consultable : client, atelier affecté, ops/support et désormais finance (tests SQL) ; autre atelier refusé ; n° de BAT sur la fiche atelier.
- [x] Contrôles de fabrication refaits côté serveur (préflight, bloquants, accord sur remarques, décorations filtrées, couleur fixe, faisabilité chez l'atelier affecté) ; tests SQL et TypeScript.
Critères communs : C1 ✅ · C2 ✅ (entiers, prix via `packages/pricing`, transition via `packages/workflow`, contrôle utilisateur + `customer_id` dans la fonction SQL, RLS + tests, version et devis figés) · C3 ✅ (grep secrets vide hors docs/supabase/consigne ; pas de `SAWWA_PREVIEW_FIXTURE`) · C4 ✅ (réserve ci-dessous) · C5 ✅ · C6 ✅ (D16 à jour, commit poussé ; réserve ci-dessous). Aucune nouvelle dépendance.
Remarques non bloquantes (à traiter au prochain commit qui touche ces fichiers) :
- `docs/DATABASE.md:105` ne mentionne ni la colonne `quote` (devis figé par version) ni la lecture des versions par la finance.
- `studio/[slug]/actions.ts:185` montre au client `Renvoi impossible : ${error.message}` (texte technique Postgres) : journaliser côté serveur et afficher un message français générique.
- `rls.test.sql:385` insère un utilisateur `…f2` jamais utilisé (le test agit avec `…f1`).
- Brouillon local du mode correction jamais restauré (`studio.tsx:69-74`).
Corrections à faire (par priorité) : aucune.
Décision : passer à E14 (Robustesse). E11 attend le porteur 🧑‍💼 (projets Supabase eu-west-3 et Vercel cdg1, fournisseur SMS, variables selon `docs/SETUP_SUPABASE_VERCEL.md`) ; E12 et E13 attendent un choix de fournisseur 🧑‍💼. Dans E14, le branchement de Sentry (compte, clé) est à faire avec l'accord du porteur ; le reste est faisable sans lui.

## 2026-11-22 — E10 — À CORRIGER
Commit examiné : 5d466ab (depuis d5b20f3 ; 3f78024 et 875a4ab = documentation seulement), branche poussée sur `origin/claude/sawwa-audit-cto-r8vt01`
Contrôles : typecheck ✅ · tests ✅ (77, dont 3 dans `apps/web/src/lib/correction.test.ts`) · db ✅ (ALL RLS TESTS PASSED, section 12) · build ✅ (`/studio/[slug]`, `/compte|/pro|/admin/commandes/[id]` construites)
Limite : pas de Supabase réel ni de Docker, écrans non joués de bout en bout. Base vérifiée par `pnpm db:test` et par une copie jetable de `rls.test.sql` (scratchpad) ; logique vérifiée par lecture du code.
Critères de l'étape :
- [x] « Corriger ma création » ouvre le studio sur la version commandée : lien `compte/commandes/[id]/page.tsx:56` → `studio/[slug]/page.tsx:43-64` (statut `changes_requested`, version de la ligne, images signées, commentaire de l'atelier). Remarque : les pastilles de couleur restent actives en mode correction (`studio.tsx:245-249`) alors que le serveur refuse tout changement de couleur (`actions.ts:142`).
- [x] Nouvelle version figée, rattachée, ordre en « BAT en cours » : `resubmit_design` (migration `20261122000400`, l. 60-89) en une transaction, contrôle optimiste sur `changes_requested` (l. 72-75), état calculé par `transition()` de `packages/workflow` (`actions.ts:162-168`), fonction réservée à `service_role`. Tests SQL section 12 : appel direct client refusé, autre client refusé, version 2, `proof_review`/round 2, historique, événement, double renvoi refusé, historique immuable.
- [ ] Prix recalculé → correction attendue (point 1) : `correctionPricing` (`lib/correction.ts`, testé : égal/inférieur accepté sans remboursement, supérieur = accord sur le montant exact, entiers) et calcul via `packages/pricing` (`bestQuote`) ✅, mais le devis est demandé à **tous** les ateliers (`actions.ts:152`, sans `vendorId`) et non à l'atelier affecté ; et le nouveau devis n'est pas figé (point 3).
- [~] Ancienne version consultable, numéro de BAT : client ✅ (copie jetable : client voit 2 versions), atelier affecté ✅ / autre atelier ❌ (tests section 12), BAT n° sur la fiche atelier (`pro/commandes/[id]/page.tsx:134`) ✅. Admin : **finance ne voit aucune version** (copie jetable : `FINANCE versions=0 history=2 orders=1`) → point 4.
- [ ] Contrôles de fabrication refaits côté serveur : préflight, points bloquants, accord sur les remarques, décorations filtrées, couleur fixe ✅ (`actions.ts:139-150`) ; **faisabilité non vérifiée pour l'atelier affecté** → point 1. Tests SQL et TypeScript ✅.
Critères communs : C1 ✅ · C2 ❌ (devis de la correction non figé, point 3 ; transitions et permissions ✅ : utilisateur requis, `customer_id` contrôlé dans la fonction SQL, RLS sur `order_item_versions` + tests) · C3 ✅ (grep secrets vide hors docs/consigne ; pas de `SAWWA_PREVIEW_FIXTURE`) · C4 ❌ (premier renvoi avec une nouvelle image en échec, point 2) · C5 ✅ · C6 ✅ (ROADMAP, D16, DATABASE à jour ; commit poussé). Aucune nouvelle dépendance.
Corrections à faire (par priorité) :
1. Faisabilité et prix contre l'atelier affecté : `actions.ts:152` appelle `bestQuote` sans `vendorId: f.vendor_id`. Une correction qui ajoute une zone ou une technique que l'atelier affecté ne propose pas est acceptée dès qu'un autre atelier sait la faire, puis renvoyée en BAT à un atelier qui ne peut pas la produire. Vérifier la faisabilité avec l'offre de l'atelier affecté (message clair sinon) ; préciser dans D16 la base du prix comparé (atelier affecté ou meilleur prix, comme à la commande) et la tester.
2. Premier renvoi avec une image ajoutée : `studio.tsx:400-402` envoie `history.value` capturé avant `saveToAccount`, qui vient de remplacer les `idb:` par `storage:` via `history.commit` (état asynchrone). Le serveur répond « Enregistrez d'abord votre création (les images doivent être envoyées) » au premier clic, précisément dans le cas typique (« logo flou » → nouvelle image). Envoyer le document effectivement enregistré (le renvoyer depuis `saveToAccount`) ou faire relire la création par le serveur à partir de son id, comme `placeOrder`.
3. Devis figé de la correction (règle 7) : `resubmit_design` met à jour `order_items.decorations` (l. 81) mais ni `unit_price`/`line_total` ni `quote_snapshot` ; seul le supplément est conservé (l. 82-83). Enregistrer le devis de la nouvelle version (snapshot, total, atelier/grille et jeu de règles utilisés) dans `order_item_versions` ou l'événement, et le tester.
4. Supplément invisible pour la finance (D16 « signalé à la finance ») : `versions_read` n'inclut pas `finance` ; la page admin lit la version via le client utilisateur, `item.version` vaut `null` pour la finance (plantage `admin/commandes/[id]/page.tsx:29`, déjà présent avant E10) et `loadVersions` lit `v.id` sur `null` (`lib/orders.ts:35`). Ouvrir la lecture des versions à la finance (ou lire via le client service après contrôle de rôle), rendre `loadVersions` robuste à `null`, ajouter un test d'accès finance.
Remarques non bloquantes : désactiver les pastilles de couleur en mode correction ; le brouillon local du mode correction est enregistré mais jamais restauré (`initial` l'emporte, `studio.tsx:69-74`) ; `vendor_cost` de l'atelier n'est pas revu quand un supplément est accepté (à trancher dans D16) ; le supplément n'apparaît dans aucune liste admin « à encaisser ».
Décision : reprendre E10

## 2026-11-22 — E09 — VALIDÉ
Commit examiné : d5b20f3 (second passage ; corrections après e4a8528, branche poussée sur `origin/claude/sawwa-audit-cto-r8vt01`)
Contrôles : typecheck ✅ · tests ✅ (74, dont 8 dans `packages/render/src/render.test.ts` et 2 dans `apps/web/src/lib/print-images.test.ts`) · db ✅ (ALL RLS TESTS PASSED) · build ✅ (route `/api/production/[fulfillmentId]` construite ; `sharp`, libvips et `@resvg/resvg-js` présents dans `route.js.nft.json`)
Limite : pas de Supabase réel ni de Docker, la route n'a pas été appelée de bout en bout (à rejouer en E11). Accès et erreurs vérifiés en lisant le code ; rendu vérifié par un script Node qui enchaîne les mêmes appels que la route (`toPrintableImage` → `renderSurfaceSvg` → resvg avec les polices du dépôt → `setPngDpi` ; puis `buildProductionSheet`), sortie contrôlée avec PIL.
Points du passage précédent :
1. [x] WebP : `apps/web/src/lib/print-images.ts:7-11` convertit en PNG sans perte (sharp) tout format autre que PNG/JPEG, appelé dans `route.ts:26`. Test `print-images.test.ts:9-27` (pixel central WebP = #2F4B7C, opaque). Script : zone 300 × 400 mm avec trois images PNG, JPEG et WebP → pixels (192,57,43,255), (39,174,97,255), (47,75,124,255) ; fond transparent (0,0,0,0).
2. [x] 300 dpi écrits : `packages/render/src/png.ts:26-53` insère `pHYs` après IHDR (remplace un existant), appliqué en `route.ts:87`. Test `render.test.ts:57-71`. Script : chunks IHDR/pHYs/IDAT/IEND, CRC valides, pHYs = 11811 × 11811 px/m unité mètre, PIL `dpi` = (300, 300), taille 3543 × 4724 px.
3. [x] Erreurs rattrapées : `route.ts:49-55` enveloppe tout le traitement ; `ProductionError` pour image introuvable (502) ; toute autre exception (image corrompue, rendu, PDF) → 500 avec message français, journalisée côté serveur ; 401/403/404/409/400/500 en texte clair français (`route.ts:60-85`). Pas de test de la route (non exécutable ici), vérifié par lecture.
4. [x] `docs/ROADMAP.md:44` : ligne E09 cochée. Dépendances justifiées en une ligne chacune dans le message de d5b20f3 (`@resvg/resvg-js`, `pdf-lib`, `sharp` 0.35.5, version exacte, déclarée dans `serverExternalPackages`).
Critères de l'étape :
- [x] PNG transparent par zone, taille réelle, 300 dpi (preuve : script ci-dessus, `render.test.ts`, `png.ts`).
- [x] Polices identiques au studio (constat inchangé du passage précédent ; paramètres opsz/SOFT/WONK désormais documentés dans `packages/render/fonts/README.md:7-9`).
- [x] Images originales en pleine résolution, WebP compris (preuve : point 1 ; conversion sans redimensionnement, test 64 × 64 → 64 × 64).
- [x] Fiche PDF A4 (constat inchangé) ; `safe()` garde désormais « œ » et « € » (`sheet.ts:33`) : texte extrait du PDF généré = « Sweat cœur à 15 000 € ».
- [x] Accès réservé à l'atelier affecté actif et à ops, refus avant affectation (`route.ts:60-73`, logique inchangée).
- [x] Tests du rendu SVG, du PDF, de la résolution et de la conversion d'images.
Critères communs : C1 ✅ · C2 ✅ (ni argent ni transition ; contrôle d'accès serveur avant le client service) · C3 ✅ (aucun secret : grep vide hors docs, `.env.example` avec clés vides ; pas de `SAWWA_PREVIEW_FIXTURE`) · C4 ✅ · C5 ✅ · C6 ✅ (ROADMAP à jour, commit poussé).
Remarques non bloquantes : le test « keeps PNG and JPEG untouched » ne vérifie que le PNG ; la gestion d'erreurs de la route n'a pas de test automatisé (à couvrir lors du test de bout en bout E11).
Corrections à faire (par priorité) : aucune.
Décision : passer à E10

## 2026-11-22 — E09 — À CORRIGER
Commit examiné : e4a8528 (livraison E09 : f385a15)
Contrôles : typecheck ✅ · tests ✅ (70, dont 6 dans `packages/render/src/render.test.ts`) · db ✅ (ALL RLS TESTS PASSED) · build ✅ (route `ƒ /api/production/[fulfillmentId]`)
Limite : pas de Supabase réel ni de Docker, donc la route n'a pas été appelée de bout en bout (à rejouer en E11). Accès vérifié en lisant le code, rendu vérifié en appelant directement `packages/render` puis `@resvg/resvg-js` 2.6.2 avec les polices du dépôt.
Critères de l'étape :
- [ ] PNG transparent par zone, taille réelle, 300 dpi : zone 300 × 400 mm → 3543 × 4724 px, fond transparent (coin RGBA 0,0,0,0), découpé à la zone (`svg.ts:44-50`, rendu exécuté). → correction attendue : le PNG produit n'a **aucun chunk `pHYs`** (chunks : IHDR/IDAT/IEND, PIL `dpi` = None). Ouvert dans un logiciel de PAO ou de RIP, il est lu à 72 dpi, soit environ 125 × 167 cm au lieu de 30 × 40 cm. Ajouter `pHYs` = 11811 px/m et le tester.
- [x] Polices identiques au studio : 8 fichiers fixes (sans `fvar`/`gvar`), usWeightClass = 800/600/400/700/700/700 comme `FONTS` (`document.ts:7-14`) ; chaque famille se résout dans resvg (empreinte différente de la police de repli) ; italique réelle Fraunces/Playfair (fsSelection italic, rendu différent), italique de synthèse `skewX(-12)` pour les autres (`svg.ts:23`) ; `OFL.txt` joint. Remarques non bloquantes : la table `name` garde des sous-familles erronées (« Fraunces Black », « Manrope ExtraLight ») ; les réglages opsz/SOFT/WONK de l'instance Fraunces ne sont pas documentés dans `fonts/README.md`.
- [ ] Images originales en pleine résolution : le fichier téléversé est bien l'original (`studio.tsx:140,173`), téléchargé depuis le stockage puis intégré en data URI (`route.ts:18-28`). → correction attendue : **les images WebP disparaissent**. Le studio les accepte (`studio.tsx:135`), mais resvg-js 2.6.2 ne les décode pas : rendu exécuté avec PNG, JPEG et WebP, le centre de l'image WebP sort transparent (0,0,0,0), sans erreur, dans le PNG comme dans l'aperçu du PDF. Convertir en PNG côté serveur (sans perte), ou à défaut refuser explicitement, et ajouter un test.
- [x] Fiche PDF A4 : référence, produit, couleur, quantités par taille et total, échéance, une page par zone avec technique, taille et position en cm, zone et repère, couleurs, aperçu (`sheet.ts:45-86`) ; PDF généré avec un aperçu puis rastérisé et contrôlé visuellement. Remarque : `safe()` supprime « œ » (« cœur » → « cur ») alors que WinAnsi l'accepte.
- [x] Accès réservé : session requise (401), ops/super_admin, ou atelier dont l'organisation est `active` et `vendor_id` égal (403), refus en `pending_assignment`/`cancelled` hors ops (409) (`route.ts:41-53`). Après refus de l'atelier, `vendorId` repasse à null (`fulfillment.ts:233-237`).
- [x] Tests du rendu SVG et du PDF : `render.test.ts` (taille 300 dpi, échappement, police, italique de synthèse, image, calque masqué, image manquante, une page A4 par zone).
Critères communs : C1 ✅ · C2 ✅ (pas d'argent, pas de transition ; accès contrôlé côté serveur avant l'usage du client service) · C3 ✅ (`service_role` seulement en commentaires et en `grant` SQL ; aucune donnée d'exemple) · C4 ❌ (image manquante ou échec du rendu → exception non rattrapée, page 500 brute sur un lien de téléchargement ; aucun message en français) · C5 ✅ · C6 ❌ (`docs/ROADMAP.md:44` non mis à jour : « fichier d'impression 300 dpi + fiche PDF » toujours non coché ; commit poussé ✅). Dépendances `@resvg/resvg-js` et `pdf-lib` sans justification d'une ligne dans le commit (règle 8).
Corrections à faire (par priorité) :
1. Images WebP : les convertir en PNG avant le rendu (ou les refuser à l'import et à la génération), puis tester que l'image WebP apparaît dans le PNG.
2. Écrire les métadonnées 300 dpi (`pHYs`) dans le PNG d'impression et les tester.
3. Route `/api/production` : rattraper les erreurs (image introuvable, rendu) et renvoyer un message clair en français.
4. Mettre à jour `docs/ROADMAP.md` (partie E09 cochée) et justifier `@resvg/resvg-js` et `pdf-lib` en une ligne chacune.
Décision : reprendre E09

## 2026-11-22 — Point de départ
Commit de référence : `c5346a1` (chaîne de commande E08). Les étapes E01 à E08 ont été validées au fil de l'eau par le porteur du projet, avant la mise en place du validateur.
