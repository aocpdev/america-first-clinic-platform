import { requireRole } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  await requireRole("MANAGER");
  return children;
}
