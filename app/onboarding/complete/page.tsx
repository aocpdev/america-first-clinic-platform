import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { Button } from "@/components/ui/button";

export default function OnboardingCompletePage() {
  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
        <h1 className="mt-5 text-4xl font-semibold text-clinic-ink">Your workspace is ready</h1>
        <p className="mt-4 text-slate-600">Onboarding progress is prepared for persistence, reminders, and role-based completion checks.</p>
        <Link href="/consultant/dashboard"><Button className="mt-8" variant="accent">Go to dashboard</Button></Link>
      </main>
    </>
  );
}
