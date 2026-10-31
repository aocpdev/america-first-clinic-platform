import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const url = process.env.AFFILIATE_TEST_DATABASE_URL;
if (!url || new URL(url).hostname !== "127.0.0.1" || new URL(url).pathname !== "/gvh_affiliate_test") throw new Error("Isolated local database required");
const db = new PrismaClient({ datasources: { db: { url } } });
const origin = "http://127.0.0.1:3008";
async function main() {
  const affiliate = await db.affiliateProfile.findFirstOrThrow({ where: { company: { slug: "affiliate-ui-fixture" }, email: "artist@example.test", status: "APPROVED" } });
  const product = await db.product.findFirstOrThrow({ where: { companyId: affiliate.companyId, active: true }, orderBy: { title: "asc" } });
  const before = await db.order.count();
  const request = (query: string) => fetch(`${origin}/rx/referral?${query}`, { redirect: "manual" });
  const store = await request(`ref=${affiliate.referralCode}`);
  assert.equal(store.status, 303);
  assert.equal(store.headers.get("location"), `${origin}/rx/`);
  const cookie = store.headers.get("set-cookie")!;
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=lax/i);
  assert.match(cookie, /Path=\/rx/i);
  assert.match(store.headers.get("cache-control")!, /no-store/);
  const detail = await request(`ref=${affiliate.referralCode}&product=${product.slug}`);
  assert.equal(detail.status, 303);
  assert.equal(detail.headers.get("location"), `${origin}/rx/products/${product.slug}`);
  for (const query of [`ref=AF-NOUSER99`, `ref=${affiliate.referralCode}&ref=AF-OTHER1`, `ref=${affiliate.referralCode}&product=../admin`, `ref=${affiliate.referralCode}&product=missing-product-999`]) {
    const response = await request(query);
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("set-cookie"), null);
  }
  try {
    await db.affiliateProfile.update({ where: { id: affiliate.id }, data: { status: "SUSPENDED" } });
    assert.equal((await request(`ref=${affiliate.referralCode}`)).status, 404);
  } finally { await db.affiliateProfile.update({ where: { id: affiliate.id }, data: { status: affiliate.status } }); }
  assert.equal(await db.order.count(), before);
  console.log(JSON.stringify({ storeRedirect: true, productRedirect: true, cookieHttpOnly: true, invalidLinksRejected: 4, suspendedAffiliateRejected: true, ordersCreated: 0 }));
}
main().finally(() => db.$disconnect());
