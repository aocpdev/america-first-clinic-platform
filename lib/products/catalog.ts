import { Prisma } from "@prisma/client";

export type ProductSalesGuide = {
  benefits: string[];
  talkingPoints: string[];
  commonObjections: string[];
  callNotes: string;
};

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

function linesFromForm(formData: FormData, key: string) {
  return String(formData.get(key) || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function productMetadataFromForm(formData: FormData): Prisma.InputJsonValue {
  return {
    healthcareCategory: String(formData.get("healthcareCategory") || "wellness"),
    importSource: String(formData.get("importSource") || "manual"),
    requiresConsult: formData.get("requiresConsult") === "on",
    salesGuide: {
      benefits: linesFromForm(formData, "benefits"),
      talkingPoints: linesFromForm(formData, "talkingPoints"),
      commonObjections: linesFromForm(formData, "commonObjections"),
      callNotes: String(formData.get("callNotes") || "").trim()
    }
  };
}

function isRecord(value: Prisma.JsonValue | unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

export function extractProductSalesGuide(metadata: Prisma.JsonValue | null | undefined): ProductSalesGuide {
  if (!isRecord(metadata) || !isRecord(metadata.salesGuide)) {
    return {
      benefits: [],
      talkingPoints: [],
      commonObjections: [],
      callNotes: ""
    };
  }

  return {
    benefits: stringArray(metadata.salesGuide.benefits),
    talkingPoints: stringArray(metadata.salesGuide.talkingPoints),
    commonObjections: stringArray(metadata.salesGuide.commonObjections),
    callNotes: typeof metadata.salesGuide.callNotes === "string" ? metadata.salesGuide.callNotes : ""
  };
}

export function linesToTextarea(lines: string[]) {
  return lines.join("\n");
}
