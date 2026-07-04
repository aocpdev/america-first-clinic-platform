"use server";

import Stripe from "stripe";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { getCompanyStripeRuntimeConfig } from "@/lib/payments/stripe-config";

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

function personName(person?: { firstName?: string | null; lastName?: string | null; email?: string | null } | null) {
  const name = [person?.firstName, person?.lastName].filter(Boolean).join(" ").trim();
  return name || person?.email || "Unassigned";
}

function splitParticipantName(split: Awaited<ReturnType<typeof partnerPayoutSplits>>[number]) {
  if (split.participantRole === "PARTNER") return split.partnerProfile?.displayName || personName(split.partnerProfile?.user);
  if (split.participantRole === "MANAGER") return split.managerProfile?.displayName || personName(split.managerProfile?.user);
  if (split.participantRole === "GROUP_LEADER") return split.groupLeaderProfile?.displayName || personName(split.groupLeaderProfile?.user);
  return personName(split.consultantProfile?.user);
}

function splitParticipantEmail(split: Awaited<ReturnType<typeof partnerPayoutSplits>>[number]) {
  if (split.participantRole === "PARTNER") return split.partnerProfile?.user.email || null;
  if (split.participantRole === "MANAGER") return split.managerProfile?.user.email || null;
  if (split.participantRole === "GROUP_LEADER") return split.groupLeaderProfile?.user.email || null;
  return split.consultantProfile?.user.email || null;
}

async function partnerPayoutSplits(orderId: string, partnerProfileId: string) {
  return prisma.commissionSplit.findMany({
    where: {
      orderId,
      OR: [
        { participantRole: "PARTNER", payoutResponsibility: "COMPANY", partnerProfileId },
        { payoutResponsibility: "PARTNER", partnerProfileId }
      ],
      status: "APPROVED"
    },
    include: {
      partnerProfile: { include: { user: true, bankAccount: true } },
      managerProfile: { include: { user: true } },
      groupLeaderProfile: { include: { user: true } },
      consultantProfile: { include: { user: true } }
    },
    orderBy: { participantRole: "asc" }
  });
}

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

export async function sendPartnerPayout(formData: FormData) {
  const user = await requireUser();
  const splitId = String(formData.get("splitId") || "");
  const returnPath = String(formData.get("returnPath") || "/admin/payouts");

  if (!splitId) {
    throw new Error("Missing partner payout reference.");
  }

  const isCompanyAdmin = user.role === "COMPANY_ADMIN" || user.role === "SUPER_ADMIN";
  if (!isCompanyAdmin || !user.companyId) {
    throw new Error("Only company admins can send partner payouts.");
  }

  const split = await prisma.commissionSplit.findUnique({
    where: { id: splitId },
    include: {
      partnerProfile: { include: { user: true, bankAccount: true } }
    }
  });

  if (!split) {
    throw new Error("Partner payout item was not found.");
  }

  if (
    split.companyId !== user.companyId ||
    split.status !== "APPROVED" ||
    split.payoutResponsibility !== "COMPANY" ||
    split.participantRole !== "PARTNER" ||
    !split.partnerProfileId
  ) {
    throw new Error("This payout item is not ready for partner payout.");
  }

  const bankAccount = split.partnerProfile?.bankAccount;
  if (!bankAccount || bankAccount.status !== "READY") {
    throw new Error("The partner must add a ready bank account before this payout can be sent.");
  }

  const splits = await partnerPayoutSplits(split.orderId, split.partnerProfileId);
  const partnerSplit = splits.find((item) => item.id === split.id);
  if (!partnerSplit) {
    throw new Error("The partner split is no longer approved.");
  }

  const totalCents = splits.reduce((total, item) => total + item.amountCents, 0);
  const partnerRetainedCents = partnerSplit.amountCents;
  const downlineObligationCents = Math.max(0, totalCents - partnerRetainedCents);

  let status = "PAID_MANUAL_BANK";
  let providerCode = "bank_record";
  let providerRef: string | null = null;
  let stripeTransferId: string | null = null;
  let rawEvent: unknown = { reason: "bank_record_only" };

  if (bankAccount.stripeConnectedAccountId) {
    const config = await getCompanyStripeRuntimeConfig(user.companyId);
    if (!config.secretKey) {
      throw new Error("Stripe is not configured for partner payouts.");
    }

    const stripe = new Stripe(config.secretKey);
    const transfer = await stripe.transfers.create(
      {
        amount: totalCents,
        currency: "usd",
        destination: bankAccount.stripeConnectedAccountId,
        transfer_group: `partner_payout_${split.orderId}`,
        metadata: {
          companyId: split.companyId,
          orderId: split.orderId,
          partnerProfileId: split.partnerProfileId,
          source: "partner_payout",
          stripeMode: config.mode
        }
      },
      {
        idempotencyKey: `partner_payout_${split.id}`
      }
    );

    status = "TRANSFERRED";
    providerCode = "stripe";
    providerRef = transfer.id;
    stripeTransferId = transfer.id;
    rawEvent = transfer;
  }

  await prisma.$transaction(async (tx) => {
    const payout = await tx.partnerPayout.create({
      data: {
        companyId: split.companyId,
        partnerProfileId: split.partnerProfileId!,
        bankAccountLast4: bankAccount.accountLast4,
        bankRoutingLast4: bankAccount.routingLast4,
        stripeConnectedAccountId: bankAccount.stripeConnectedAccountId,
        stripeTransferId,
        totalCents,
        partnerRetainedCents,
        downlineObligationCents,
        status,
        providerCode,
        providerRef,
        paidAt: new Date(),
        rawEvent: jsonSafe(rawEvent),
        createdByUserId: user.id
      }
    });

    await tx.partnerPayoutLine.createMany({
      data: splits.map((item) => ({
        partnerPayoutId: payout.id,
        commissionSplitId: item.id,
        orderId: item.orderId,
        participantRole: item.participantRole,
        participantName: splitParticipantName(item),
        participantEmail: splitParticipantEmail(item),
        amountCents: item.amountCents,
        payoutResponsibility: item.payoutResponsibility
      })),
      skipDuplicates: true
    });

    await tx.commissionSplit.update({
      where: { id: split.id },
      data: {
        status: "PAID",
        paidAt: new Date()
      }
    });
  });

  revalidatePath(returnPath);
  revalidatePath("/partner/payouts");
}
