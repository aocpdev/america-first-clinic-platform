import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ status: "Referral click and session attribution endpoint ready" });
}
