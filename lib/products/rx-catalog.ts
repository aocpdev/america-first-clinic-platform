import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { RX_HOST } from "./rx-routing";
import type { Prisma } from "@prisma/client";

export const requireRxCompany = cache(async () => {
  if (process.env.RX_STOREFRONT_ENABLED !== "true") notFound();
  const slug = process.env.RX_COMPANY_SLUG;
  if (!slug) notFound();
  const company = await prisma.company.findUnique({ where: { slug }, select: { id: true } });
  if (!company) notFound();
  return company;
});

/** Public fields only; no internal cost, margin, sales notes, inventory or patient data. */
export const rxProductSelect = {
  id: true, slug: true, title: true, description: true, priceCents: true,
  supportsRecurring: true, category: { select: { name: true } },
  images: { orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
    take: 1, select: { url: true, alt: true } }
} satisfies Prisma.ProductSelect;

export async function rxBasePath() {
  const host = (await headers()).get("host")?.split(":")[0].toLowerCase();
  return host === RX_HOST ? "" : "/rx";
}
