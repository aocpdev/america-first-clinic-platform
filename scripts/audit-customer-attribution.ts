import { prisma } from "../lib/db/prisma";
import { proposeOriginalSeller, sameSeller, sellerFromOrder } from "../lib/referrals/attribution-policy";

/** Read-only: no account creation, backfill, email, commission or payout mutations. */
async function main() {
  const companySlug = process.argv.find((arg) => arg.startsWith("--company="))?.slice("--company=".length);
  if (!companySlug) throw new Error("Specify --company=SLUG. This audit is read-only and company scoped.");
  const company = await prisma.company.findUnique({ where: { slug: companySlug }, select: { id: true } });
  if (!company) throw new Error("Company not found.");
  const report = {
    customers: 0, proposed: 0, noPurchaseHistory: 0, reviewRequired: 0,
    currentAssignmentDiffers: 0, multipleHistoricalSellers: 0,
    duplicateNormalizedEmailGroups: 0,
    reasons: {} as Record<string, number>
  };
  let cursor: string | undefined;
  while (true) {
    const customers = await prisma.customer.findMany({
      where: { companyId: company.id }, orderBy: { id: "asc" }, take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true, companyId: true, consultantProfileId: true, groupLeaderProfileId: true,
        managerProfileId: true, partnerProfileId: true,
        orders: {
          where: { companyId: company.id },
          select: {
            id: true, companyId: true, customerId: true, paymentStatus: true,
            consultantProfileId: true, groupLeaderProfileId: true, managerProfileId: true, partnerProfileId: true,
            paymentTransactions: {
              where: { companyId: company.id, status: "CAPTURED" },
              orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 1,
              select: { createdAt: true }
            }
          }
        }
      }
    });
    if (!customers.length) break;
    for (const customer of customers) {
      report.customers++;
      const orders = customer.orders.map((order) => ({ ...order, seller: sellerFromOrder(order), capturedAt: order.paymentTransactions[0]?.createdAt ?? null }));
      const result = proposeOriginalSeller(company.id, customer.id, orders);
      if (result.status === "PROPOSED") {
        report.proposed++;
        const assigned = sellerFromOrder(customer);
        if (assigned && !sameSeller(assigned, result.seller)) report.currentAssignmentDiffers++;
      } else if (result.status === "NO_PURCHASE_HISTORY") report.noPurchaseHistory++;
      else {
        report.reviewRequired++;
        report.reasons[result.reason] = (report.reasons[result.reason] ?? 0) + 1;
      }
      const sellers = new Set(orders.filter((order) => order.capturedAt || order.paymentStatus === "CAPTURED" || order.paymentStatus === "REFUNDED")
        .flatMap((order) => order.seller ? [`${order.seller.role}:${order.seller.profileId}`] : []));
      if (sellers.size > 1) report.multipleHistoricalSellers++;
    }
    cursor = customers[customers.length - 1].id;
  }
  const duplicates = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count FROM (
      SELECT lower(btrim(email)) FROM "Customer" WHERE "companyId" = ${company.id}::uuid
      GROUP BY lower(btrim(email)) HAVING COUNT(*) > 1
    ) AS duplicates
  `;
  report.duplicateNormalizedEmailGroups = duplicates[0]?.count ?? 0;
  // Aggregate output only: no patient names, email, dates of birth or payment details.
  console.log(JSON.stringify({ readOnly: true, ...report }, null, 2));
}

main().catch(() => {
  console.error("Attribution audit failed. Verify the company argument and database connection. No data was changed.");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
