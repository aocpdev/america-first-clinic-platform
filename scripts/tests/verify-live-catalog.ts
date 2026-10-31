import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
import type { Prisma } from "@prisma/client";
import { buildAffiliateRxLink } from "../../lib/referrals/affiliate-links";

async function main() {
  loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
  const source = process.env.DATABASE_URL;
  const company = process.argv.find(arg => arg.startsWith("--company="))?.slice(10);
  if (!source || !company || process.env.NODE_ENV === "production" || process.env.VERCEL) throw new Error("Local verification only");
  process.env.LOCAL_CATALOG_SOURCE_URL = source;
  process.env.LOCAL_CATALOG_SOURCE_COMPANY = company;
  process.env.DATABASE_URL = "postgresql://axel@127.0.0.1:55439/gvh_affiliate_test";
  const { prisma } = await import("../../lib/db/prisma");
  const { readCatalog } = await import("../../lib/products/catalog-reader");
  try {
    const fixture = await prisma.company.findUniqueOrThrow({ where: { slug: "affiliate-ui-fixture" } });
    const result = await readCatalog(fixture.id, async (db, companyId) => {
      const mode = await (db as Prisma.TransactionClient).$queryRaw<Array<{ transaction_read_only: string }>>`SHOW transaction_read_only`;
      assert.equal(mode[0].transaction_read_only, "on");
      assert.notEqual(companyId, fixture.id);
      const products = await db.product.findMany({ where: { companyId, active: true }, select: { title: true, slug: true, priceCents: true, internalCostCents: true, marginBps: true }, orderBy: { title: "asc" } });
      assert.ok(products.length > 0);
      for (const p of products) {
        if (p.priceCents > 0) assert.equal(p.marginBps, Math.round((p.priceCents - p.internalCostCents) / p.priceCents * 10000));
        assert.equal(new URL(buildAffiliateRxLink("AF-ABC123", p.slug)).searchParams.get("product"), p.slug);
      }
      return { activeProducts: products.length, productLinksValidated: products.length, readOnly: mode[0].transaction_read_only, firstProduct: products[0].title, priceCents: products[0].priceCents, estimateAt25Percent: Math.round(Math.max(0, products[0].priceCents - products[0].internalCostCents) * 0.25) };
    });
    await assert.rejects(readCatalog("00000000-0000-0000-0000-000000000099", async () => null), /COMPANY_MISMATCH/);
    console.log(JSON.stringify(result));
  } finally {
    await prisma.$disconnect();
    await (globalThis as any).previewCatalog?.$disconnect();
  }
}
main().catch(error => { console.error("Live catalog verification failed; no source data was modified.", error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[database URL]").slice(0, 700) : "Unknown error"); process.exitCode = 1; });
