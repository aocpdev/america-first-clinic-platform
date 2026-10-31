import { PrismaClient } from "@prisma/client";

const url = process.env.AFFILIATE_TEST_DATABASE_URL;
if (!url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname) || new URL(url).pathname !== "/gvh_affiliate_test") {
  throw new Error("UI fixture requires the isolated local gvh_affiliate_test database");
}
const db = new PrismaClient({ datasources: { db: { url } } });
async function main() {
  const company = await db.company.upsert({ where: { slug: "affiliate-ui-fixture" }, update: {}, create: { name: "Local test company", slug: "affiliate-ui-fixture" } });
  for (const account of [
    { email: "artist@example.test", authUserId: "00000000-0000-0000-0000-000000000011", role: "CUSTOMER" as const },
    { email: "admin@example.test", authUserId: "00000000-0000-0000-0000-000000000012", role: "COMPANY_ADMIN" as const }
  ]) {
    await db.user.upsert({ where: { email: account.email }, update: {}, create: { ...account, companyId: company.id, firstName: "Local", lastName: "Fixture" } });
  }
  await db.affiliateProfile.upsert({ where: { companyId_email: { companyId: company.id, email: "artist@example.test" } },
    update: { status: "APPROVED" }, create: { companyId: company.id, displayName: "Local Artist", email: "artist@example.test",
      category: "ARTIST", status: "APPROVED", authUserId: "00000000-0000-0000-0000-000000000011", referralCode: "AF-LOCAL-UI-FIXTURE" } });
  const category = await db.productCategory.upsert({ where: { companyId_slug: { companyId: company.id, slug: "wellness" } }, update: {},
    create: { companyId: company.id, name: "Wellness", slug: "wellness" } });
  const exists = await db.product.findFirst({ where: { companyId: company.id, slug: "local-program" } });
  if (!exists) await db.product.create({ data: { companyId: company.id, categoryId: category.id,
    title: "Example Wellness Program", slug: "local-program", sku: "LOCAL-FIXTURE", description: "Local UI test only.", priceCents: 19900 } });
  const buyer = await db.user.findUniqueOrThrow({ where: { email: "artist@example.test" } });
  const customer = await db.customer.upsert({ where: { userId: buyer.id }, update: {},
    create: { companyId: company.id, userId: buyer.id, email: buyer.email, firstName: "Local", tags: [] } });
  const product = await db.product.findFirstOrThrow({ where: { companyId: company.id, slug: "local-program" } });
  if (!await db.order.findFirst({ where: { companyId: company.id, customerId: customer.id } })) {
    await db.order.create({ data: { companyId: company.id, customerId: customer.id,
      subtotalCents: 19900, totalCents: 19900, paymentProviderCode: "LOCAL_FIXTURE", paymentStatus: "CAPTURED", orderStatus: "COMPLETED",
      items: { create: { productId: product.id, quantity: 1, unitPriceCents: 19900, totalCents: 19900 } } } });
  }
  console.log("Isolated local UI fixture ready. No external auth accounts or emails created.");
}
main().finally(() => db.$disconnect());
