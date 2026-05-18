import { requireRole } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("COMPANY_ADMIN");
  return children;
}
