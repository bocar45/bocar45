import {
  BPS_100_PERCENT,
  applyBps,
  divRound,
  money,
  multiply,
  roundToStep,
  splitGross,
  subtract,
  sum,
  zero,
  type Money,
} from "@sawwa/domain";
import type {
  DecorationRate,
  DecorationRequest,
  PlatformRuleSet,
  PriceRequest,
  PricedDecoration,
  PricedLine,
  Quote,
  Tier,
  VendorPriceGrid,
} from "./types.ts";

export type PricingErrorCode =
  | "EMPTY_ORDER"
  | "INVALID_QUANTITY"
  | "CURRENCY_MISMATCH"
  | "VARIANT_NOT_OFFERED"
  | "DECORATION_NOT_OFFERED"
  | "TOO_MANY_COLORS"
  | "BELOW_MIN_QTY";

export class PricingError extends Error {
  override readonly name = "PricingError";
  constructor(
    readonly code: PricingErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** Unit cost of the highest tier whose minQty ≤ qty. */
export function tierCost(tiers: readonly Tier[], qty: number): number | null {
  let best: Tier | null = null;
  for (const t of tiers) {
    if (t.minQty <= qty && (best === null || t.minQty > best.minQty)) best = t;
  }
  return best?.unitCost ?? null;
}

/** Smallest offered print size covering the request (by area), for this technique and zone. */
function matchDecoration(grid: VendorPriceGrid, req: DecorationRequest): DecorationRate {
  const candidates = grid.decorations
    .filter(
      (d) =>
        d.technique === req.technique &&
        d.zoneKey === req.zoneKey &&
        d.maxWidthMm >= req.widthMm &&
        d.maxHeightMm >= req.heightMm,
    )
    .sort((a, b) => a.maxWidthMm * a.maxHeightMm - b.maxWidthMm * b.maxHeightMm);
  const rate = candidates[0];
  if (!rate) {
    throw new PricingError(
      "DECORATION_NOT_OFFERED",
      `${req.technique} on ${req.zoneKey} at ${req.widthMm}×${req.heightMm} mm is not offered`,
    );
  }
  return rate;
}

function marginBps(rules: PlatformRuleSet, category: string): number {
  return rules.marginByCategoryBps?.[category] ?? rules.defaultMarginBps;
}

/** Vendor cost excl. tax → public unit price TTC, rounded up to the price step, margin floor applied. */
function toPublicUnitPrice(cost: Money, rules: PlatformRuleSet, category: string): Money {
  const withMargin = applyBps(cost, BPS_100_PERCENT + marginBps(rules, category), "up");
  const floor = money(cost.amount + rules.minMarginPerUnit, cost.currency);
  const net = withMargin.amount >= floor.amount ? withMargin : floor;
  const gross = applyBps(net, BPS_100_PERCENT + rules.vatBps, "up");
  return roundToStep(gross, rules.priceStep, "up");
}

/**
 * The single pricing function of SAWWA. Pure and deterministic:
 * same request + same rule set + same vendor grid ⇒ same quote.
 */
export function price(request: PriceRequest, rules: PlatformRuleSet, grid: VendorPriceGrid): Quote {
  const currency = rules.currency;
  if (grid.currency !== currency) {
    throw new PricingError("CURRENCY_MISMATCH", `rules in ${currency}, vendor grid in ${grid.currency}`);
  }
  if (request.lines.length === 0) throw new PricingError("EMPTY_ORDER", "no items");
  for (const l of request.lines) {
    if (!Number.isSafeInteger(l.quantity) || l.quantity <= 0) {
      throw new PricingError("INVALID_QUANTITY", `invalid quantity for ${l.variantId}`);
    }
  }

  const totalQuantity = request.lines.reduce((n, l) => n + l.quantity, 0);
  if (grid.minOrderQty && totalQuantity < grid.minOrderQty) {
    throw new PricingError("BELOW_MIN_QTY", `minimum ${grid.minOrderQty} pieces`);
  }

  // Decorations: same for every variant of the line.
  let setupCost = grid.orderSetupFee ?? 0;
  const decorationCosts: { req: DecorationRequest; unit: Money }[] = request.decorations.map((req) => {
    const rate = matchDecoration(grid, req);
    if (rate.minQty && totalQuantity < rate.minQty) {
      throw new PricingError("BELOW_MIN_QTY", `${req.technique} requires ${rate.minQty} pieces`);
    }
    const colors = req.colors ?? 1;
    if (rate.maxColors && colors > rate.maxColors) {
      throw new PricingError("TOO_MANY_COLORS", `${req.technique} allows ${rate.maxColors} colours`);
    }
    const base = tierCost(rate.tiers, totalQuantity);
    if (base === null) throw new PricingError("BELOW_MIN_QTY", `no ${req.technique} tier for ${totalQuantity} pieces`);
    setupCost += rate.setupFee ?? 0;
    const unit = base + Math.max(0, colors - 1) * (rate.extraColorUnitCost ?? 0);
    return { req, unit: money(unit, currency) };
  });
  const decorationUnitCost = sum(
    decorationCosts.map((d) => d.unit),
    currency,
  );

  const lines: PricedLine[] = request.lines.map((l) => {
    const tiers = grid.blanks[l.variantId];
    const blank = tiers ? tierCost(tiers, totalQuantity) : null;
    if (blank === null) throw new PricingError("VARIANT_NOT_OFFERED", `variant ${l.variantId} not offered`);
    const vendorUnitCost = money(blank + decorationUnitCost.amount, currency);
    const unitPrice = toPublicUnitPrice(vendorUnitCost, rules, request.category);
    return { variantId: l.variantId, quantity: l.quantity, vendorUnitCost, unitPrice, total: multiply(unitPrice, l.quantity) };
  });

  const decorations: PricedDecoration[] = decorationCosts.map(({ req, unit }) => ({
    zoneKey: req.zoneKey,
    technique: req.technique,
    vendorUnitCost: unit,
    unitPrice: toPublicUnitPrice(unit, rules, request.category),
  }));

  const setupCostMoney = money(setupCost, currency);
  const setupFee =
    setupCost > 0
      ? roundToStep(
          applyBps(applyBps(setupCostMoney, BPS_100_PERCENT + marginBps(rules, request.category), "up"), BPS_100_PERCENT + rules.vatBps, "up"),
          rules.priceStep,
          "up",
        )
      : zero(currency);

  const goodsSubtotal = sum([...lines.map((l) => l.total), setupFee], currency);
  const vendorCost = sum(
    [...lines.map((l) => multiply(l.vendorUnitCost, l.quantity)), setupCostMoney],
    currency,
  );

  // Discount, capped so the margin never drops below the floor.
  let discount = zero(currency);
  if (request.discount) {
    const d = request.discount;
    discount = d.kind === "percent" ? applyBps(goodsSubtotal, d.bps, "down") : money(Math.max(0, d.amount), currency);
  }
  const minGoodsNet = vendorCost.amount + rules.minMarginPerUnit * totalQuantity;
  const minGoodsGross = divRound(minGoodsNet * (BPS_100_PERCENT + rules.vatBps), BPS_100_PERCENT, "up");
  const maxDiscount = Math.max(0, goodsSubtotal.amount - minGoodsGross);
  const discountCapped = discount.amount > maxDiscount;
  if (discountCapped) discount = money(maxDiscount, currency);

  const goodsAfterDiscount = subtract(goodsSubtotal, discount);
  const shipping = request.shipping ?? zero(currency);
  if (shipping.currency !== currency) throw new PricingError("CURRENCY_MISMATCH", "shipping currency");
  const total = sum([goodsAfterDiscount, shipping], currency);
  const { net: totalExclTax, tax } = splitGross(total, rules.vatBps);
  const goodsNet = splitGross(goodsAfterDiscount, rules.vatBps).net;
  const margin = subtract(goodsNet, vendorCost);

  const depositDue =
    rules.deposit && total.amount >= rules.deposit.thresholdTotal
      ? roundToStep(applyBps(total, rules.deposit.bps, "up"), rules.priceStep, "up")
      : null;

  return {
    currency,
    totalQuantity,
    lines,
    decorations,
    setupFee,
    goodsSubtotal,
    discount,
    discountCapped,
    shipping,
    total,
    totalExclTax,
    tax,
    depositDue,
    vendorCost,
    margin,
    snapshot: {
      ruleSetVersion: rules.version,
      vendorId: grid.vendorId,
      vendorGridVersion: grid.version,
      request,
    },
  };
}
