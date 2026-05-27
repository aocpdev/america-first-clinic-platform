"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";

export async function markCommissionSplitPaid(formData: FormData) {
  const user = await requireUser();
  const splitId = String(formData.get("splitId") || "");
  const returnPath = String(formData.get("returnPath") || "/admin/payouts");

  if (!splitId) {
    throw new Error("Missing payout reference.");
  }

  const split = await prisma.commissionSplit.findUnique({
    where: { id: splitId },
    select: {
      id: true,
      companyId: true,
      status: true,
      payoutResponsibility: true,
      participantRole: true,
      partnerProfileId: true
    }
  });

  if (!split) {
    throw new Error("Payout item was not found.");
  }

  if (split.status !== "APPROVED") {
    throw new Error("Only approved payout items can be marked as paid.");
  }

  const isCompanyAdmin = user.role === "COMPANY_ADMIN" || user.role === "SUPER_ADMIN";
  const canCompanyPayPartner =
    isCompanyAdmin &&
    split.companyId === user.companyId &&
    split.payoutResponsibility === "COMPANY" &&
    split.participantRole === "PARTNER";

  const canPartnerPayNetwork =
    user.role === "PARTNER" &&
    user.partnerProfile?.id === split.partnerProfileId &&
    split.payoutResponsibility === "PARTNER";

  if (!canCompanyPayPartner && !canPartnerPayNetwork) {
    throw new Error("You do not have permission to pay this item.");
  }

  await prisma.commissionSplit.update({
    where: { id: split.id },
    data: {
      status: "PAID",
      paidAt: new Date()
    }
  });

  revalidatePath(returnPath);
}
