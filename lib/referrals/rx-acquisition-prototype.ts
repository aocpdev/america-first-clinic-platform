import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { proposeOriginalSeller, sellerFromOrder, type SellerRole } from "./attribution-policy";
import { snapshotAffiliateTerms } from "./affiliate-terms";

type Owner = { customerId: string; companyId: string; sourceOrderId: string;
  captureTransactionId: string; sellerRole: SellerRole; profileId: string; capturedAt: Date };
type AffiliateOrder = { orderId: string; companyId: string; affiliateId: string;
  terms: ReturnType<typeof snapshotAffiliateTerms> };

/** Isolated persistence experiment. Deliberately impossible to use against production. */
export function localAcquisitionPrototype(url: string) {
  const parsed = new URL(url);
  if (!["localhost", "127.0.0.1"].includes(parsed.hostname) || parsed.pathname !== "/gvh_affiliate_test") {
    throw new Error("ACQUISITION_PROTOTYPE_LOCAL_DATABASE_ONLY");
  }
  const db = new PrismaClient({ datasources: { db: { url } } });
  return {
    close: () => db.$disconnect(),
    async snapshotAffiliate(companyId: string, orderId: string, referredAffiliateId: string) {
      for (const id of [companyId, orderId, referredAffiliateId]) z.string().uuid().parse(id);
      return db.$transaction(async tx => {
        const customers = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT c.id FROM public."Customer" c JOIN public."Order" o ON o."customerId" = c.id
          WHERE o.id = ${orderId}::uuid AND o."companyId" = ${companyId}::uuid
          AND c."companyId" = ${companyId}::uuid FOR UPDATE OF c`;
        if (!customers[0]) throw new Error("ORDER_UNAVAILABLE");
        const customerId = customers[0].id;
        const original = await tx.$queryRaw<Owner[]>`
          SELECT * FROM rx_acquisition_prototype.owner WHERE "customerId" = ${customerId}::uuid
          AND "companyId" = ${companyId}::uuid`;
        if (original[0] && original[0].sellerRole !== "AFFILIATE") throw new Error("ORIGINAL_INTERNAL_OWNER_REQUIRES_INTERNAL_ORDER_FLOW");
        const affiliateId = original[0]?.profileId ?? referredAffiliateId;
        const stored = await tx.$queryRaw<AffiliateOrder[]>`
          SELECT * FROM rx_acquisition_prototype.affiliate_order WHERE "orderId" = ${orderId}::uuid
          AND "companyId" = ${companyId}::uuid`;
        if (stored[0]) {
          if (stored[0].affiliateId !== affiliateId) throw new Error("AFFILIATE_ORDER_CONFLICT");
          return stored[0];
        }
        const order = await tx.order.findFirst({ where: { id: orderId, companyId, paymentStatus: "PENDING" } });
        if (!order || sellerFromOrder(order)) throw new Error("INVALID_AFFILIATE_ORDER");
        const history = !original[0] && await tx.order.count({ where: {
          companyId, customerId, OR: [{ paymentStatus: { in: ["CAPTURED", "REFUNDED"] } },
            { paymentTransactions: { some: { companyId, status: "CAPTURED" } } }]
        } });
        if (history) throw new Error("HISTORICAL_OWNER_REVIEW_REQUIRED");
        const [affiliate, program] = await Promise.all([
          tx.affiliateProfile.findFirst({ where: { id: affiliateId, companyId, status: "APPROVED" } }),
          tx.affiliateProgramSetting.findUnique({ where: { companyId } })
        ]);
        if (!affiliate) throw new Error("AFFILIATE_UNAVAILABLE");
        const terms = snapshotAffiliateTerms({ companyId, affiliateCompanyId: affiliate.companyId,
          affiliateId, globalRateBps: program?.commissionBps, affiliateRateBps: affiliate.commissionBps });
        const rows = await tx.$queryRaw<AffiliateOrder[]>`INSERT INTO rx_acquisition_prototype.affiliate_order
          ("orderId", "companyId", "affiliateId", terms)
          VALUES (${orderId}::uuid, ${companyId}::uuid, ${affiliateId}::uuid, ${JSON.stringify(terms)}::jsonb)
          RETURNING *`;
        return rows[0];
      });
    },
    async confirm(companyId: string, customerId: string, captureTransactionId: string) {
      for (const id of [companyId, customerId, captureTransactionId]) z.string().uuid().parse(id);
      return db.$transaction(async tx => {
        // Every claimant for this customer serializes here; never hold a payment HTTP call under this lock.
        const customers = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM public."Customer" WHERE id = ${customerId}::uuid
          AND "companyId" = ${companyId}::uuid FOR UPDATE`;
        if (!customers.length) throw new Error("CUSTOMER_UNAVAILABLE");
        const capture = await tx.paymentTransaction.findFirst({ where: {
          id: captureTransactionId, companyId, status: "CAPTURED",
          order: { customerId, companyId, paymentStatus: "CAPTURED" }
        }, select: { id: true, orderId: true } });
        if (!capture) return { status: "REVIEW_REQUIRED" as const, reason: "CAPTURE_NOT_CONFIRMED" };
        const existing = await tx.$queryRaw<Owner[]>`
          SELECT * FROM rx_acquisition_prototype.owner WHERE "customerId" = ${customerId}::uuid
          AND "companyId" = ${companyId}::uuid`;
        if (existing[0]) {
          const currentTerms = await tx.$queryRaw<AffiliateOrder[]>`
            SELECT * FROM rx_acquisition_prototype.affiliate_order WHERE "orderId" = ${capture.orderId}::uuid
            AND "companyId" = ${companyId}::uuid`;
          if (currentTerms[0] && (existing[0].sellerRole !== "AFFILIATE" ||
            existing[0].profileId !== currentTerms[0].affiliateId)) {
            return { status: "REVIEW_REQUIRED" as const, reason: "ORDER_TERMS_REQUIRE_ORIGINAL_OWNER_RECONCILIATION", owner: existing[0] };
          }
          return { status: "RETAINED" as const, owner: existing[0] };
        }
        const orders = await tx.order.findMany({ where: { companyId, customerId },
          orderBy: { id: "asc" }, take: 1001,
          select: { id: true, companyId: true, customerId: true, paymentStatus: true,
            consultantProfileId: true, groupLeaderProfileId: true, managerProfileId: true, partnerProfileId: true,
            paymentTransactions: { where: { companyId, status: "CAPTURED" },
              orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 1,
              select: { id: true, createdAt: true } } } });
        if (orders.length > 1000) return { status: "REVIEW_REQUIRED" as const, reason: "HISTORY_LIMIT_REQUIRES_REVIEW" };
        const affiliateOrders = await tx.$queryRaw<AffiliateOrder[]>`
          SELECT s.* FROM rx_acquisition_prototype.affiliate_order s JOIN public."Order" o ON o.id = s."orderId"
          WHERE s."companyId" = ${companyId}::uuid AND o."companyId" = ${companyId}::uuid
          AND o."customerId" = ${customerId}::uuid`;
        const affiliateMap = new Map(affiliateOrders.map(order => [order.orderId, order]));
        if (orders.some(order => affiliateMap.has(order.id) && sellerFromOrder(order))) {
          return { status: "REVIEW_REQUIRED" as const, reason: "CONFLICTING_ORDER_ATTRIBUTION" };
        }
        const proposal = proposeOriginalSeller(companyId, customerId, orders.map(order => ({
          ...order, seller: affiliateMap.has(order.id)
            ? { companyId, role: "AFFILIATE" as const, profileId: affiliateMap.get(order.id)!.affiliateId }
            : sellerFromOrder(order), capturedAt: order.paymentTransactions[0]?.createdAt ?? null
        })));
        if (proposal.status !== "PROPOSED") return proposal;
        const where = { id: proposal.seller.profileId, companyId,
          user: { companyId, status: "ACTIVE" as const } };
        const select = { id: true };
        const active = proposal.seller.role === "AFFILIATE"
          ? await tx.affiliateProfile.findFirst({ where: { id: proposal.seller.profileId, companyId, status: "APPROVED" }, select })
          : proposal.seller.role === "CONSULTANT"
          ? await tx.consultantProfile.findFirst({ where: { ...where, user: { ...where.user, role: "CONSULTANT" } }, select })
          : proposal.seller.role === "GROUP_LEADER"
            ? await tx.groupLeaderProfile.findFirst({ where: { ...where, user: { ...where.user, role: "GROUP_LEADER" } }, select })
            : proposal.seller.role === "MANAGER"
              ? await tx.managerProfile.findFirst({ where: { ...where, user: { ...where.user, role: "MANAGER" } }, select })
              : await tx.partnerProfile.findFirst({ where: { ...where, user: { ...where.user, role: "PARTNER" } }, select });
        if (!active) return { status: "REVIEW_REQUIRED" as const, reason: "OWNER_INACTIVE_OR_TENANT_MISMATCH" };
        const source = orders.find(order => order.id === proposal.sourceOrderId)!;
        const owner: Owner = { companyId, customerId, sourceOrderId: source.id,
          captureTransactionId: source.paymentTransactions[0].id, capturedAt: proposal.capturedAt,
          sellerRole: proposal.seller.role, profileId: proposal.seller.profileId };
        await tx.$executeRaw`INSERT INTO rx_acquisition_prototype.owner
          ("companyId", "customerId", "sourceOrderId", "captureTransactionId", "capturedAt", "sellerRole", "profileId")
          SELECT ${companyId}::uuid, ${customerId}::uuid, ${owner.sourceOrderId}::uuid,
            p.id, p."createdAt", ${owner.sellerRole}, ${owner.profileId}::uuid
          FROM public."PaymentTransaction" p WHERE p.id = ${owner.captureTransactionId}::uuid`;
        return { status: "CREATED" as const, owner };
      });
    }
  };
}
