# Marché de lancement : Sénégal (UEMOA)

Décision D1 validée le 22/11/2026. Ce document liste ce que ce choix change. Les points juridiques et fiscaux sont **à confirmer avec un expert-comptable sénégalais** avant le pilote.

## 1. Argent
| Sujet | Règle |
|---|---|
| Devise | **XOF (franc CFA BCEAO)**. ⚠️ Le XOF n'a **pas de centimes** (0 décimale ISO 4217) : les montants sont stockés en francs entiers. Le code gère la précision par devise, jamais « × 100 » en dur. |
| Parité | 1 EUR = 655,957 XOF (fixe) : utile pour les ateliers ou fournisseurs payés en euros et pour la diaspora. |
| Arrondis | Prix publics arrondis au multiple de 50 FCFA (petits montants) ou 100 FCFA, réglables dans les règles de prix. |
| TVA | 18 % (taux normal au Sénégal). Prix affichés **TTC**. |
| Entité | Société sénégalaise (SUARL/SARL), NINEA, RCCM : SAWWA facture en son nom (D2). |
| Facturation | Numérotation continue ; vérifier les obligations de facture normalisée / électronique de la DGID. |

## 2. Paiement
| Moyen | Usage | Mise en œuvre |
|---|---|---|
| **Wave** | Moyen dominant au Sénégal | Via agrégateur ou API Wave Business |
| **Orange Money**, Free Money | Très répandus | Via agrégateur |
| Carte bancaire (Visa/Mastercard) | Clients aisés, diaspora | Via agrégateur |
| Virement | Commandes B2B importantes | Manuel, rapproché par l'admin |
| Paiement à la livraison | Très demandé localement | **Refusé pour la personnalisation** (un produit personnalisé ne se revend pas). Remplacé par un **acompte** (voir ci-dessous) |

**Agrégateur** : comparer sur devis PayDunya, CinetPay, PayTech, et l'API Wave directe (frais, délais de reversement, webhooks, remboursements, sandbox). Le code passe par l'interface `PaymentProvider` : changer d'agrégateur ne touche pas au reste.

**Acompte B2B** : pour les commandes d'équipe au-dessus d'un seuil (ex. 150 000 FCFA), 50 % à la commande, solde avant expédition. Le moteur de prix et le workflow le prévoient.

## 3. Livraison
- Dakar et banlieue : livreurs à moto (J+1 après production), partenaire logistique local ou livreurs indépendants référencés.
- Régions (Thiès, Saint-Louis, Touba, Ziguinchor…) : transporteurs / gares routières, délai et prix par zone.
- **Adresses peu normalisées** → on demande : téléphone (obligatoire), quartier, point de repère, et **épingle sur la carte**.
- Retrait gratuit à l'atelier ou en point relais (option économique).
- Diaspora (V1.x) : client en France qui paie pour un cadeau livré à Dakar.

## 4. Communication
- **WhatsApp** est le canal principal (confirmation, BAT, expédition, livraison). SMS en secours, e-mail en complément.
- Connexion par **numéro de téléphone + code reçu** (pas de mot de passe obligatoire).
- Langue : français ; wolof pour les messages clés et le support plus tard.

## 5. Technique
- **Mobile d'abord, réseau limité** : pages catalogue < 1 Mo, images en WebP/AVIF, 3D chargée seulement à la demande, version allégée des humains 3D sur Android d'entrée de gamme.
- Hébergement : UE ou Afrique (latence acceptable depuis l'UE via CDN). Données personnelles : déclaration auprès de la **CDP** (Commission de protection des données personnelles, loi 2008-12) et encadrement du transfert hors du Sénégal.

## 6. Offre locale
- Occasions : Tabaski, Korité, Magal, Gamou, mariages, baptêmes, rentrée, Navétanes (championnats de quartier → maillots d'équipe), fin d'année.
- B2B prioritaire : associations, ASC, écoles, entreprises, événements, ONG.
- Ateliers : à recruter à Dakar (voir `RECRUTEMENT_ATELIERS.md`).
- Approvisionnement en produits vierges : vérifier la disponibilité locale (t-shirts, mugs à sublimation, casquettes) et la qualité ; c'est souvent le vrai goulot.

## 7. Ordres de grandeur de prix (à remplacer par les vrais devis ateliers)
| Produit | Prix public indicatif |
|---|---|
| T-shirt personnalisé DTF, 1 pièce | 7 500 – 10 000 FCFA |
| T-shirt brodé cœur, lot de 50 | 4 500 – 6 500 FCFA / pièce |
| Mug photo | 5 000 – 7 000 FCFA |
| Casquette brodée | 6 000 – 9 000 FCFA |
La simulation économique (`BUSINESS_MODEL.md`) sera refaite en FCFA avec les grilles des ateliers recrutés.
