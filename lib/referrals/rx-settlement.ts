import type { PrismaClient, Prisma } from "@prisma/client";
import { z } from "zod";
import { proposeOriginalSeller, sellerFromOrder, sameSeller } from "./attribution-policy";
import { snapshotAffiliateTerms } from "./affiliate-terms";
import { estimateAffiliateProductEarnings } from "./affiliate-product-earnings";
import { parseRxOwner, type RxOwner } from "./rx-owner-policy";

type Tx = Prisma.TransactionClient;
async function lockCustomer(tx: Tx, companyId: string, customerId: string) {
  z.string().uuid().parse(companyId); z.string().uuid().parse(customerId);
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Customer" WHERE id=${customerId}::uuid AND "companyId"=${companyId}::uuid FOR UPDATE`;
  if (!rows.length) throw new Error("CUSTOMER_UNAVAILABLE");
}
async function activeSeller(tx: Tx, seller: RxOwner) {
  if (seller.role === "DIRECT") return seller.profileId === seller.companyId && Boolean(await tx.company.findUnique({ where: { id: seller.companyId }, select: { id: true } }));
  const role = z.enum(["AFFILIATE", "CONSULTANT", "GROUP_LEADER", "MANAGER", "PARTNER"]).parse(seller.role);
  const where = { id: seller.profileId, companyId: seller.companyId, user: { companyId: seller.companyId, status: "ACTIVE" as const, isActive: true, ...(role !== "AFFILIATE" ? { role } : {}) } };
  if (seller.role === "AFFILIATE") return tx.affiliateProfile.findFirst({ where: { id: seller.profileId, companyId: seller.companyId, status: "APPROVED" } });
  if (seller.role === "CONSULTANT") return tx.consultantProfile.findFirst({ where });
  if (seller.role === "GROUP_LEADER") return tx.groupLeaderProfile.findFirst({ where });
  if (seller.role === "MANAGER") return tx.managerProfile.findFirst({ where });
  return tx.partnerProfile.findFirst({ where });
}
/** Caller must hold the customer lock; never expose this lookup to browser input. */
export async function originalOwner(tx: Tx, companyId: string, customerId: string) {
  const saved = await tx.rxCustomerOwner.findUnique({ where: { customerId } });
  if (saved) {
    if (saved.companyId !== companyId) throw new Error("OWNER_TENANT_MISMATCH");
    return parseRxOwner({ companyId, role: saved.sellerRole, profileId: saved.profileId });
  }
  const orders = await tx.order.findMany({ where: { companyId, customerId, OR: [{ paymentStatus: { in: ["CAPTURED", "REFUNDED"] } }, { paymentTransactions: { some: { status: "CAPTURED" } } }] }, take: 1001,
    select: { id: true, companyId: true, customerId: true, paymentStatus: true, consultantProfileId: true, groupLeaderProfileId: true, managerProfileId: true, partnerProfileId: true,
      paymentTransactions: { where: { companyId, status: "CAPTURED" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 1, select: { createdAt: true } } } });
  if (orders.length > 1000) throw new Error("HISTORICAL_OWNER_REVIEW_REQUIRED");
  const snapshots = await tx.rxOrderCommission.findMany({ where: { companyId, customerId, orderId: { in: orders.map(o => o.id) } } });
  const byOrder = new Map(snapshots.map(s => [s.orderId, s]));
  const proposal = proposeOriginalSeller<RxOwner>(companyId, customerId, orders.map(order => {
    const snap = byOrder.get(order.id);
    const internal = sellerFromOrder(order);
    if (snap && internal && !sameSeller(internal, parseRxOwner({ companyId, role: snap.sellerRole, profileId: snap.profileId }))) throw new Error("HISTORICAL_OWNER_REVIEW_REQUIRED");
    const seller = snap ? parseRxOwner({ companyId, role: snap.sellerRole, profileId: snap.profileId }) : sellerFromOrder(order);
    return { ...order, seller, capturedAt: order.paymentTransactions[0]?.createdAt ?? null };
  }));
  if (proposal.status === "NO_PURCHASE_HISTORY") return null;
  if (proposal.status !== "PROPOSED") throw new Error("HISTORICAL_OWNER_REVIEW_REQUIRED");
  await tx.rxCustomerOwner.create({ data: { companyId, customerId, sellerRole: proposal.seller.role, profileId: proposal.seller.profileId, sourceOrderId: proposal.sourceOrderId, capturedAt: proposal.capturedAt } });
  return proposal.seller;
}

/** Trusted checkout service only. Never accepts prices/rates/customer identity from a public form.
 * Existing seller order/ledger creation must run before this step. No provider calls here. */
export async function prepareRxCommission(db: PrismaClient | Tx, input: { companyId: string; customerId: string; orderId: string; referral: RxOwner | null }) {
  const prepare = async (tx: Tx) => {
    await lockCustomer(tx, input.companyId, input.customerId);
    const order = await tx.order.findFirst({ where: { id: input.orderId, companyId: input.companyId, customerId: input.customerId, paymentStatus: "PENDING" } });
    if (!order) throw new Error("PENDING_ORDER_REQUIRED");
    const existing = await tx.rxOrderCommission.findUnique({ where: { orderId: order.id } });
    if (existing) return existing;
    const owner = await originalOwner(tx, input.companyId, input.customerId);
    const candidate = owner ?? input.referral;
    const seller = candidate ? parseRxOwner(candidate) : null;
    if (!seller || seller.companyId !== input.companyId || !await activeSeller(tx, seller)) throw new Error("ORIGINAL_SELLER_REVIEW_REQUIRED");
    if (!owner && await tx.rxOrderCommission.count({ where: { customerId: input.customerId, status: "AWAITING_PAYMENT" } })) throw new Error("FIRST_PURCHASE_ALREADY_PENDING");
    let rateBps: number | null = null;
    let amountCents = 0;
    let basisCents = Math.max(0, order.grossMarginCents);
    if (seller.role === "DIRECT") {
      if (sellerFromOrder(order) || await tx.commissionSplit.count({ where: { orderId: order.id } }) ||
        await tx.commission.count({ where: { orderId: order.id } })) throw new Error("DIRECT_ORDER_HAS_SELLER_COMMISSION");
      // Zero, not payable, with a durable owner snapshot. Agency fee is independent.
      amountCents = 0;
    } else if (seller.role === "AFFILIATE") {
      if (sellerFromOrder(order)) throw new Error("AFFILIATE_ORDER_HAS_INTERNAL_SELLER");
      // Do not invent affiliate discount-funding policy while checkout is gated.
      if (order.discountCents) throw new Error("AFFILIATE_DISCOUNT_REVIEW_REQUIRED");
      const affiliate = await tx.affiliateProfile.findUniqueOrThrow({ where: { id: seller.profileId } });
      const settings = await tx.affiliateProgramSetting.findUnique({ where: { companyId: input.companyId } });
      rateBps = snapshotAffiliateTerms({ companyId: input.companyId, affiliateCompanyId: affiliate.companyId, affiliateId: affiliate.id, globalRateBps: settings?.commissionBps, affiliateRateBps: affiliate.commissionBps }).rateBps;
      const estimate = estimateAffiliateProductEarnings({ priceCents: basisCents, internalCostCents: 0, rateBps });
      if (estimate === null) throw new Error("INVALID_COMMISSION_AMOUNT");
      amountCents = estimate;
    } else {
      const assigned = sellerFromOrder(order);
      if (!assigned || !sameSeller(assigned, seller)) throw new Error("ORDER_MUST_USE_ORIGINAL_SELLER");
      // Read the established internal ledger; never recalculate agent/hierarchy rates here.
      const split = await tx.commissionSplit.findUnique({ where: { orderId_participantRole: { orderId: order.id, participantRole: seller.role } } });
      const splitProfileId = !split ? null : seller.role === "CONSULTANT" ? split.consultantProfileId : seller.role === "GROUP_LEADER" ? split.groupLeaderProfileId : seller.role === "MANAGER" ? split.managerProfileId : split.partnerProfileId;
      if (!split || split.companyId !== input.companyId || splitProfileId !== seller.profileId) throw new Error("EXISTING_INTERNAL_LEDGER_REQUIRED");
      amountCents = split.amountCents; basisCents = split.grossMarginCents;
    }
    if (!Number.isSafeInteger(amountCents) || amountCents < 0) throw new Error("INVALID_COMMISSION_AMOUNT");
    return tx.rxOrderCommission.create({ data: { orderId: order.id, companyId: input.companyId, customerId: input.customerId, sellerRole: seller.role, profileId: seller.profileId, rateBps, basisCents, amountCents } });
  };
  return "$transaction" in db ? db.$transaction(prepare) : prepare(db);
}

/** Post-capture settlement boundary. Only persisted, matching CAPTURED evidence is accepted.
 * Called by the isolated RX verified-payment adapter, NOT by the browser success page. */
export async function settleRxCommission(db: PrismaClient, input: { companyId: string; orderId: string; captureId: string }) {
  return db.$transaction(async tx => {
    const snapshot = await tx.rxOrderCommission.findUnique({ where: { orderId: input.orderId } });
    if (!snapshot || snapshot.companyId !== input.companyId) throw new Error("RX_SNAPSHOT_REQUIRED");
    await lockCustomer(tx, snapshot.companyId, snapshot.customerId);
    const current = await tx.rxOrderCommission.findUniqueOrThrow({ where: { orderId: input.orderId } });
    const capture = await tx.paymentTransaction.findFirst({ where: { id: input.captureId, companyId: input.companyId, orderId: input.orderId, status: "CAPTURED" }, include: { order: true } });
    if (!capture || capture.order.customerId !== snapshot.customerId || capture.order.companyId !== input.companyId || capture.order.paymentStatus !== "CAPTURED" || capture.amountCents !== capture.order.totalCents || capture.amountCents <= 0) throw new Error("VERIFIED_CAPTURE_REQUIRED");
    if (current.settledAt) return current; // Replays must not reopen an approved/paid/held ledger.
    if (current.status !== "AWAITING_PAYMENT" || await tx.paymentTransaction.count({ where: { companyId: input.companyId, orderId: input.orderId, status: "REFUNDED", amountCents: { gt: 0 } } })) throw new Error("REFUNDED_COMMISSION_REVIEW_REQUIRED");
    const owner = await originalOwner(tx, input.companyId, snapshot.customerId);
    const seller = parseRxOwner({ companyId: snapshot.companyId, role: snapshot.sellerRole, profileId: snapshot.profileId });
    if (!owner || !sameSeller(owner, seller) || !await activeSeller(tx, owner)) throw new Error("ORIGINAL_SELLER_REVIEW_REQUIRED");
    return tx.rxOrderCommission.update({ where: { orderId: input.orderId }, data: { captureId: capture.id, settledAt: new Date(), status: snapshot.amountCents === 0 ? "NOT_PAYABLE" : snapshot.sellerRole === "AFFILIATE" ? "PENDING" : "EXISTING_LEDGER" } });
  });
}

/** Refunds hold the new affiliate ledger for reconciliation; never reassign the customer. */
export async function holdRefundedRxCommission(db: PrismaClient, companyId: string, orderId: string) {
  return db.$transaction(async tx => {
    const snapshot = await tx.rxOrderCommission.findUnique({ where: { orderId } });
    if (!snapshot || snapshot.companyId !== companyId) throw new Error("RX_SNAPSHOT_REQUIRED");
    await lockCustomer(tx, companyId, snapshot.customerId);
    const refund = await tx.paymentTransaction.findFirst({ where: { companyId, orderId, status: "REFUNDED", amountCents: { gt: 0 } } });
    if (!refund) throw new Error("CONFIRMED_REFUND_REQUIRED");
    const current = await tx.rxOrderCommission.findUniqueOrThrow({ where: { orderId } });
    return tx.rxOrderCommission.update({ where: { orderId }, data: { status: current.sellerRole === "DIRECT" ? "NOT_PAYABLE" : ["PAID", "RECOVERY_REQUIRED"].includes(current.status) ? "RECOVERY_REQUIRED" : "ON_HOLD" } });
  });
}
