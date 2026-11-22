# Visualisation 3D et mannequins

Demande du 22/11/2026 : le studio reste en **2D pour l'édition** ; un mode **« Voir en 3D »** permet de tourner, zoomer, et de voir le produit **porté par un mannequin homme ou femme qui bouge**. Ce document remplace la position plus prudente de la décision D6.

## 1. Principe : éditer en 2D, visualiser en 3D
Éditer directement sur un modèle 3D est lent, imprécis (on ne place pas un logo à 2 mm près sur une surface courbe en tournant une caméra) et inutilisable sur téléphone. Tous les grands outils de personnalisation font ainsi : **édition 2D précise, aperçu 3D vivant**.

```
Studio 2D (Fabric.js, mm réels)
   │  à chaque modification (débounce 300 ms)
   ▼
Rendu des zones → texture atlas (canvas 2048² mobile / 4096² desktop)
   │
   ▼
Visionneuse 3D (React Three Fiber)
   ├─ Mode « Produit »   : vêtement ou objet seul, rotation 360°, zoom, vues face/dos/profil
   └─ Mode « Porté »     : mannequin Homme / Femme, poses et animations, rotation, zoom
```
L'aperçu 3D est un **panneau à côté du canvas** sur desktop (mise à jour en direct pendant l'édition) et un **plein écran** sur mobile (bouton « Voir en 3D »).

## 2. Ce que voit le client
| Fonction | Détail |
|---|---|
| Rotation libre | Glisser pour tourner, pincer pour zoomer, limites d'angle pour rester flatteur |
| Vues rapides | Face · Dos · Profil gauche · Profil droit · Zoom sur la zone sélectionnée |
| Mannequins | **De vrais êtres humains numériques, photoréalistes** (pas de mannequin de vitrine, pas de dessin). Un **casting** de 8 personnes au lancement : homme et femme, peau très foncée, brune, métisse, claire ; traits africains, arabes, européens ; coiffures variées (locks, tresses, cheveux crépus, ras, lisses), et une femme voilée en option. Voir §3 « Casting » |
| Fond de scène | **Blanc** (par défaut, rendu catalogue propre) ou **ivoire** (ambiance SAWWA), au choix ; sol avec ombre douce. Même choix pour la photo studio téléchargée |
| Taille portée | S/M/L/XL : le vêtement est ajusté sur le corps |
| Animations | Pose neutre · Tour sur soi-même · Marche · Bras croisés (mise en valeur du devant) · Mouvement de dos |
| Rotation automatique | Tour lent en boucle à l'ouverture (« turntable »), désactivée si l'utilisateur interagit ou si `prefers-reduced-motion` |
| Couleur du produit | Changement instantané de la couleur du vêtement dans la vue 3D |
| Partage | Capture d'image ; plus tard, vidéo courte générée côté serveur (6 s, MP4) pour les réseaux |
| Repli | Appareil trop faible ou 3D indisponible → mockups photo 2D, sans message d'erreur |

## 3. Comment c'est construit
### Humains numériques photoréalistes
**Exigence (22/11/2026)** : de vraies personnes, réalistes, de toutes les origines, pas un mannequin stylisé.

**Casting de lancement (8 personnes)**
| # | Personne | Peau | Coiffure |
|---|---|---|---|
| 1 | Femme d'Afrique de l'Ouest | très foncée | tresses |
| 2 | Homme d'Afrique de l'Ouest | très foncée | coupe courte |
| 3 | Femme | brune | cheveux crépus naturels |
| 4 | Homme | brun | locks |
| 5 | Femme d'origine arabe / maghrébine | mate | cheveux longs ; variante voilée |
| 6 | Homme d'origine arabe / maghrébine | mate | barbe courte |
| 7 | Femme blanche (européenne) | claire | cheveux lisses |
| 8 | Homme blanc (européen) | clair | cheveux courts |
Plus tard : enfants, morphologies plus rondes, seniors.

**D'où viennent ces personnes** (par ordre de préférence)
1. **Scans 3D de vrais modèles**, payés et sous contrat de cession de droits (photogrammétrie en studio, à Dakar et/ou en France). C'est le meilleur réalisme, c'est éthique, et cela raconte une histoire de marque (« les visages SAWWA »).
2. **Humains numériques sous licence** issus de bibliothèques de scans professionnelles, avec licence autorisant le temps réel sur le web et la modification. Vérifier la diversité réelle du catalogue.
3. **Création par un artiste** (Character Creator, ZBrush) à partir de photos de référence de modèles consentants.
⚠️ Exclus : MetaHuman (licence limitée au moteur Unreal), visages générés qui ressembleraient à une personne réelle sans son accord, et toute caricature ethnique. Chaque personne du casting est validée par toi.

**Comment on garde des coûts raisonnables** : les 8 personnes partagent **2 corps de base** (homme, femme) ; ce qui change, ce sont la tête, la peau, les cheveux et les mains. Ainsi **un vêtement modélisé pour le corps femme va sur les 4 femmes**, sans refaire le vêtement 4 fois.

**Réalisme dans le navigateur**
- Peau avec diffusion sous la surface (aspect de vraie peau, pas de plastique), carte de pores, éclairage studio en HDRI.
- Cheveux en mèches texturées (technique standard des jeux vidéo), pas de cheveux simulés.
- Poids : ≈ 6–10 Mo par personne en haute qualité, chargés au clic et mis en cache ; version allégée automatique sur téléphone d'entrée de gamme.

**Rendu « photo studio » (complément)**
Le temps réel du navigateur est très bon mais pas parfait. Pour les fiches produits, le partage et les campagnes, un **serveur de rendu** (Blender Cycles sur GPU) produit des **photos et courtes vidéos d'un réalisme photographique** de la création portée par la personne choisie : quelques secondes de calcul, ≈ 0,02–0,10 € par image. Le client tourne la vue en temps réel, puis télécharge une « photo » de qualité studio.

### Vêtements
- Modélisés dans un outil de patronage 3D (CLO 3D / Marvelous Designer) **à partir des vraies mesures du produit de référence** (tableau des tailles de l'atelier).
- **Une version par coupe et par morphologie** : t-shirt homme, t-shirt femme, hoodie unisexe porté par les deux, etc.
- **UV mapping aligné sur les zones d'impression** : chaque zone du studio (devant, dos, manches) correspond à une région UV calibrée en millimètres → le logo placé à « 7 cm sous le col » apparaît au bon endroit en 3D.
- Réalisme : carte normale du tissu (maille jersey, molleton), occlusion ambiante, plis.
- Rendu du marquage selon la technique : DTG mat et légèrement absorbé, DTF un peu satiné, sublimation intégrée au tissu, **broderie en relief** (carte normale générée à partir du design — phase 2 de la 3D).

### Mouvement du vêtement — deux niveaux
| Niveau | Technique | Réalisme | Coût | Quand |
|---|---|---|---|---|
| A — Vêtement « skinné » | Le vêtement suit le squelette, avec formes correctives aux épaules et aux coudes | Bon pour t-shirt, polo, hoodie ; tissu un peu rigide | Moyen | **Premier lot 3D** |
| B — Simulation textile pré-calculée | La simulation est calculée une fois dans CLO 3D pour chaque animation, puis rejouée dans le navigateur (animation de sommets) | Excellent, vrais plis qui bougent | Élevé, fichiers plus lourds, animations fixes | Animations vitrines (marche, tour) des 2 best-sellers |
Pas de simulation textile en temps réel dans le navigateur : trop lourde pour les téléphones.

### Objets
| Produit | Méthode 3D |
|---|---|
| Mug, gourde, bouteille, coque | Modèle simple, design appliqué en enveloppe (UV cylindrique). Peu coûteux, rendu excellent |
| Casquette | Design projeté en décalque sur le panneau avant courbe ; broderie en relief |
| Tote bag, sac | Modèle rigide léger, puis tissu |
| Coussin, plaid, puzzle, toile | Formes simples, faciles |
| Chaussures | Hors périmètre (voir audit) |

### Performance (contrainte forte : réseaux mobiles en Afrique)
- Avatar + vêtement ≤ **4 Mo** au total (géométrie compressée Meshopt/Draco, textures KTX2, niveaux de détail).
- Chargement **seulement au clic** sur « Voir en 3D » (le studio s'ouvre sans 3D), avatar mis en cache navigateur.
- Objectif : premier rendu 3D < 3 s en 4G sur un Android milieu de gamme ; 30 images/s minimum.
- Qualité adaptative : textures 1024 et ombres simplifiées sur appareils faibles ; repli 2D automatique sous un seuil.

## 4. Coût de production des assets (devis à confirmer en phase 1)
| Lot | Contenu | Estimation |
|---|---|---|
| Humains photoréalistes | 2 corps de base riggés + 8 têtes/peaux/coiffures (scans de modèles rémunérés ou licences), 5 animations | 15 000 – 35 000 € |
| Vêtements niveau A | T-shirt H, T-shirt F, hoodie (×2 corps), polo H/F — partagés par tout le casting | 6 × 800 – 2 000 € = 5 000 – 12 000 € |
| Simulation niveau B | 2 animations vitrines × 2 vêtements × 2 morphologies | 2 000 – 5 000 € |
| Objets | Mug, gourde, casquette, tote bag | 4 × 300 – 900 € |
| Serveur de rendu photo | Mise en place (scènes, éclairages) | 2 000 – 4 000 € |
| **Total premier lot** | | **≈ 25 000 – 60 000 €** |
| Variante économique | 4 personnes au lieu de 8 (une par grande origine, H/F alternés), extension ensuite | ≈ 15 000 – 30 000 € |
Coût de fonctionnement : quasi nul pour la 3D temps réel; rendu photo studio à la demande (rendu dans le navigateur du client ; fichiers servis depuis le CDN sans frais de sortie).

Chaque nouveau vêtement ajouté plus tard coûte un modèle par morphologie. C'est pourquoi le catalogue « porté en 3D » doit rester concentré sur les best-sellers ; les autres produits ont le mode « Produit » ou les mockups photo.

## 5. Planning — piste parallèle
La production des assets 3D est longue (6–10 semaines avec un artiste) mais **indépendante du code**. Elle démarre donc **dès la phase 1**, en parallèle :
| Phase | 3D |
|---|---|
| 1 | Cahier des charges 3D, **casting** (validation des 8 profils), choix du studio de scan/artiste, contrats de cession de droits, mesures produits des ateliers pilotes |
| 3 (tranche verticale) | Visionneuse 3D intégrée au studio : mug + t-shirt en mode « Produit » ; architecture texture atlas et UV en place |
| 5 | **Humains photoréalistes** (casting complet) avec t-shirt et hoodie, animations niveau A, choix de la personne et de la taille, rendu photo studio |
| 7 | Animations vitrines niveau B, broderie en relief, casquette, vidéo partageable |

## 6. Critères d'acceptation
- [ ] Un logo placé à 7 cm sous le col dans le studio apparaît à 7 cm ± 5 mm sur le modèle 3D (contrôle avec une mire).
- [ ] Le changement de design se reflète dans la vue 3D en < 500 ms.
- [ ] Changement de personne, taille et animation sans rechargement de page.
- [ ] Test de réalisme : sur 10 personnes, la majorité juge la vue « réaliste » ; validation du casting par le porteur du projet et par des personnes des communautés représentées.
- [ ] Android milieu de gamme : ≥ 30 i/s, premier rendu < 3 s en 4G.
- [ ] Repli 2D automatique testé sur un appareil sans WebGL2.
- [ ] Mesure : taux d'ouverture de la 3D et effet sur la conversion (test A/B).
