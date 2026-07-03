import Link from "next/link";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function OnboardingPage() {
  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-semibold text-clinic-ink">Choose onboarding path</h1>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-clinic-ink">Company onboarding</h2>
            <p className="mt-3 text-slate-600">Set up branding, products, commissions, agent invites, and payment configuration.</p>
            <Link href="/onboarding/company"><Button className="mt-6" variant="accent">Start company setup</Button></Link>
          </Card>
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-clinic-ink">Agent onboarding</h2>
            <p className="mt-3 text-slate-600">Create your profile, referral slug, payment placeholder, agreements, and dashboard tutorial.</p>
            <Link href="/onboarding/consultant"><Button className="mt-6">Start agent setup</Button></Link>
          </Card>
        </div>
      </main>
    </>
  );
}
