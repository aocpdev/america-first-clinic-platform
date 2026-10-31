import { PrismaClient, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type CatalogDb = Pick<Prisma.TransactionClient, "product" | "productCategory" | "discount">;
const globalCatalog = globalThis as unknown as { previewCatalog?: PrismaClient };

/** Normal deployments read the same company-scoped tables as Admin. The optional
 * local reviewer connection is read-only and never replaces the application's DB. */
export async function readCatalog<T>(companyId: string, read: (db: CatalogDb, companyId: string) => Promise<T>): Promise<T> {
  const sourceUrl = process.env.LOCAL_CATALOG_SOURCE_URL;
  if (!sourceUrl) return read(prisma, companyId);
  const local = new URL(process.env.DATABASE_URL || "http://invalid");
  if (process.env.NODE_ENV === "production" || process.env.VERCEL ||
      !["localhost", "127.0.0.1"].includes(local.hostname) || local.pathname !== "/gvh_affiliate_test" ||
      !process.env.LOCAL_CATALOG_SOURCE_COMPANY) throw new Error("LIVE_CATALOG_PREVIEW_NOT_ALLOWED");
  const fixture = await prisma.company.findUnique({ where: { id: companyId }, select: { slug: true } });
  if (fixture?.slug !== "affiliate-ui-fixture") throw new Error("LIVE_CATALOG_PREVIEW_COMPANY_MISMATCH");
  const source = globalCatalog.previewCatalog ??= new PrismaClient({ datasources: { db: { url: sourceUrl } }, log: [] });
  return source.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const company = await tx.company.findUniqueOrThrow({ where: { slug: process.env.LOCAL_CATALOG_SOURCE_COMPANY! }, select: { id: true } });
    return read(tx, company.id);
  }, { timeout: 15000, maxWait: 5000 });
}
