import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { Resvg } from "@resvg/resvg-js";
import { TECHNIQUE_LABEL, type Technique } from "@sawwa/catalog";
import { layerBox, unionBox, visibleLayers, type DesignDocument } from "@sawwa/design";
import { buildProductionSheet, fontFiles, renderSurfaceSvg } from "@sawwa/render";
import { getSession, hasPlatformRole, vendorMembership } from "@/lib/auth";
import { readDoc } from "@/lib/orders";
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
    if (l.type !== "image" || out[l.src] || !l.src.startsWith("storage:design-assets/")) continue;
    const { data, error } = await db.storage.from("design-assets").download(l.src.slice("storage:design-assets/".length));
    if (error || !data) throw new Error(`Image introuvable : ${l.name}`);
    out[l.src] = `data:${data.type || "image/png"};base64,${Buffer.from(await data.arrayBuffer()).toString("base64")}`;
  }
  return out;
}

function rasterize(svg: string, background?: string) {
  return new Resvg(svg, { font: { fontFiles: fonts(), loadSystemFonts: false, defaultFontFamily: "Manrope" }, ...(background ? { background } : {}) }).render().asPng();
}

/**
 * Production files for the workshop assigned to a fulfillment (or SAWWA ops):
 * ?format=png&zone=<key> → transparent PNG at 300 dpi, real zone size; ?format=pdf → A4 production sheet.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ fulfillmentId: string }> }) {
  const { fulfillmentId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  const vendor = vendorMembership(session.memberships);
  const isOps = hasPlatformRole(session.memberships, ["ops"]);

  const db = createServiceClient();
  const { data: f } = await db
    .from("fulfillments")
    .select("id, status, vendor_id, sla_due_at, order:orders(number), items:order_items(color_key, sizes, decorations, version:design_versions(document, sha256), product:base_products(name, zones(key, anchor, max_width_mm, max_height_mm)))")
    .eq("id", fulfillmentId).maybeSingle();
  if (!f) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  const allowed = isOps || (vendor && vendor.organization.status === "active" && f.vendor_id === vendor.organization.id);
  if (!allowed) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  if (["pending_assignment", "cancelled"].includes(f.status) && !isOps) return NextResponse.json({ error: "Commande non disponible." }, { status: 409 });

  const item = (f.items as unknown as { color_key: string; sizes: Record<string, number>; decorations: { zoneKey: string; technique: Technique; widthMm: number; heightMm: number; colors: number }[]; version: { document: unknown; sha256: string }; product: { name: { fr?: string }; zones: { key: string; anchor: { label?: string; note?: string } | null; max_width_mm: number; max_height_mm: number }[] } }[])[0];
  const doc = item ? readDoc(item.version.document) : null;
  if (!item || !doc) return NextResponse.json({ error: "Création illisible." }, { status: 500 });
  const reference = (f.order as unknown as { number: string } | null)?.number ?? fulfillmentId.slice(0, 8);
  const images = await embedImages(doc);
  const format = request.nextUrl.searchParams.get("format");

  if (format === "png") {
    const zoneKey = request.nextUrl.searchParams.get("zone");
    const surface = doc.surfaces.find((s) => s.zoneKey === zoneKey);
    const zone = item.product.zones.find((z) => z.key === zoneKey);
    if (!surface || !zone) return NextResponse.json({ error: "Zone inconnue." }, { status: 400 });
    const { svg } = renderSurfaceSvg(surface, { maxWidthMm: zone.max_width_mm, maxHeightMm: zone.max_height_mm }, { dpi: 300, images });
    return new NextResponse(new Uint8Array(rasterize(svg)), {
      headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="${reference}-${zone.key}-300dpi.png"`, "Cache-Control": "private, no-store" },
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
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${reference}-fiche-production.pdf"`, "Cache-Control": "private, no-store" },
  });
}
