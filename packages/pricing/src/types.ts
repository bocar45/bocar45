import type { BasisPoints, CurrencyCode, Money } from "@sawwa/domain";

/** A unit cost that applies from `minQty` pieces (quantity tiers, sorted or not). */
export interface Tier {
  readonly minQty: number;
  readonly unitCost: number; // minor units, vendor currency, excl. tax
}

export type TechniqueKey = "dtg" | "dtf" | "embroidery" | "screen_print" | "sublimation" | "uv" | "engraving" | "flock";

/** What a vendor charges for one decoration (technique × zone × max print size). */
export interface DecorationRate {
  readonly technique: TechniqueKey;
  readonly zoneKey: string;
  readonly maxWidthMm: number;
  readonly maxHeightMm: number;
  readonly tiers: readonly Tier[];
  /** One-off per order and per design (screen setup, embroidery digitising…). */
  readonly setupFee?: number;
  /** Extra unit cost per colour beyond the first (screen printing). */
  readonly extraColorUnitCost?: number;
  readonly maxColors?: number;
  readonly minQty?: number;
}

/** A vendor's price grid for one offer (one reference product). Versioned, immutable once used. */
export interface VendorPriceGrid {
  readonly vendorId: string;
  readonly version: number;
  readonly currency: CurrencyCode;
  /** Blank cost per variant id. */
  readonly blanks: Readonly<Record<string, readonly Tier[]>>;
  readonly decorations: readonly DecorationRate[];
  readonly orderSetupFee?: number;
  readonly minOrderQty?: number;
}

/** SAWWA platform rules. Versioned; editable by admins without code changes. */
export interface PlatformRuleSet {
  readonly version: number;
  readonly currency: CurrencyCode;
  readonly defaultMarginBps: BasisPoints;
  readonly marginByCategoryBps?: Readonly<Record<string, BasisPoints>>;
  /** Margin floor per unit, minor units excl. tax. Discounts can never go below it. */
  readonly minMarginPerUnit: number;
  readonly vatBps: BasisPoints;
  /** Public TTC unit prices are rounded up to this step (e.g. 50 FCFA). */
  readonly priceStep: number;
  readonly deposit?: { readonly thresholdTotal: number; readonly bps: BasisPoints };
}

export interface DecorationRequest {
  readonly zoneKey: string;
  readonly technique: TechniqueKey;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly colors?: number;
}

export type Discount =
  | { readonly kind: "percent"; readonly bps: BasisPoints; readonly code?: string }
  | { readonly kind: "amount"; readonly amount: number; readonly code?: string };

export interface PriceRequest {
  readonly category: string;
  /** Quantity per variant (e.g. size × colour). Tiers use the total quantity. */
  readonly lines: readonly { readonly variantId: string; readonly quantity: number }[];
  readonly decorations: readonly DecorationRequest[];
  /** Shipping price charged to the customer, TTC. */
  readonly shipping?: Money;
  readonly discount?: Discount;
}

export interface PricedLine {
  readonly variantId: string;
  readonly quantity: number;
  readonly vendorUnitCost: Money;
  readonly unitPrice: Money; // TTC, rounded to the step
  readonly total: Money; // TTC
}

export interface PricedDecoration {
  readonly zoneKey: string;
  readonly technique: TechniqueKey;
  readonly vendorUnitCost: Money;
  readonly unitPrice: Money; // TTC share shown to the customer ("impression devant : 2 300 FCFA")
}

export interface Quote {
  readonly currency: CurrencyCode;
  readonly totalQuantity: number;
  readonly lines: readonly PricedLine[];
  readonly decorations: readonly PricedDecoration[];
  readonly setupFee: Money; // TTC, one-off
  readonly goodsSubtotal: Money; // TTC before discount
  readonly discount: Money; // TTC, positive
  readonly discountCapped: boolean;
  readonly shipping: Money; // TTC
  readonly total: Money; // TTC
  readonly totalExclTax: Money;
  readonly tax: Money;
  readonly depositDue: Money | null;
  /** SAWWA side, never shown to customers. */
  readonly vendorCost: Money;
  readonly margin: Money; // goods excl. tax after discount − vendor cost
  /** Everything needed to reproduce this quote later. */
  readonly snapshot: {
    readonly ruleSetVersion: number;
    readonly vendorId: string;
    readonly vendorGridVersion: number;
    readonly request: PriceRequest;
  };
}
