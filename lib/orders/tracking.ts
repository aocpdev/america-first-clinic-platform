export const SHIPPING_CARRIERS = [
  { value: "fedex", label: "FedEx" },
  { value: "ups", label: "UPS" },
  { value: "usps", label: "USPS" },
  { value: "dhl", label: "DHL" },
  { value: "other", label: "Other carrier" }
] as const;

export type ShippingCarrierCode = (typeof SHIPPING_CARRIERS)[number]["value"];

export function normalizeCarrier(carrier: string | null) {
  const normalized = carrier?.trim().toLowerCase() ?? "";
  return SHIPPING_CARRIERS.some((item) => item.value === normalized) ? (normalized as ShippingCarrierCode) : "";
}

export function carrierTrackingUrl(carrier: string | null, trackingCode: string | null) {
  if (!carrier || !trackingCode) return null;
  const code = encodeURIComponent(trackingCode);
  const normalizedCarrier = normalizeCarrier(carrier);

  if (normalizedCarrier === "fedex") return `https://www.fedex.com/fedextrack/?trknbr=${code}`;
  if (normalizedCarrier === "ups") return `https://www.ups.com/track?tracknum=${code}`;
  if (normalizedCarrier === "usps") return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${code}`;
  if (normalizedCarrier === "dhl") return `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${code}`;

  return null;
}

export function carrierLabel(carrier: string | null) {
  const normalizedCarrier = normalizeCarrier(carrier);
  if (!normalizedCarrier) return carrier || "Carrier pending";
  const carrierOption = SHIPPING_CARRIERS.find((item) => item.value === normalizedCarrier);
  if (carrierOption) return carrierOption.label;
  return carrier || "Carrier pending";
}
