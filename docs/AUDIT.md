# Livrable A — Audit du concept

Lecture critique du dossier de cadrage initial. Notation : ✅ pertinent · ⚠️ imprécis ou à corriger · 🔴 risque majeur · ⏳ trop ambitieux pour la V1 · ➕ manquant.

---

## 1. Ce qui est pertinent ✅

| Point | Pourquoi c'est juste |
|---|---|
| Moteur de prix central et versionné (§8) | C'est le cœur de la confiance client et de la marge. Bien identifié. |
| Séparer création visuelle et fichier de production (§9) | Distinction essentielle, souvent ratée par les concurrents. |
| Étape de validation technique par l'atelier (§5.8) | Évite de produire des commandes infabricables. |
| Distinguer techniques et zones (§5.4) | Erreur classique évitée : une manche est une zone, pas une technique. |
| Prix vierge séparé des personnalisations (§5.2) | Permet un calcul automatique. |
| Commandes validées qui gardent leur prix (§6.6) | Indispensable (snapshot). |
| Catalogue évolutif, pas limité aux t-shirts (§4.2) | Impose un modèle de données générique dès le départ. |
| Ne pas promettre la 3D partout (§4.6) | Lucide. |
| Développement par phases, documentation durable (§14, §16) | Bonne hygiène. |

## 2. Ce qui est imprécis ou à corriger ⚠️

### 2.1 Qui vend au client ? (le point le plus important du dossier)
Le dossier oscille entre deux modèles incompatibles :
- **Marketplace** : la fiche produit affiche le « fabricant ou atelier », le vendeur fixe ses prix, SAWWA prend une « commission ».
- **Plateforme de fabrication à la demande** : SAWWA fixe ses frais, affecte la commande à « un vendeur compatible » (étape 8), le client ne choisit pas l'atelier.

Ce choix change tout : qui émet la facture, qui collecte la TVA, qui est responsable d'un défaut, quel prestataire de paiement, quelles obligations légales (DAC7, DSA), et l'UX (le client choisit-il un atelier ?).

**Recommandation** : en V1, **SAWWA vend au client** (vendeur en son nom propre, *merchant of record*). Les ateliers sont des **sous-traitants** payés au prix de gros qu'ils déclarent. Le client achète « un t-shirt coton 180 g brodé », pas « le t-shirt de l'atelier X ».
- Une seule facture, un seul prix, une seule garantie, un seul interlocuteur.
- Routage libre entre ateliers (prix, délai, distance, charge) sans changer l'expérience.
- Paiement simple (Stripe classique), pas d'agrément d'intermédiaire de paiement.
- Revers : SAWWA porte la TVA, la responsabilité produit et le risque qualité. C'est le prix du contrôle, et c'est ce que font les leaders du secteur.
La marketplace ouverte (vendeurs visibles, boutiques) reste possible en phase 2 ; le modèle de données la prévoit. → **Décision D2.**

### 2.2 Catalogue « libre par vendeur » vs catalogue de référence
Si chaque atelier crée ses propres fiches avec ses propres zones, on obtient : 15 « t-shirts blancs » en doublon, des zones aux géométries incohérentes, impossible d'avoir un mockup ou un modèle 3D par produit, routage impossible.

**Recommandation** : séparer deux objets.
- **Produit de référence** (géré par SAWWA) : « T-shirt col rond coton 180 g », ses vues, ses **zones normalisées** (géométrie en mm), ses mockups, son modèle 3D, ses tailles.
- **Offre atelier** : l'atelier déclare qu'il sait produire ce produit de référence, avec quelles variantes/couleurs, quelles techniques par zone, à quel prix, quel délai, quelle capacité. Il peut restreindre une zone (ex. dos max 28×35 cm au lieu de 30×40).
Un atelier qui veut proposer un produit inédit fait une **demande de référencement** validée par l'admin. → **Décision D3.**

### 2.3 « Prix transparent » ≠ exposer la marge
Le dossier demande un prix transparent **et** une formule qui additionne prix vendeur + frais SAWWA + commission. Deux problèmes :
- **Double comptage** : une « commission vendeur » (prélevée sur le vendeur) et des « frais de service » (ajoutés au client) sur la même base produisent des marges incohérentes, voire négatives après remises.
- Afficher au client la marge SAWWA ligne par ligne n'est ni utile ni courant ; en B2C UE, la loi impose surtout un **prix TTC final sans frais cachés** au moment du paiement.

**Recommandation** : l'atelier déclare un **prix de revient** (vierge + personnalisation + préparation). SAWWA applique des **règles de marge** par catégorie/technique/pays pour obtenir un **prix public**. Le client voit : prix unitaire, détail par zone/technique, livraison, remise, TTC. La « commission » est le résultat (prix public HT − coût atelier), pas une ligne. Voir `BUSINESS_MODEL.md`.

### 2.4 Commande multi-ateliers
Un panier avec un mug et une casquette peut nécessiter deux ateliers, deux colis, deux frais de port. Le dossier ne le traite pas.
**Recommandation** : une **commande client** se divise en **ordres de fabrication** (un par atelier). Frais de port calculés par ordre, affichés regroupés. En V1, routage préférentiel vers un atelier unique quand c'est possible.

### 2.5 Paiement avant ou après validation atelier ?
Le dossier veut que l'atelier valide **après** la commande, mais que le client ne paie pas une création infabricable.
**Recommandation** :
1. **Pré-contrôle automatique dans le studio** (résolution, débordement de zone, nombre de couleurs, traits trop fins pour la broderie) → bloque ou avertit avant paiement. Élimine la majorité des cas.
2. Paiement immédiat.
3. **BAT atelier** sous SLA (24 h ouvrées). Si correction demandée : le client modifie (prix recalculé si l'impact est réel, sinon inchangé) ou annule → **remboursement intégral automatique**.
4. Commandes complexes (sérigraphie multi-couleurs, broderie sur mesure, grandes quantités) : **devis** puis paiement.

### 2.6 Broderie
Une broderie nécessite une **digitalisation** (conversion du visuel en points, fichiers DST/PES). Elle n'est pas automatisable de façon fiable. Elle a un coût unique (≈ 10–40 €) et un délai. Le dossier ne le mentionne pas.
**Recommandation** : la digitalisation est faite par l'atelier, facturée en « frais de préparation » unique par design, réutilisable pour une recommande. Le studio limite la broderie : nombre de couleurs (≤ 6–12), taille de texte minimale, pas de dégradés ni de photos.

### 2.7 Sérigraphie
Coût fixe par couleur et par écran, rentable à partir de ~20–50 pièces. Elle ne doit pas être proposée en commande unitaire. → techniques soumises à **quantité minimale** dans le moteur de prix.

### 2.8 Couleur
Écran RVB, encres textiles et sublimation ne rendent pas les mêmes couleurs. Il faut : une palette « sûre » par technique, un avertissement clair, et pour le B2B un échantillon/BAT physique payant en option.

### 2.9 Logo
Le dossier mentionne une proposition visuelle de logo validée, **mais aucun fichier n'a été fourni**. Je ne peux pas l'auditer. → fournir le fichier source (SVG/AI de préférence, sinon PNG haute définition). Les recommandations du `DESIGN_SYSTEM.md` sur le logo sont des critères de validation, pas une analyse de l'existant.

## 3. Ce qui est techniquement difficile 🔴

| Sujet | Difficulté réelle | Approche proposée |
|---|---|---|
| **Mannequin 3D animé portant le vêtement personnalisé** | Le tissu se plie ; le design doit suivre les plis. Il faut un modèle par coupe (et idéalement par taille), une simulation textile (pré-calculée), un UV mapping propre, des performances mobiles. Coût de production 3D : ~1 500–5 000 € par vêtement, plus la maintenance. | V1 : **mockups photo réalistes** (carte de déplacement + ombrage) devant/dos/porté, qui convertissent aussi bien. V2 : turntable 3D pré-animé (animation textile cuite dans le modèle, design appliqué en texture UV en temps réel) pour 2 vêtements phares. |
| **Fichiers de production fidèles** | Rendu serveur identique au rendu navigateur (polices, transparence, dimensions réelles, 300 dpi). | Format de design **propriétaire en JSON**, unités en mm, rendu unique (SVG → raster/PDF) côté serveur. Le studio n'est qu'une vue. |
| **Moteur de prix générique** | Combinatoire produit × variante × zone × technique × taille du marquage × couleurs × quantité × pays. | Règles déclaratives versionnées, fonction pure testée par snapshots. |
| **Isolation multi-ateliers** | Fuite de données entre ateliers = incident grave. | Filtrage systématique par `vendor_id` dans la couche d'accès + Row-Level Security PostgreSQL en défense en profondeur. |
| **Paiement Afrique de l'Ouest** | Stripe n'est pas disponible pour les entreprises au Sénégal ; le marché utilise le mobile money (Wave, Orange Money). | Couche d'abstraction paiement. Stripe pour l'UE ; agrégateur UEMOA (CinetPay, PayDunya ou Wave Business) pour l'Afrique. → **Décision D1/D5.** |
| **Génération IA de logos** | Risques : contrefaçon de marques, qualité vectorielle faible, coût. | Phase IA ultérieure, modération, pas de promesse « logo vectoriel prêt à broder ». |

## 4. Trop ambitieux pour la V1 ⏳
- Chaussures (fabrication complexe, peu d'ateliers, gestion des pointures, 3D difficile). → hors V1.
- Mannequin animé pour tous les vêtements. → V2, 2 coupes.
- Marketplace ouverte avec catalogues vendeurs libres. → V2.
- Affectation automatique intelligente. → V1 : semi-automatique (proposition triée, validation admin).
- Génération IA d'illustrations et de logos. → V1.5 après mesure de l'usage du studio.
- Multi-pays fiscal complet. → V1 : un pays de facturation, structure prête pour la suite.
- Abonnements vendeurs. → contre-productif au lancement : on a besoin des ateliers plus qu'eux de nous.
- Catalogue de 30 familles. → V1 : **6 à 8 produits de référence** maîtrisés.

## 5. Fonctionnalités manquantes ➕

**Client**
- **Commande d'équipe / lot** : un design, une répartition par tailles (12 S, 20 M, 8 L…), éventuellement des noms/numéros individuels. Indispensable pour le B2B.
- Guide des tailles par produit ; échantillon payant.
- Recommande en un clic (avec digitalisation broderie déjà payée).
- Partage d'une création pour validation (lien privé) — utile pour les associations.
- Politique de retour : en UE, les produits personnalisés sont **exclus du droit de rétractation** (art. L221-28 3° du Code de la consommation) ; reste la garantie de conformité (défaut, erreur de fabrication). À expliquer clairement.
- Notifications WhatsApp/SMS (essentiel en Afrique de l'Ouest), en plus de l'email.
- Expérience mobile en bande passante faible.

**Atelier**
- Calendrier et capacité (jours fermés, volume max/jour) pour le routage.
- Contrôle qualité : photo du produit fini avant expédition (preuve en cas de litige).
- Étiquettes d'expédition / intégration transporteur, ou remise au transporteur SAWWA.
- Factures d'achat générées par SAWWA (auto-facturation sous mandat) pour simplifier la vie des ateliers.

**Admin / plateforme**
- **Modération des contenus** : marques déposées, contenus haineux, droits d'auteur sur les images importées. Procédure de signalement et retrait (obligations DSA si plateforme UE).
- Gestion des litiges et **reprises** (re-production aux frais de l'atelier fautif).
- Notation interne des ateliers (délais, taux de défaut, taux de refus).
- Fiscalité : TVA (OSS UE si vente B2C transfrontalière), facturation numérotée, mentions légales.
- Journal d'audit, export comptable.
- Gestion des transporteurs et zones de livraison.

## 6. Risques métier 🔴

| Risque | Gravité | Mitigation |
|---|---|---|
| **Œuf et poule** : pas de clients sans ateliers, pas d'ateliers sans commandes | Élevée | Démarrer avec 2–4 ateliers recrutés et accompagnés à la main dans **une** zone. Volume garanti par le B2B démarché directement. |
| **Qualité inégale des ateliers** = réputation SAWWA | Élevée | Commande test à l'entrée, photo QC obligatoire, notation, reprises à la charge de l'atelier. |
| **Marge B2C faible** + coût d'acquisition élevé | Élevée | Priorité B2B (panier 300–1 500 €). Le B2C sert la marque et le contenu. |
| Concurrence (Printful, Gelato, Spreadshirt, ateliers locaux) | Moyenne | Différenciation : identité culturelle, studio guidé, B2B avec accompagnement, réseau africain, rendu. |
| Propriété intellectuelle (designs importés contrefaisants) | Moyenne | CGU, déclaration de droits à l'import, modération, retrait. |
| Coût 3D/IA hors de contrôle | Moyenne | Périmètre limité, quotas, budget mensuel plafonné, mesure du coût par commande. |
| Représentation culturelle maladroite | Moyenne | Collaborations avec des designers africains crédités ; pas de motifs sacrés ou identitaires copiés. |
| Dépendance à un seul atelier | Moyenne | Au moins 2 ateliers par produit de référence avant ouverture publique. |
