# Journal des validations

Rempli uniquement par l'agent `sawwa-validateur` (`.claude/agents/sawwa-validateur.md`). La plus récente en haut.

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
