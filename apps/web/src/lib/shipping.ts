/** Delivery options for the pilot (Dakar). To move into admin-managed rules (shipping_rates) after the pilot. */
export const DELIVERY_OPTIONS = {
  pickup: { label: "Retrait au point SAWWA (Dakar)", price: 0 },
  dakar: { label: "Livraison à Dakar", price: 2000 },
  banlieue: { label: "Livraison banlieue (Pikine, Guédiawaye, Rufisque…)", price: 3000 },
  regions: { label: "Livraison en région", price: 5000 },
} as const;
export type DeliveryKey = keyof typeof DELIVERY_OPTIONS;
export const isDeliveryKey = (v: string): v is DeliveryKey => v in DELIVERY_OPTIONS;
