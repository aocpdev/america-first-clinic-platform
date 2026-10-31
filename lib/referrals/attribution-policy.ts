/** Acquisition ownership is separate from CRM assignment and order fulfillment. */
export type SellerRole = "CONSULTANT" | "GROUP_LEADER" | "MANAGER" | "PARTNER" | "AFFILIATE";

export type SellerIdentity = {
  companyId: string;
  role: SellerRole;
  profileId: string;
};

type OwnerIdentity = { companyId: string; role: string; profileId: string };
export type PurchaseEvidence<T extends OwnerIdentity = SellerIdentity> = {
  id: string;
  companyId: string;
  customerId: string;
  paymentStatus: string;
  capturedAt: Date | null;
  seller: T | null;
};

export type AcquisitionResult<T extends OwnerIdentity = SellerIdentity> =
  | { status: "PROPOSED"; seller: T; sourceOrderId: string; capturedAt: Date }
  | { status: "NO_PURCHASE_HISTORY" }
  | { status: "REVIEW_REQUIRED"; reason: string };

export function sameSeller(a: OwnerIdentity, b: OwnerIdentity) {
  return a.companyId === b.companyId && a.role === b.role && a.profileId === b.profileId;
}

/** Read-only proposal; never substitutes invoice creation time for capture time. */
export function proposeOriginalSeller<T extends OwnerIdentity = SellerIdentity>(companyId: string, customerId: string, orders: PurchaseEvidence<T>[]): AcquisitionResult<T> {
  if (orders.some((order) => order.companyId !== companyId || order.customerId !== customerId ||
    (order.seller && order.seller.companyId !== companyId))) {
    return { status: "REVIEW_REQUIRED", reason: "TENANT_OR_CUSTOMER_MISMATCH" };
  }
  const purchased = orders.filter((order) => order.paymentStatus === "CAPTURED" || order.paymentStatus === "REFUNDED" || order.capturedAt);
  if (!purchased.length) return { status: "NO_PURCHASE_HISTORY" };
  // Do not silently change ownership when a previous purchase was refunded.
  if (purchased.some((order) => order.paymentStatus === "REFUNDED")) {
    return { status: "REVIEW_REQUIRED", reason: "REFUNDED_PURCHASE_HISTORY" };
  }
  if (purchased.some((order) => !order.capturedAt || !Number.isFinite(order.capturedAt.getTime()))) {
    return { status: "REVIEW_REQUIRED", reason: "CAPTURE_TIME_MISSING" };
  }
  const sorted = [...purchased].sort((a, b) => a.capturedAt!.getTime() - b.capturedAt!.getTime() || a.id.localeCompare(b.id));
  const first = sorted[0];
  if (!first.seller) return { status: "REVIEW_REQUIRED", reason: "FIRST_PURCHASE_UNATTRIBUTED" };
  const seller = first.seller;
  const tied = sorted.filter((order) => order.capturedAt!.getTime() === first.capturedAt!.getTime());
  if (tied.some((order) => !order.seller || !sameSeller(order.seller, seller))) {
    return { status: "REVIEW_REQUIRED", reason: "FIRST_PURCHASE_AMBIGUOUS" };
  }
  return { status: "PROPOSED", seller, sourceOrderId: first.id, capturedAt: first.capturedAt! };
}

export type AttributionDecision =
  | { status: "ATTRIBUTED"; seller: SellerIdentity; reason: "ORIGINAL_OWNER_RETAINED" }
  | { status: "PROVISIONAL"; seller: SellerIdentity; reason: "FIRST_PURCHASE_REFERRAL" }
  | { status: "UNATTRIBUTED" }
  | { status: "REVIEW_REQUIRED"; reason: string };

/** This decides attribution only. It never grants account access or issues money. */
export function resolvePurchaseAttribution(input: {
  companyId: string;
  originalOwner: SellerIdentity | null;
  originalOwnerActive: boolean;
  referral: SellerIdentity | null;
  referralActive: boolean;
  hasPurchaseHistory: boolean;
}): AttributionDecision {
  if (input.originalOwner) {
    if (input.originalOwner.companyId !== input.companyId) {
      return { status: "REVIEW_REQUIRED", reason: "OWNER_TENANT_MISMATCH" };
    }
    if (!input.originalOwnerActive) return { status: "REVIEW_REQUIRED", reason: "OWNER_INACTIVE" };
    return { status: "ATTRIBUTED", seller: input.originalOwner, reason: "ORIGINAL_OWNER_RETAINED" };
  }
  if (input.hasPurchaseHistory) return { status: "REVIEW_REQUIRED", reason: "HISTORICAL_OWNER_UNRESOLVED" };
  if (!input.referral) return { status: "UNATTRIBUTED" };
  if (input.referral.companyId !== input.companyId) return { status: "REVIEW_REQUIRED", reason: "REFERRAL_TENANT_MISMATCH" };
  if (!input.referralActive) return { status: "REVIEW_REQUIRED", reason: "REFERRAL_INACTIVE" };
  // Persist only after a verified payment capture, not after a click or draft order.
  return { status: "PROVISIONAL", seller: input.referral, reason: "FIRST_PURCHASE_REFERRAL" };
}

/** The deepest seller wins; ancestor profile IDs are supervision, not acquisition. */
export function sellerFromOrder(order: {
  companyId: string;
  consultantProfileId: string | null;
  groupLeaderProfileId: string | null;
  managerProfileId: string | null;
  partnerProfileId: string | null;
}): SellerIdentity | null {
  const candidates = [
    ["CONSULTANT", order.consultantProfileId],
    ["GROUP_LEADER", order.groupLeaderProfileId],
    ["MANAGER", order.managerProfileId],
    ["PARTNER", order.partnerProfileId]
  ] as const;
  const candidate = candidates.find(([, id]) => Boolean(id));
  return candidate ? { companyId: order.companyId, role: candidate[0], profileId: candidate[1]! } : null;
}
