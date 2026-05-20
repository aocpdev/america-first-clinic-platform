import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { fallbackOrderPaymentUrl } from "@/lib/payments/short-links";
import type { PaymentProviderCode } from "@/lib/payments/types";

type ShortPaymentOrder = {
  id: string;
  paymentProviderCode: string;
  paymentStatus: string;
  referralMetadata: unknown;
};

function providerPaymentUrl(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const paymentProvider = (metadata as Record<string, unknown>).paymentProvider;
  if (!paymentProvider || typeof paymentProvider !== "object" || Array.isArray(paymentProvider)) return null;

  const value = (paymentProvider as Record<string, unknown>).providerPaymentUrl;
  return typeof value === "string" && value.startsWith("http") ? value : null;
}

function providerCode(value: string): PaymentProviderCode {
  if (value === "stripe" || value === "authorize_net" || value === "nmi" || value === "ach") return value;
  return "stripe";
}

export async function GET(
  _request: Request,
  {
    params
  }: {
    params: Promise<{ code: string }>;
  }
) {
  const { code } = await params;
  const normalizedCode = code.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  if (normalizedCode.length < 6) notFound();

  const orders = await prisma.$queryRaw<ShortPaymentOrder[]>`
    SELECT id::text, "paymentProviderCode", "paymentStatus", "referralMetadata"
    FROM "Order"
    WHERE replace(id::text, '-', '') LIKE ${`${normalizedCode}%`}
    ORDER BY "createdAt" DESC
    LIMIT 2
  `;

  if (orders.length !== 1) notFound();

  const order = orders[0];
  if (order.paymentStatus === "CAPTURED") {
    redirect(`/checkout/success?orderId=${order.id}`);
  }

  redirect(providerPaymentUrl(order.referralMetadata) ?? fallbackOrderPaymentUrl(order.id, providerCode(order.paymentProviderCode)));
}
