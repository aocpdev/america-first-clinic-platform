import { Prisma } from "@prisma/client";

export function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(cents / 100);
}

export function dollarsToCents(value: FormDataEntryValue | null) {
  const numeric = Number(String(value ?? "0").replace(/[$,\s]/g, ""));
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return Math.round(numeric * 100);
}

export function centsToDollars(cents: number) {
  return (cents / 100).toFixed(2);
}

export function calculateMarginBps(priceCents: number, internalCostCents: number) {
  if (priceCents <= 0) {
    return 0;
  }
  return Math.round(((priceCents - internalCostCents) / priceCents) * 10000);
}

export function formatPercentBps(bps: number) {
  return `${(bps / 100).toFixed(1)}%`;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function productMetadataFromForm(formData: FormData): Prisma.InputJsonValue {
  return {
    healthcareCategory: String(formData.get("healthcareCategory") || "wellness"),
    importSource: String(formData.get("importSource") || "manual"),
    requiresConsult: formData.get("requiresConsult") === "on"
  };
}
