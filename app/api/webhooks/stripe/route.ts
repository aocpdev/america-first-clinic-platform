import { NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payments/registry";

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  const verified = await getPaymentProvider("stripe").verifyWebhook(payload, signature);

  if (!verified) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  return NextResponse.json({ received: true, provider: "stripe" });
}
