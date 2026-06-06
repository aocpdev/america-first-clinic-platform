import { NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payments/registry";
import { publicSiteBaseUrl } from "@/lib/urls";
import { orderSchema } from "@/lib/validations/core";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = orderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order payload", issues: parsed.error.flatten() }, { status: 422 });
  }

  const provider = getPaymentProvider(parsed.data.paymentProviderCode);
  const publicUrl = publicSiteBaseUrl();
  const result = await provider.createCheckoutSession({
    companyId: "company_pending_context",
    customerId: parsed.data.customerId,
    orderId: "order_pending_database_write",
    successUrl: `${publicUrl}/checkout/success`,
    cancelUrl: `${publicUrl}/checkout/cancel`,
    lineItems: [],
    metadata: {
      consultantProfileId: parsed.data.consultantProfileId ?? "",
      architecture: "payment_provider_agnostic"
    }
  });

  return NextResponse.json({ checkout: result });
}
