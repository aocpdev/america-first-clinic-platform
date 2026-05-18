import { requirePartner } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  await requirePartner();
  return children;
}
