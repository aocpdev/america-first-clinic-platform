import Stripe from "stripe";
import { prisma } from "@/lib/db/prisma";
import { stripeRuntimeConfigForEvent } from "@/lib/payments/stripe-config";

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

function agencyFeeAmount(sourceAmountCents: number, feeBps: number) {
  return Math.max(0, Math.round((sourceAmountCents * feeBps) / 10000));
}

function transferGroup(orderId: string) {
  return `order_${orderId}`;
}

async function stripeClient(livemode?: boolean, metadataMode?: string | null) {
  const config = stripeRuntimeConfigForEvent(livemode, metadataMode);
  return {
    config,
    stripe: config.secretKey ? new Stripe(config.secretKey) : null
  };
}

async function chargeIdForPaymentIntent(stripe: Stripe, paymentIntentId: string | null, explicitChargeId?: string | null) {
  if (explicitChargeId) return explicitChargeId;
  if (!paymentIntentId) return null;

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"]
  });
  const charge = paymentIntent.latest_charge;
  if (!charge) return null;
  return typeof charge === "string" ? charge : charge.id;
}

export async function processAgencyFeeTransfer({
  orderId,
  paymentIntentId,
  chargeId,
  livemode,
  metadataMode,
  rawEvent
}: {
  orderId: string;
  paymentIntentId: string | null;
  chargeId?: string | null;
  livemode?: boolean;
  metadataMode?: string | null;
  rawEvent: unknown;
}) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;

  const setting = await prisma.agencyFeeSetting.findUnique({ where: { companyId: order.companyId } });
  if (!setting?.isEnabled || !setting.stripeConnectedAccountId) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        agencyFeeCents: 0,
        agencyFeeBps: setting?.feeBps ?? 0,
        agencyFeeStatus: setting?.isEnabled ? "CONFIGURATION_REQUIRED" : "NOT_APPLICABLE"
      }
    });
    return;
  }

  const sourceAmountCents = order.grossMarginCents;
  const amountCents = agencyFeeAmount(sourceAmountCents, setting.feeBps);
  if (amountCents <= 0) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        agencyFeeCents: 0,
        agencyFeeBps: setting.feeBps,
        agencyFeeStatus: "NOT_APPLICABLE"
      }
    });
    return;
  }

  const existing = await prisma.agencyFeeTransaction.findFirst({
    where: {
      orderId: order.id,
      type: "TRANSFER",
      status: { in: ["TRANSFERRED", "PENDING", "PAID_MANUAL"] }
    },
    orderBy: { createdAt: "desc" }
  });
  if (existing) return;

  const { stripe, config } = await stripeClient(livemode, metadataMode);
  if (!stripe) {
    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: {
          agencyFeeCents: amountCents,
          agencyFeeBps: setting.feeBps,
          agencyFeeStatus: "CONFIGURATION_REQUIRED"
        }
      }),
      prisma.agencyFeeTransaction.create({
        data: {
          companyId: order.companyId,
          orderId: order.id,
          type: "TRANSFER",
          amountCents,
          feeBps: setting.feeBps,
          basis: setting.basis,
          sourceAmountCents,
          status: "CONFIGURATION_REQUIRED",
          rawEvent: jsonSafe({ reason: "stripe_secret_missing", mode: config.mode })
        }
      })
    ]);
    return;
  }

  const sourceChargeId = await chargeIdForPaymentIntent(stripe, paymentIntentId, chargeId);
  const transfer = await stripe.transfers.create(
    {
      amount: amountCents,
      currency: "usd",
      destination: setting.stripeConnectedAccountId,
      transfer_group: transferGroup(order.id),
      ...(sourceChargeId ? { source_transaction: sourceChargeId } : {}),
      metadata: {
        companyId: order.companyId,
        orderId: order.id,
        paymentIntentId: paymentIntentId ?? "",
        source: "agency_fee",
        feeBps: String(setting.feeBps),
        stripeMode: config.mode
      }
    },
    {
      idempotencyKey: `agency_fee_transfer_${order.id}`
    }
  );

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        agencyFeeCents: amountCents,
        agencyFeeBps: setting.feeBps,
        agencyFeeStatus: "TRANSFERRED",
        agencyFeeTransferId: transfer.id
      }
    }),
    prisma.agencyFeeTransaction.create({
      data: {
        companyId: order.companyId,
        orderId: order.id,
        type: "TRANSFER",
        amountCents,
        feeBps: setting.feeBps,
        basis: setting.basis,
        sourceAmountCents,
        stripeTransferId: transfer.id,
        status: "TRANSFERRED",
        rawEvent: jsonSafe({ transfer, sourceEvent: rawEvent })
      }
    })
  ]);
}

export async function processAgencyFeeReversal({
  orderId,
  refundedAmountCents,
  livemode,
  metadataMode,
  rawEvent
}: {
  orderId: string;
  refundedAmountCents: number;
  livemode?: boolean;
  metadataMode?: string | null;
  rawEvent: unknown;
}) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order?.agencyFeeTransferId || order.agencyFeeCents <= 0 || order.totalCents <= 0) return;

  const transfer = await prisma.agencyFeeTransaction.findFirst({
    where: { orderId, type: "TRANSFER", status: "TRANSFERRED", stripeTransferId: order.agencyFeeTransferId },
    orderBy: { createdAt: "desc" }
  });
  if (!transfer?.stripeTransferId) return;

  const reversedSoFar = await prisma.agencyFeeTransaction.aggregate({
    where: { orderId, type: "REVERSAL", status: "REVERSED" },
    _sum: { amountCents: true }
  });
  const targetReversalCents = Math.min(order.agencyFeeCents, Math.round((order.agencyFeeCents * refundedAmountCents) / order.totalCents));
  const reversalAmountCents = Math.max(0, targetReversalCents - (reversedSoFar._sum.amountCents ?? 0));
  if (reversalAmountCents <= 0) return;

  const { stripe, config } = await stripeClient(livemode, metadataMode);
  if (!stripe) {
    await prisma.agencyFeeTransaction.create({
      data: {
        companyId: order.companyId,
        orderId: order.id,
        type: "REVERSAL",
        amountCents: reversalAmountCents,
        feeBps: order.agencyFeeBps,
        basis: "GROSS_MARGIN",
        sourceAmountCents: order.grossMarginCents,
        stripeTransferId: transfer.stripeTransferId,
        status: "CONFIGURATION_REQUIRED",
        rawEvent: jsonSafe({ reason: "stripe_secret_missing", mode: config.mode, sourceEvent: rawEvent })
      }
    });
    return;
  }

  const reversal = await stripe.transfers.createReversal(
    transfer.stripeTransferId,
    {
      amount: reversalAmountCents,
      metadata: {
        companyId: order.companyId,
        orderId: order.id,
        source: "agency_fee_refund_reversal",
        stripeMode: config.mode
      }
    },
    {
      idempotencyKey: `agency_fee_reversal_${order.id}_${targetReversalCents}`
    }
  );

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        agencyFeeStatus: targetReversalCents >= order.agencyFeeCents ? "REVERSED" : "PARTIALLY_REVERSED",
        agencyFeeReversalId: reversal.id
      }
    }),
    prisma.agencyFeeTransaction.create({
      data: {
        companyId: order.companyId,
        orderId: order.id,
        type: "REVERSAL",
        amountCents: reversalAmountCents,
        feeBps: order.agencyFeeBps,
        basis: transfer.basis,
        sourceAmountCents: order.grossMarginCents,
        stripeTransferId: transfer.stripeTransferId,
        stripeReversalId: reversal.id,
        status: "REVERSED",
        rawEvent: jsonSafe({ reversal, sourceEvent: rawEvent })
      }
    })
  ]);
}
