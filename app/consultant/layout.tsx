import { requireApprovedConsultant } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export default async function ConsultantLayout({ children }: { children: React.ReactNode }) {
  await requireApprovedConsultant();
  return children;
}
