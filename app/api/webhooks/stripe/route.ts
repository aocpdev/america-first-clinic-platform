import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db/prisma";
import { StripeProvider } from "@/lib/payments/providers/stripe-provider";
import { phoneForWebhook } from "@/lib/phone";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

async function saveStripePaymentMethod(paymentIntent: Stripe.PaymentIntent) {
  if (!paymentIntent.customer || !paymentIntent.payment_method || typeof paymentIntent.payment_method !== "string") return;
  const customerId = paymentIntent.metadata.customerId;
  const companyId = paymentIntent.metadata.companyId;
  if (!customerId || !companyId || !process.env.STRIPE_SECRET_KEY) return;

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const paymentMethod = await stripe.paymentMethods.retrieve(paymentIntent.payment_method);
  const card = paymentMethod.card;
  if (!card) return;

  await prisma.paymentMethod.upsert({
    where: {
      companyId_providerCode_providerPaymentMethodId: {
        companyId,
        providerCode: "stripe",
        providerPaymentMethodId: paymentMethod.id
      }
    },
    create: {
      companyId,
      customerId,
      providerCode: "stripe",
      providerCustomerId: typeof paymentIntent.customer === "string" ? paymentIntent.customer : paymentIntent.customer.id,
      providerPaymentMethodId: paymentMethod.id,
      type: paymentMethod.type,
      brand: card.brand,
      last4: card.last4,
      expMonth: card.exp_month,
      expYear: card.exp_year,
      isDefault: true
    },
    update: {
      providerCustomerId: typeof paymentIntent.customer === "string" ? paymentIntent.customer : paymentIntent.customer.id,
      brand: card.brand,
      last4: card.last4,
      expMonth: card.exp_month,
      expYear: card.exp_year,
      status: "ACTIVE"
    }
  });
}

async function markOrderCaptured(orderId: string, providerTransactionId: string | null, eventType: string, rawEvent: unknown) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      consultantProfile: true
    }
  });

  if (!order) return;
  const wasCaptured = order.paymentStatus === "CAPTURED";

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "CAPTURED",
        orderStatus: "PROCESSING",
        orderPipelineStage: "GFE",
        orderPipelineUpdatedAt: new Date(),
        commissionStatus: "PENDING"
      }
    }),
    prisma.paymentTransaction.create({
      data: {
        companyId: order.companyId,
        orderId: order.id,
        providerCode: "stripe",
        providerTransactionId,
        amountCents: order.totalCents,
        status: "CAPTURED",
        eventType,
        rawEvent: jsonSafe(rawEvent)
      }
    }),
    ...(wasCaptured
      ? []
      : [
          prisma.customer.update({
            where: { id: order.customerId },
            data: {
              lifetimeValueCents: { increment: order.totalCents },
              lastPurchaseAt: new Date(),
              pipelineStage: "GFE",
              pipelineUpdatedAt: new Date()
            }
          })
        ])
  ]);

  const payload = {
    provider: "stripe",
    providerTransactionId,
    orderId: order.id,
    customerId: order.customerId,
    customerEmail: order.customer.email,
    customerPhone: phoneForWebhook(order.customer.phone),
    customerName: [order.customer.firstName, order.customer.lastName].filter(Boolean).join(" ").trim() || order.customer.email,
    amountCents: order.totalCents,
    currency: "USD",
    receiptUrl: `${(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "")}/checkout/success?orderId=${order.id}`
  };

  await dispatchWebhookEvent({
    companyId: order.companyId,
    partnerProfileId: order.partnerProfileId ?? order.consultantProfile?.partnerProfileId,
    eventType: "payment.succeeded",
    payload
  });
  await dispatchWebhookEvent({
    companyId: order.companyId,
    partnerProfileId: order.partnerProfileId ?? order.consultantProfile?.partnerProfileId,
    eventType: "receipt.ready",
    payload
  });
}

async function markOrderFailed(orderId: string, providerTransactionId: string | null, eventType: string, rawEvent: unknown) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true, consultantProfile: true }
  });
  if (!order) return;

  await prisma.order.update({
    where: { id: order.id },
    data: { paymentStatus: "FAILED" }
  });
  await prisma.paymentTransaction.create({
    data: {
      companyId: order.companyId,
      orderId: order.id,
      providerCode: "stripe",
      providerTransactionId,
      amountCents: order.totalCents,
      status: "FAILED",
      eventType,
      rawEvent: jsonSafe(rawEvent)
    }
  });

  await dispatchWebhookEvent({
    companyId: order.companyId,
    partnerProfileId: order.partnerProfileId ?? order.consultantProfile?.partnerProfileId,
    eventType: "payment.failed",
    payload: {
      provider: "stripe",
      providerTransactionId,
      orderId: order.id,
      customerId: order.customerId,
      customerEmail: order.customer.email,
      customerPhone: phoneForWebhook(order.customer.phone),
      amountCents: order.totalCents,
      currency: "USD"
    }
  });
}

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  const event = new StripeProvider().constructWebhookEvent(payload, signature);

  if (!event) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    if (orderId) {
      await markOrderCaptured(orderId, typeof session.payment_intent === "string" ? session.payment_intent : null, event.type, event);
    }
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const orderId = paymentIntent.metadata.orderId;
    if (orderId) {
      await saveStripePaymentMethod(paymentIntent);
      await markOrderCaptured(orderId, paymentIntent.id, event.type, event);
    }
  }

  if (event.type === "payment_intent.payment_failed") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const orderId = paymentIntent.metadata.orderId;
    if (orderId) {
      await markOrderFailed(orderId, paymentIntent.id, event.type, event);
    }
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
    const transaction = paymentIntentId
      ? await prisma.paymentTransaction.findFirst({
          where: { providerCode: "stripe", providerTransactionId: paymentIntentId },
          include: { order: true }
        })
      : null;

    if (transaction?.order) {
      await prisma.order.update({
        where: { id: transaction.orderId },
        data: {
          paymentStatus: "REFUNDED",
          orderStatus: "REFUNDED",
          orderPipelineStage: "DEFERRED",
          orderPipelineUpdatedAt: new Date(),
          commissionStatus: "REJECTED"
        }
      });
      await prisma.commission.updateMany({
        where: { orderId: transaction.orderId },
        data: { status: "REJECTED" }
      });
      await prisma.commissionSplit.updateMany({
        where: { orderId: transaction.orderId },
        data: { status: "REJECTED" }
      });
      await prisma.paymentTransaction.create({
        data: {
          companyId: transaction.companyId,
          orderId: transaction.orderId,
          providerCode: "stripe",
          providerTransactionId: charge.id,
          amountCents: charge.amount_refunded,
          status: "REFUNDED",
          eventType: event.type,
          rawEvent: jsonSafe(event)
        }
      });
    }
  }

  return NextResponse.json({ received: true, provider: "stripe", event: event.type });
}
