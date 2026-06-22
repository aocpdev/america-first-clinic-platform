import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/current-user";
import { parseDashboardDateRange } from "@/lib/dashboard/date-range";
import { prisma } from "@/lib/db/prisma";
import { getReportCsv, type ReportExportType, type ReportInput, type ReportRole } from "@/lib/reports/queries";

function exportType(value: string | null): ReportExportType {
  return value === "products" || value === "team" ? value : "sales";
}

async function reportInputForUser(dateRange: ReturnType<typeof parseDashboardDateRange>): Promise<ReportInput | null> {
  const user = await requireUser();
  if (!user.companyId) return null;

  if (user.role === "COMPANY_ADMIN" || user.role === "SUPER_ADMIN") {
    return { companyId: user.companyId, role: "admin", dateRange };
  }

  if (user.role === "PARTNER") {
    const partnerProfile = user.partnerProfile ?? await prisma.partnerProfile.findUnique({ where: { userId: user.id } });
    return partnerProfile ? { companyId: user.companyId, role: "partner", partnerProfileId: partnerProfile.id, dateRange } : null;
  }

  if (user.role === "MANAGER") {
    const managerProfile = user.managerProfile ?? await prisma.managerProfile.findUnique({ where: { userId: user.id } });
    return managerProfile ? { companyId: user.companyId, role: "manager", managerProfileId: managerProfile.id, dateRange } : null;
  }

  if (user.role === "GROUP_LEADER") {
    const groupLeaderProfile = user.groupLeaderProfile ?? await prisma.groupLeaderProfile.findUnique({ where: { userId: user.id } });
    return groupLeaderProfile ? { companyId: user.companyId, role: "group_leader", groupLeaderProfileId: groupLeaderProfile.id, dateRange } : null;
  }

  if (user.role === "CONSULTANT") {
    if (user.status !== "ACTIVE") return null;
    const consultantProfile = user.consultantProfile ?? await prisma.consultantProfile.findUnique({ where: { userId: user.id } });
    return consultantProfile ? { companyId: user.companyId, role: "consultant", consultantProfileId: consultantProfile.id, dateRange } : null;
  }

  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dateRange = parseDashboardDateRange({
    range: url.searchParams.get("range") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined
  });
  const type = exportType(url.searchParams.get("type"));
  const input = await reportInputForUser(dateRange);

  if (!input) {
    return NextResponse.json({ error: "Reports are not available for this account." }, { status: 403 });
  }

  const csv = await getReportCsv(input, type);
  const fileRole: ReportRole = input.role;
  const filename = `${fileRole}-${type}-report-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`
    }
  });
}
