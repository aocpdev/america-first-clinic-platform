import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { dashboardPathForRole } from "@/lib/auth/redirects";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role === "CONSULTANT" && user.status !== "ACTIVE") {
    redirect("/pending-approval");
  }

  redirect(dashboardPathForRole(user.role));
}
