import { NextResponse } from "next/server";
import { listPaymentProviders } from "@/lib/payments/registry";

export async function GET() {
  return NextResponse.json({
    providers: listPaymentProviders().map((code) => ({
      code,
      active: false,
      configurable: true
    }))
  });
}
