"use server";

import { quoteStudio, type StudioDecoration } from "@/lib/studio-data";

export async function getStudioQuote(slug: string, colorKey: string, quantity: number, decorations: StudioDecoration[]) {
  return quoteStudio({ slug: String(slug), colorKey: String(colorKey), quantity: Number(quantity), decorations: Array.isArray(decorations) ? decorations : [] });
}
