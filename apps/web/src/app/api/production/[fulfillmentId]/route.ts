import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { Resvg } from "@resvg/resvg-js";
import { TECHNIQUE_LABEL, slugify, type Technique } from "@sawwa/catalog";
import { layerBox, personalize, unionBox, visibleLayers, type DesignDocument, type RosterEntry } from "@sawwa/design";
import { buildProductionSheet, fontFiles, renderSurfaceSvg, setPngDpi } from "@sawwa/render";
import { getSession, hasPlatformRole, vendorMembership } from "@/lib/auth";
import { logError } from "@/lib/log";
import { readDoc } from "@/lib/orders";
import { storageRef } from "@/lib/storage-refs";
import { UnprintableImageError, toPrintableImage } from "@/lib/print-images";
import { TOO_MANY, rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const FONT_DIR = path.join(process.cwd(), "..", "..", "packages", "render", "fonts");
const fonts = () => fontFiles().map((f) => path.join(FONT_DIR, f));

/** Original images of a design as data URIs (full resolution, for print). */
async function embedImages(doc: DesignDocument) {
  const db = createServiceClient();
  const out: Record<string, string> = {};
  for (const l of doc.surfaces.flatMap((s) => s.layers)) {
    const ref = l.type === "image" ? storageRef(l.src) : null;
    if (l.type !== "image" || out[l.src] || !ref) continue;
    const { data, error } = await db.storage.from(ref.bucket).download(ref.path);
    if (error || !data) throw new ProductionError(`L'image « ${l.name} » de cette création est introuvable. Prévenez l'équipe SAWWA.`, 502);
    const printable = await toPrintableImage(new Uint8Array(await data.arrayBuffer()), data.type || "image/png");
    out[l.src] = `data:${printable.mime};base64,${Buffer.from(printable.bytes).toString("base64")}`;
  }
  return out;
}

class ProductionError extends Error {
  constructor(readonly userMessage: string, readonly status: number) { super(userMessage); }
}

/** Plain French message, readable when opened from a download link. */
const fail = (message: string, status: number) =>
  new NextResponse(`${message}\n`, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

function rasterize(svg: string, background?: string) {
  return new Resvg(svg, { font: { fontFiles: fonts(), loadSystemFonts: false, defaultFontFamily: "Manrope" }, ...(background ? { background } : {}) }).render().asPng();
}

/**
 * Production files for the workshop assigned to a fulfillment (or SAWWA ops):
 * ?format=png&zone=<key> → transparent PNG at 300 dpi, real zone size; ?format=pdf → A4 production sheet.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ fulfillmentId: string }> }) {
  try {
    return await generate(request, (await ctx.params).fulfillmentId);
  } catch (e) {
    if (e instanceof ProductionError) return fail(e.userMessage, e.status);
    if (e instanceof UnprintableImageError) return fail(`${e.userMessage} Prévenez l'équipe SAWWA.`, 422);
    logError("production_file_failed", e, { fulfillmentId: (await ctx.params).fulfillmentId });
    return fail("Le fichier n'a pas pu être généré. Réessayez dans un instant ; si le problème continue, prévenez l'équipe SAWWA.", 500);
  }
}

async function generate(request: NextRequest, fulfillmentId: string) {
  const session = await getSession();
  if (!session) return fail("Connectez-vous pour télécharger ce fichier.", 401);
  if (!(await rateLimit("productionPerUser", session.user.id))) return fail(TOO_MANY, 429);
  const vendor = vendorMembership(session.memberships);
  const isOps = hasPlatformRole(session.memberships, ["ops"]);

  const db = createServiceClient();
  const { data: f } = await db
    .from("fulfillments")
    .select("id, status, vendor_id, sla_due_at, order:orders(number), items:order_items(color_key, sizes, decorations, roster, version:design_versions(document, sha256), product:base_products(name, zones(key, anchor, max_width_mm, max_height_mm)))")
    .eq("id", fulfillmentId).maybeSingle();
  if (!f) return fail("Commande introuvable.", 404);
  const allowed = isOps || (vendor && vendor.organization.status === "active" && f.vendor_id === vendor.organization.id);
  if (!allowed) return fail("Ce fichier est réservé à l'atelier affecté à la commande.", 403);
  if (["pending_assignment", "cancelled"].includes(f.status) && !isOps) return fail("Cette commande n'est pas (ou plus) affectée à un atelier.", 409);

  const item = (f.items as unknown as { color_key: string; sizes: Record<string, number>; roster: RosterEntry[] | null; decorations: { zoneKey: string; technique: Technique; widthMm: number; heightMm: number; colors: number }[]; version: { document: unknown; sha256: string }; product: { name: { fr?: string }; zones: { key: string; anchor: { label?: string; note?: string } | null; max_width_mm: number; max_height_mm: number }[] } }[])[0];
  const doc = item ? readDoc(item.version.document) : null;
  if (!item || !doc) return fail("La création de cette commande est illisible. Prévenez l'équipe SAWWA.", 500);
  const reference = (f.order as unknown as { number: string } | null)?.number ?? fulfillmentId.slice(0, 8);
  const images = await embedImages(doc);
  const format = request.nextUrl.searchParams.get("format");

  if (format === "png") {
    const zoneKey = request.nextUrl.searchParams.get("zone");
    // Team order (E16): ?piece=N (1-based) prints that piece's name and number.
    const pieceParam = request.nextUrl.searchParams.get("piece");
    const roster = item.roster ?? [];
    let printed = doc;
    let pieceLabel = "";
    if (pieceParam !== null) {
      const n = Number(pieceParam);
      const entry = Number.isInteger(n) && n >= 1 ? roster[n - 1] : undefined;
      if (!entry) return fail("Pièce inconnue pour cette commande.", 400);
      printed = personalize(doc, entry);
      pieceLabel = `-piece${String(n).padStart(3, "0")}-${entry.size}${entry.number ? `-n${entry.number}` : ""}${entry.name ? `-${slugify(entry.name)}` : ""}`;
    } else if (roster.length && doc.surfaces.some((s) => s.zoneKey === zoneKey && s.layers.some((l) => l.type === "text" && l.perItem))) {
      return fail("Cette zone change sur chaque pièce : téléchargez le fichier de chaque pièce.", 400);
    }
    const surface = printed.surfaces.find((s) => s.zoneKey === zoneKey);
    const zone = item.product.zones.find((z) => z.key === zoneKey);
    if (!surface || !zone) return fail("Zone inconnue pour cette commande.", 400);
    const { svg } = renderSurfaceSvg(surface, { maxWidthMm: zone.max_width_mm, maxHeightMm: zone.max_height_mm }, { dpi: 300, images });
    return new NextResponse(new Uint8Array(setPngDpi(new Uint8Array(rasterize(svg)), 300)), {
      headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="${reference}-${zone.key}${pieceLabel}-300dpi.png"`, "Cache-Control": "private, no-store" },
    });
  }

  const zones = item.decorations.map((d) => {
    const zone = item.product.zones.find((z) => z.key === d.zoneKey)!;
    const surface = doc.surfaces.find((s) => s.zoneKey === d.zoneKey)!;
    const box = unionBox(visibleLayers(surface).map(layerBox));
    const { svg } = renderSurfaceSvg(surface, { maxWidthMm: zone.max_width_mm, maxHeightMm: zone.max_height_mm }, { dpi: 60, images });
    return {
      label: zone.anchor?.label ?? zone.key,
      technique: TECHNIQUE_LABEL[d.technique] ?? d.technique,
      printedWidthCm: d.widthMm / 10, printedHeightCm: d.heightMm / 10,
      offsetLeftCm: Math.max(0, box?.minX ?? 0) / 10, offsetTopCm: Math.max(0, box?.minY ?? 0) / 10,
      zoneWidthCm: zone.max_width_mm / 10, zoneHeightCm: zone.max_height_mm / 10,
      anchorNote: zone.anchor?.note ?? null,
      colors: d.technique === "embroidery" || d.technique === "screen_print" ? d.colors : null,
      previewPng: new Uint8Array(rasterize(svg, "#F2E9D8")),
    };
  });
  const pdf = await buildProductionSheet({
    reference, productName: item.product.name.fr ?? "", colorName: item.color_key.replace(/_/g, " "), sizes: item.sizes,
    dueDate: f.sla_due_at ? new Date(f.sla_due_at).toLocaleString("fr-SN", { dateStyle: "short", timeStyle: "short" }) : null,
    versionHash: item.version.sha256, generatedAt: new Date().toLocaleString("fr-SN", { dateStyle: "short", timeStyle: "short" }), zones,
    roster: item.roster,
    variableZones: item.decorations.filter((d) => doc.surfaces.some((s) => s.zoneKey === d.zoneKey && s.layers.some((l) => l.type === "text" && l.perItem)))
      .map((d) => item.product.zones.find((z) => z.key === d.zoneKey)?.anchor?.label ?? d.zoneKey),
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${reference}-fiche-production.pdf"`, "Cache-Control": "private, no-store" },
  });
}
