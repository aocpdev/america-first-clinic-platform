"use server";

import Stripe from "stripe";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { getCompanyStripeRuntimeConfig } from "@/lib/payments/stripe-config";
import { syncPayoutAccount } from "@/lib/payments/payout-accounts";

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
  const forceExternal = String(formData.get("payoutRail") || "") === "external";

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

  const bankAccount = split.partnerProfile?.bankAccount ?? null;

  const splits = await partnerPayoutSplits(split.orderId, split.partnerProfileId);
  const partnerSplit = splits.find((item) => item.id === split.id);
  if (!partnerSplit) {
    throw new Error("The partner split is no longer approved.");
  }

  const totalCents = splits.reduce((total, item) => total + item.amountCents, 0);
  const partnerRetainedCents = partnerSplit.amountCents;
  const downlineObligationCents = Math.max(0, totalCents - partnerRetainedCents);

  let status = bankAccount?.accountLast4 ? "PAID_MANUAL_BANK" : "PAID_EXTERNAL";
  let providerCode = bankAccount?.accountLast4 ? "external_bank" : "external_payment";
  let providerRef: string | null = null;
  let stripeTransferId: string | null = null;
  let rawEvent: unknown = {
    reason: bankAccount?.accountLast4 ? "external_bank_record" : "external_payment_without_destination",
    note: "Payout recorded in CRM. Funds were not moved by Stripe."
  };

  if (bankAccount?.stripeConnectedAccountId && !forceExternal) {
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
        bankAccountLast4: bankAccount?.accountLast4 ?? null,
        bankRoutingLast4: bankAccount?.routingLast4 ?? null,
        stripeConnectedAccountId: bankAccount?.stripeConnectedAccountId ?? null,
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

export async function sendPayout(formData: FormData) {
  const user = await requireUser();
  const splitId = String(formData.get("splitId") || "");
  const returnPath = String(formData.get("returnPath") || "/admin/payouts");
  const paymentMethod = String(formData.get("paymentMethod") || "BANK") === "CASH" ? "CASH" : "BANK";

  if (!splitId) throw new Error("Missing payout reference.");
  if ((user.role !== "COMPANY_ADMIN" && user.role !== "SUPER_ADMIN") || !user.companyId) {
    throw new Error("Only company admins can send payouts.");
  }

  const split = await prisma.commissionSplit.findUnique({
    where: { id: splitId },
    include: {
      partnerProfile: { include: { user: true } },
      managerProfile: { include: { user: true } },
      groupLeaderProfile: { include: { user: true } },
      consultantProfile: { include: { user: true } },
      payoutTransfer: true
    }
  });
  if (!split || split.companyId !== user.companyId || split.status !== "APPROVED") {
    throw new Error("This payout is not approved or no longer available.");
  }
  if (split.amountCents <= 0) {
    throw new Error("Zero-dollar commissions cannot be paid out.");
  }

  const recipient = split.participantRole === "PARTNER"
    ? split.partnerProfile?.user
    : split.participantRole === "MANAGER"
      ? split.managerProfile?.user
      : split.participantRole === "GROUP_LEADER"
        ? split.groupLeaderProfile?.user
        : split.consultantProfile?.user;
  if (!recipient) throw new Error("The payout recipient does not have an active user profile.");

  if (split.payoutTransfer) {
    await prisma.commissionSplit.update({ where: { id: split.id }, data: { status: "PAID", paidAt: split.payoutTransfer.paidAt ?? new Date() } });
    revalidatePath(returnPath);
    return;
  }

  let stripeConnectedAccountId: string | null = null;
  let stripeTransferId: string | null = null;
  let rawEvent: unknown = { method: "cash", note: "Cash payout recorded by a Go Virtual Health administrator. No electronic funds were moved." };

  if (paymentMethod === "BANK") {
    const payoutAccount = await syncPayoutAccount({ id: recipient.id, companyId: split.companyId });
    if (!payoutAccount?.stripeConnectedAccountId || payoutAccount.status !== "READY" || !payoutAccount.transfersEnabled) {
      throw new Error("The recipient must complete tax and bank setup before this payout can be sent.");
    }

    const config = await getCompanyStripeRuntimeConfig(user.companyId);
    if (!config.secretKey) throw new Error("The company payout processor is not configured.");
    const stripe = new Stripe(config.secretKey);
    const transfer = await stripe.transfers.create(
      {
        amount: split.amountCents,
        currency: "usd",
        destination: payoutAccount.stripeConnectedAccountId,
        transfer_group: `commission_${split.orderId}`,
        metadata: {
          companyId: split.companyId,
          orderId: split.orderId,
          commissionSplitId: split.id,
          recipientUserId: recipient.id,
          recipientRole: split.participantRole,
          source: "direct_commission_payout",
          stripeMode: config.mode
        }
      },
      { idempotencyKey: `direct_commission_payout_${split.id}` }
    );
    stripeConnectedAccountId = payoutAccount.stripeConnectedAccountId;
    stripeTransferId = transfer.id;
    rawEvent = transfer;
  }

  const paidAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.payoutTransfer.create({
      data: {
        companyId: split.companyId,
        commissionSplitId: split.id,
        recipientUserId: recipient.id,
        amountCents: split.amountCents,
        paymentMethod,
        stripeConnectedAccountId,
        stripeTransferId,
        status: paymentMethod === "CASH" ? "PAID_CASH" : "TRANSFERRED",
        rawEvent: jsonSafe(rawEvent),
        createdByUserId: user.id,
        paidAt
      }
    });
    await tx.commissionSplit.update({ where: { id: split.id }, data: { status: "PAID", paidAt } });
  });

  revalidatePath(returnPath);
  revalidatePath("/partner/payouts");
  revalidatePath("/manager/payouts");
  revalidatePath("/consultant/payouts");
}

export async function sendRecipientPayout(formData: FormData) {
  const user = await requireUser();
  const splitIds = Array.from(new Set(formData.getAll("splitId").map(String).filter(Boolean))).sort();
  const requestedRecipientUserId = String(formData.get("recipientUserId") || "");
  const returnPath = String(formData.get("returnPath") || "/admin/payouts");
  const paymentMethod = String(formData.get("paymentMethod") || "BANK") === "CASH" ? "CASH" : "BANK";

  if ((user.role !== "COMPANY_ADMIN" && user.role !== "SUPER_ADMIN") || !user.companyId) {
    throw new Error("Only company admins can send grouped payouts.");
  }
  if (!splitIds.length) throw new Error("Select at least one approved payout.");
  if (!requestedRecipientUserId) throw new Error("The payout recipient is missing.");

  const splits = await prisma.commissionSplit.findMany({
    where: { id: { in: splitIds } },
    include: {
      partnerProfile: { include: { user: true } },
      managerProfile: { include: { user: true } },
      groupLeaderProfile: { include: { user: true } },
      consultantProfile: { include: { user: true } },
      payoutTransfer: true
    },
    orderBy: { id: "asc" }
  });
  if (splits.length !== splitIds.length) throw new Error("One or more payout items could not be found.");

  const payoutItems = splits.map((split) => {
    const recipient = split.participantRole === "PARTNER"
      ? split.partnerProfile?.user
      : split.participantRole === "MANAGER"
        ? split.managerProfile?.user
        : split.participantRole === "GROUP_LEADER"
          ? split.groupLeaderProfile?.user
          : split.consultantProfile?.user;
    return { split, recipient };
  });
  const recipientUserId = payoutItems[0]?.recipient?.id;
  if (!recipientUserId || payoutItems.some(({ recipient }) => recipient?.id !== recipientUserId)) {
    throw new Error("A grouped payout can only contain items for one recipient.");
  }
  if (recipientUserId !== requestedRecipientUserId) throw new Error("The payout recipient does not match the selected items.");
  if (payoutItems.some(({ split }) => split.companyId !== user.companyId || split.status !== "APPROVED" || split.amountCents <= 0 || split.payoutTransfer)) {
    throw new Error("Every grouped item must be approved, unpaid, positive, and belong to this company.");
  }

  const allEligibleSplits = await prisma.commissionSplit.findMany({
    where: {
      companyId: user.companyId,
      status: "APPROVED",
      amountCents: { gt: 0 },
      payoutTransfer: { is: null },
      OR: [
        { partnerProfile: { userId: recipientUserId } },
        { managerProfile: { userId: recipientUserId } },
        { groupLeaderProfile: { userId: recipientUserId } },
        { consultantProfile: { userId: recipientUserId } }
      ]
    },
    select: { id: true },
    orderBy: { id: "asc" }
  });
  if (allEligibleSplits.map((item) => item.id).join(":") !== splitIds.join(":")) {
    throw new Error("The recipient payout total changed. Refresh the page before sending the grouped payment.");
  }

  const totalCents = payoutItems.reduce((total, { split }) => total + split.amountCents, 0);
  let stripeConnectedAccountId: string | null = null;
  let stripeTransferId: string | null = null;
  let rawEvent: unknown = { method: "cash", note: "Grouped cash payout recorded by a Go Virtual Health administrator. No electronic funds were moved." };
  const batchKey = createHash("sha256").update(splitIds.join(":"), "utf8").digest("hex").slice(0, 32);

  if (paymentMethod === "BANK") {
    const payoutAccount = await syncPayoutAccount({ id: recipientUserId, companyId: user.companyId });
    if (!payoutAccount?.stripeConnectedAccountId || payoutAccount.status !== "READY" || !payoutAccount.transfersEnabled) {
      throw new Error("The recipient must complete tax and bank setup before this grouped payout can be sent.");
    }
    const config = await getCompanyStripeRuntimeConfig(user.companyId);
    if (!config.secretKey) throw new Error("The company payout processor is not configured.");
    const stripe = new Stripe(config.secretKey);
    const transfer = await stripe.transfers.create(
      {
        amount: totalCents,
        currency: "usd",
        destination: payoutAccount.stripeConnectedAccountId,
        transfer_group: `recipient_payout_${batchKey}`,
        metadata: {
          companyId: user.companyId,
          recipientUserId,
          itemCount: String(splitIds.length),
          payoutBatchKey: batchKey,
          source: "grouped_recipient_payout",
          stripeMode: config.mode
        }
      },
      { idempotencyKey: `grouped_recipient_payout_${batchKey}` }
    );
    stripeConnectedAccountId = payoutAccount.stripeConnectedAccountId;
    stripeTransferId = transfer.id;
    rawEvent = transfer;
  }

  const paidAt = new Date();
  await prisma.$transaction(async (tx) => {
    const batch = await tx.payoutBatch.create({
      data: {
        companyId: user.companyId!,
        recipientUserId,
        paymentMethod,
        totalCents,
        itemCount: payoutItems.length,
        stripeConnectedAccountId,
        stripeTransferId,
        status: paymentMethod === "CASH" ? "PAID_CASH" : "TRANSFERRED",
        rawEvent: jsonSafe(rawEvent),
        createdByUserId: user.id,
        paidAt
      }
    });
    await tx.payoutTransfer.createMany({
      data: payoutItems.map(({ split }) => ({
        companyId: split.companyId,
        commissionSplitId: split.id,
        payoutBatchId: batch.id,
        recipientUserId,
        amountCents: split.amountCents,
        paymentMethod,
        stripeConnectedAccountId,
        status: paymentMethod === "CASH" ? "PAID_CASH" : "TRANSFERRED",
        rawEvent: { payoutBatchId: batch.id, payoutBatchKey: batchKey },
        createdByUserId: user.id,
        paidAt
      }))
    });
    const updated = await tx.commissionSplit.updateMany({
      where: { id: { in: splitIds }, status: "APPROVED" },
      data: { status: "PAID", paidAt }
    });
    if (updated.count !== splitIds.length) throw new Error("A payout item changed while the grouped payment was being processed.");
  });

  revalidatePath(returnPath);
  revalidatePath("/partner/payouts");
  revalidatePath("/manager/payouts");
  revalidatePath("/consultant/payouts");
}
