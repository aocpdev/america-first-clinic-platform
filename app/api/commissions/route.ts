import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ statuses: ["pending", "approved", "rejected", "paid"], engine: "flexible_rules_ready" });
}
