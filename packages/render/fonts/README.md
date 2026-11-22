Polices sous licence SIL Open Font License 1.1 (voir OFL.txt), issues du dépôt google/fonts.
Ce sont des instances **fixes** (graisse figée) générées avec fontTools à partir des polices variables,
car le moteur de rendu (resvg) n'applique pas la graisse des polices variables.
Graisses = celles du studio (`packages/design/src/document.ts` FONTS) : Manrope 800, Fraunces 600 (+ italique), Anton 400,
Playfair Display 700 (+ italique), Caveat 700, Space Grotesk 700.

Paramètres des instances : Manrope wght 800 ; Fraunces et Fraunces Italic wght 600, opsz 72, SOFT 0, WONK 0 ;
Playfair Display et Italic wght 700 ; Caveat wght 700 ; Space Grotesk wght 700 ; Anton (police fixe d'origine).
Les noms internes (table `name`) n'ont pas été renommés : le rendu sélectionne les fichiers par famille, graisse et style.
