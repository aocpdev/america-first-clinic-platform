import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "Supabase Auth ready", roles: ["SUPER_ADMIN", "COMPANY_ADMIN", "PARTNER", "MANAGER", "CONSULTANT", "CUSTOMER"] });
}
