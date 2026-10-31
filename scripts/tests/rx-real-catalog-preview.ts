import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

// Source is read-only; destination is strictly the disposable local database.
loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const sourceUrl = process.env.DATABASE_URL;
const destinationUrl = process.env.RX_PREVIEW_DATABASE_URL;
const companySlug = process.argv.find(arg => arg.startsWith("--company="))?.slice(10);
const affiliatePreview = process.argv.includes("--affiliate-preview");
const previewSlug = affiliatePreview ? "affiliate-ui-fixture" : "rx-real-catalog-preview";
if (!sourceUrl || !destinationUrl || !companySlug) throw new Error("Explicit source company and preview database required");
const destination = new URL(destinationUrl);
if (!["localhost", "127.0.0.1"].includes(destination.hostname) || destination.pathname !== "/gvh_affiliate_test" || sourceUrl === destinationUrl) {
  throw new Error("Destination must be the isolated local preview database");
}
const source = new PrismaClient({ datasources: { db: { url: sourceUrl } }, log: [] });
const local = new PrismaClient({ datasources: { db: { url: destinationUrl } }, log: [] });
async function main() {
  const products = await source.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    const company = await tx.company.findUniqueOrThrow({ where: { slug: companySlug }, select: { id: true } });
    return tx.product.findMany({ where: { companyId: company.id, active: true },
      select: { title: true, slug: true, description: true, priceCents: true, supportsRecurring: true,
        ...(affiliatePreview ? { internalCostCents: true, marginBps: true } : {}),
        category: { select: { name: true, slug: true } }, images: { select: { url: true, alt: true, sortOrder: true } } } });
  }, { timeout: 30000 });
  if (!products.length) throw new Error("Source has no active products; preview unchanged");
  await local.$transaction(async tx => {
    const company = await tx.company.upsert({ where: { slug: previewSlug }, update: {},
      create: { slug: previewSlug, name: "Real catalog · local preview only" } });
    await tx.product.updateMany({ where: { companyId: company.id }, data: { active: false } });
    for (const item of products) {
      const category = await tx.productCategory.upsert({ where: { companyId_slug: { companyId: company.id, slug: item.category.slug } },
        update: { name: item.category.name }, create: { companyId: company.id, ...item.category } });
      const data = { title: item.title, description: item.description, priceCents: item.priceCents,
        ...(affiliatePreview ? { internalCostCents: item.internalCostCents, marginBps: item.marginBps } : {}),
        supportsRecurring: item.supportsRecurring, categoryId: category.id, active: true };
      const product = await tx.product.upsert({ where: { companyId_slug: { companyId: company.id, slug: item.slug } }, update: data,
        create: { ...data, companyId: company.id, slug: item.slug, sku: `RX-PREVIEW-${item.slug}` } });
      await tx.productImage.deleteMany({ where: { productId: product.id } });
      if (item.images.length) await tx.productImage.createMany({ data: item.images.map(image => ({ ...image, productId: product.id })) });
    }
  }, { timeout: 30000 });
  console.log(JSON.stringify({ copiedActiveProducts: products.length, categories: new Set(products.map(item => item.category.slug)).size,
    imageReferences: products.reduce((count, item) => count + item.images.length, 0), previewCompany: previewSlug,
    sourceWrites: 0, customersCopied: 0, ordersCopied: 0, productEconomicsCopied: affiliatePreview }));
}
main().catch(() => { console.error("Catalog preview failed. No source data was modified; check connection and company configuration."); process.exitCode = 1; })
  .finally(async () => { await source.$disconnect(); await local.$disconnect(); });
