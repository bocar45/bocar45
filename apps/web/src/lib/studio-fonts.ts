import { Anton, Caveat, Playfair_Display, Space_Grotesk } from "next/font/google";

// Studio fonts (open licence). Production files embed the same families (packages/render/fonts).
const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-anton", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700"], style: ["normal", "italic"], variable: "--font-playfair", display: "swap" });
const caveat = Caveat({ subsets: ["latin"], weight: ["700"], variable: "--font-caveat", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["700"], variable: "--font-grotesk", display: "swap" });

/** Class setting the CSS variables of the design fonts, for every page that shows a design (studio, template gallery). */
export const designFontsClass = `${anton.variable} ${playfair.variable} ${caveat.variable} ${grotesk.variable}`;
