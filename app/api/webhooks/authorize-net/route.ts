import { NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payments/registry";

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("x-anet-signature");
  const verified = await getPaymentProvider("authorize_net").verifyWebhook(payload, signature);

  if (!verified) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  return NextResponse.json({ received: true, provider: "authorize_net" });
}
