import { Clock3 } from "lucide-react";
import { logoutUser } from "@/app/(auth)/actions";
import { ClinicLogo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function PendingApprovalPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-xl p-6 text-center shadow-soft">
        <div className="flex justify-center">
          <ClinicLogo />
        </div>
        <Clock3 className="mx-auto mt-8 h-12 w-12 text-clinic-red" />
        <h1 className="mt-5 text-3xl font-semibold text-clinic-ink">Agent approval pending</h1>
        <p className="mt-3 text-slate-600">
          Your consultant account was received. A company admin must approve your agent access before
          you can use the consultant CRM, referral links, sales tools, and commission dashboard.
        </p>
        <div className="mt-7 flex justify-center">
          <form action={logoutUser}>
            <Button type="submit" variant="accent">Log out</Button>
          </form>
        </div>
      </Card>
    </main>
  );
}
