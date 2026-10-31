import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { getCustomerOrder, listCustomerOrders } from "./customer-orders";
const url = process.env.RX_TEST_DATABASE_URL;
test("own order history excludes other customers and companies and internal fields", { skip: !url }, async () => {
  const parsed = new URL(url!);
  assert.ok(["localhost", "127.0.0.1"].includes(parsed.hostname) && parsed.pathname === "/gvh_affiliate_test", "isolated local fixture only");
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    const buyer = await db.customer.findFirstOrThrow({ where: { user: { email: "artist@example.test" }, company: { slug: "affiliate-ui-fixture" } } });
    const orders = await listCustomerOrders(db, buyer, 1);
    assert.ok(orders.length > 0);
    const expected = await db.order.findMany({ where: { companyId: buyer.companyId, customerId: buyer.id }, select: { id: true } });
    assert.deepEqual(new Set(orders.map(order => order.id)), new Set(expected.map(order => order.id)));
    assert.deepEqual(await listCustomerOrders(db, { companyId: "00000000-0000-0000-0000-000000000099", id: buyer.id }, 1), []);
    assert.deepEqual(await listCustomerOrders(db, { companyId: buyer.companyId, id: "00000000-0000-0000-0000-000000000099" }, 1), []);
    assert.deepEqual(Object.keys(orders[0]).sort(), ["id", "createdAt", "totalCents", "paymentStatus", "orderStatus", "items"].sort());
    assert.equal("grossMarginCents" in orders[0], false);
    assert.equal("orderNotes" in orders[0], false);
    const detail = await getCustomerOrder(db, buyer, orders[0].id);
    assert.ok(detail);
    assert.equal(detail.totalCents, orders[0].totalCents);
    assert.deepEqual(Object.keys(detail).sort(), ["id", "createdAt", "subtotalCents", "discountCents", "taxCents", "shippingCents", "totalCents", "paymentStatus", "orderStatus", "shippingCarrier", "shippingTrackingCode", "shippedAt", "items"].sort());
    const savedShipping = await db.order.findUniqueOrThrow({ where: { id: detail.id }, select: { shippingCarrier: true, shippingTrackingCode: true, shippedAt: true } });
    assert.equal(detail.shippingCarrier, savedShipping.shippingCarrier);
    assert.equal(detail.shippingTrackingCode, savedShipping.shippingTrackingCode);
    assert.deepEqual(detail.shippedAt, savedShipping.shippedAt);
    const rollback = new Error("LOCAL_TRACKING_TEST_ROLLBACK");
    await assert.rejects(db.$transaction(async tx => {
      const shippedAt = new Date("2026-09-17T12:00:00Z");
      await tx.order.update({ where: { id: detail.id }, data: { shippingCarrier: "ups", shippingTrackingCode: "LOCAL-TEST-ONLY", shippedAt } });
      const shipped = await getCustomerOrder(tx, buyer, detail.id);
      assert.equal(shipped?.shippingCarrier, "ups");
      assert.equal(shipped?.shippingTrackingCode, "LOCAL-TEST-ONLY");
      assert.deepEqual(shipped?.shippedAt, shippedAt);
      throw rollback;
    }), error => error === rollback);
    assert.deepEqual(await db.order.findUniqueOrThrow({ where: { id: detail.id }, select: { shippingCarrier: true, shippingTrackingCode: true, shippedAt: true } }), savedShipping);
    assert.equal(await getCustomerOrder(db, buyer, "invalid"), null);
    const other = await db.order.findFirstOrThrow({ where: { customerId: { not: buyer.id } }, select: { id: true } });
    assert.equal(await getCustomerOrder(db, buyer, other.id), null);
    assert.equal(await getCustomerOrder(db, { companyId: "00000000-0000-0000-0000-000000000099", id: buyer.id }, orders[0].id), null);
  } finally { await db.$disconnect(); }
});
