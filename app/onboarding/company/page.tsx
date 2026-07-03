import { MarketingHeader } from "@/components/layout/marketing-header";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export default function CompanyOnboardingPage() {
  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-4xl px-4 py-12">
        <OnboardingFlow
          title="Company onboarding"
          steps={[
            "Company Information",
            "Branding Setup",
            "Product Setup",
            "Commission Setup",
            "Invite Agents",
            "Payment Configuration",
            "Dashboard Ready"
          ]}
        />
      </main>
    </>
  );
}
