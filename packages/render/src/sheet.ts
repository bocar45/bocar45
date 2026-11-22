import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface SheetZone {
  label: string;
  technique: string;
  printedWidthCm: number;
  printedHeightCm: number;
  offsetLeftCm: number;
  offsetTopCm: number;
  zoneWidthCm: number;
  zoneHeightCm: number;
  anchorNote?: string | null;
  colors?: number | null;
  previewPng?: Uint8Array | null;
}

export interface SheetData {
  reference: string;
  productName: string;
  colorName: string;
  sizes: Record<string, number>;
  dueDate?: string | null;
  versionHash: string;
  generatedAt: string;
  zones: SheetZone[];
  /** Team order (E16): one line per piece, printed as a checklist after the zone pages. */
  roster?: { size: string; name?: string; number?: string }[] | null;
  /** Zones whose content changes on every piece (one print file per piece). */
  variableZones?: string[];
}

const BRUN = rgb(0.165, 0.102, 0.071);
const TERRA = rgb(0.71, 0.337, 0.165);
const MUTED = rgb(0.42, 0.35, 0.29);

/** WinAnsi-safe text for the standard PDF fonts (keeps French accents, drops the rest). */
const safe = (s: string) => s.normalize("NFC").replace(/[’‘]/g, "'").replace(/[“”«»]/g, '"').replace(/[–—]/g, "-").replace(/[×]/g, "x").replace(/[^\x20-\x7E\u00A0-\u00FF\u0152\u0153\u20AC]/g, "");

/** One-page-per-zone A4 production sheet for the workshop. */
export async function buildProductionSheet(data: SheetData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Fiche de production ${data.reference}`);
  pdf.setProducer("SAWWA");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const totalQty = Object.values(data.sizes).reduce((a, b) => a + b, 0);
  const PER_PAGE = 40;
  const rosterPages = data.roster?.length ? Math.ceil(data.roster.length / PER_PAGE) : 0;

  for (const [i, z] of data.zones.entries()) {
    const page = pdf.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    let y = height - 50;
    const text = (s: string, x: number, size = 10, f = font, color = BRUN) => page.drawText(safe(s), { x, y, size, font: f, color });

    page.drawRectangle({ x: 0, y: height - 8, width, height: 8, color: TERRA });
    text("SAWWA · FICHE DE PRODUCTION", 40, 9, bold, TERRA);
    text(`Page ${i + 1}/${data.zones.length + rosterPages}`, width - 100, 9, font, MUTED);
    y -= 26;
    text(data.reference, 40, 20, bold);
    y -= 22;
    text(`${data.productName} · couleur ${data.colorName}`, 40, 12);
    y -= 18;
    text(`Quantités : ${Object.entries(data.sizes).map(([s, n]) => `${s} x ${n}`).join("   ")}   (total ${totalQty})`, 40, 11, bold);
    if (data.dueDate) { y -= 16; text(`À traiter avant le ${data.dueDate}`, 40, 10, font, MUTED); }

    y -= 34;
    text(`Zone : ${z.label}`, 40, 15, bold, TERRA);
    y -= 20;
    const rows: [string, string][] = [
      ["Technique", z.technique],
      ["Taille du marquage", `${z.printedWidthCm.toFixed(1)} x ${z.printedHeightCm.toFixed(1)} cm`],
      ["Position", `${z.offsetLeftCm.toFixed(1)} cm du bord gauche, ${z.offsetTopCm.toFixed(1)} cm du haut de la zone`],
      ["Zone de référence", `${z.zoneWidthCm} x ${z.zoneHeightCm} cm${z.anchorNote ? ` · ${z.anchorNote}` : ""}`],
      ...(z.colors ? [["Couleurs", String(z.colors)] as [string, string]] : []),
      ["Fichier d'impression", "PNG transparent 300 dpi, taille réelle de la zone (fichier séparé)"],
    ];
    if (data.roster?.length && data.variableZones?.includes(z.label)) {
      rows.push(["Nom / numéro", `Varie selon la pièce : un fichier PNG par pièce, liste en fin de fiche (${data.roster.length} pièces)`]);
    }
    for (const [k, v] of rows) { text(k, 40, 10, font, MUTED); text(v, 170, 10); y -= 16; }

    if (z.previewPng) {
      const img = await pdf.embedPng(z.previewPng);
      const maxW = width - 80, maxH = y - 80;
      const scale = Math.min(maxW / img.width, maxH / img.height);
      const w = img.width * scale, h = img.height * scale;
      const x = 40 + (maxW - w) / 2;
      const top = y - 14;
      page.drawRectangle({ x, y: top - h, width: w, height: h, borderColor: TERRA, borderWidth: 0.8, borderDashArray: [4, 3], color: rgb(0.95, 0.91, 0.85) });
      page.drawImage(img, { x, y: top - h, width: w, height: h });
    }
    y = 30;
    text(`Version figée ${data.versionHash.slice(0, 16)} · générée le ${data.generatedAt}`, 40, 8, font, MUTED);
  }
  // Team order: the list of pieces, to tick off one by one.
  for (let p = 0; p < rosterPages; p++) {
    const page = pdf.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    let y = height - 50;
    const text = (s: string, x: number, size = 10, f = font, color = BRUN) => page.drawText(safe(s), { x, y, size, font: f, color });
    page.drawRectangle({ x: 0, y: height - 8, width, height: 8, color: TERRA });
    text("SAWWA · LISTE DES PIÈCES", 40, 9, bold, TERRA);
    text(`Page ${data.zones.length + p + 1}/${data.zones.length + rosterPages}`, width - 100, 9, font, MUTED);
    y -= 26;
    text(`${data.reference} · ${data.roster!.length} pièces`, 40, 16, bold);
    y -= 26;
    const cols = [40, 80, 140, 420, 500];
    ["N°", "Taille", "Nom", "Numéro", "Fait"].forEach((h, k) => text(h, cols[k]!, 9, bold, MUTED));
    y -= 6;
    page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 0.6, color: MUTED });
    for (const [k, e] of data.roster!.slice(p * PER_PAGE, (p + 1) * PER_PAGE).entries()) {
      y -= 17;
      text(String(p * PER_PAGE + k + 1), cols[0]!, 10, font, MUTED);
      text(e.size, cols[1]!, 10, bold);
      text(e.name ?? "-", cols[2]!, 11, bold);
      text(e.number ?? "-", cols[3]!, 11, bold);
      page.drawRectangle({ x: cols[4]! + 4, y: y - 2, width: 10, height: 10, borderColor: BRUN, borderWidth: 0.8 });
    }
    y = 30;
    text(`Version figée ${data.versionHash.slice(0, 16)} · générée le ${data.generatedAt}`, 40, 8, font, MUTED);
  }
  return pdf.save();
}
