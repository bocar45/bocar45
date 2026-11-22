import { Anton, Caveat, Playfair_Display, Space_Grotesk } from "next/font/google";

// Studio fonts (open licence). Production files will embed the same families.
const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-anton", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700"], style: ["normal", "italic"], variable: "--font-playfair", display: "swap" });
const caveat = Caveat({ subsets: ["latin"], weight: ["700"], variable: "--font-caveat", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["700"], variable: "--font-grotesk", display: "swap" });

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${anton.variable} ${playfair.variable} ${caveat.variable} ${grotesk.variable}`}>{children}</div>;
}
