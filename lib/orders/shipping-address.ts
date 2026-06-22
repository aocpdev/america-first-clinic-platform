import type { Prisma } from "@prisma/client";

export type OrderShippingAddress = {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

function metadataObject(metadata: Prisma.JsonValue | null | undefined) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function orderShippingAddress(metadata: Prisma.JsonValue | null | undefined): OrderShippingAddress | null {
  const source = metadataObject(metadata)?.shippingAddress;
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;

  const address = source as Record<string, unknown>;
  const line1 = stringValue(address.line1);
  const city = stringValue(address.city);
  const state = stringValue(address.state);
  const postalCode = stringValue(address.postalCode);
  const country = stringValue(address.country) || "US";

  if (!line1 || !city || !state || !postalCode) return null;

  return {
    line1,
    line2: stringValue(address.line2) || null,
    city,
    state,
    postalCode,
    country
  };
}

export function formatOrderShippingAddress(address: OrderShippingAddress | null) {
  if (!address) return null;

  return [
    address.line1,
    address.line2,
    `${address.city}, ${address.state} ${address.postalCode}`,
    address.country
  ]
    .filter(Boolean)
    .join(", ");
}
