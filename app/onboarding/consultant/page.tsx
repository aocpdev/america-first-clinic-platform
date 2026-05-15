import { MarketingHeader } from "@/components/layout/marketing-header";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export default function ConsultantOnboardingPage() {
  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-4xl px-4 py-12">
        <OnboardingFlow
          title="Consultant onboarding"
          steps={[
            "Personal Information",
            "Contact Information",
            "Create Referral Slug",
            "Tax and Payment Setup Placeholder",
            "Terms and Agreements",
            "Quick Dashboard Tutorial",
            "Ready to Sell"
          ]}
        />
      </main>
    </>
  );
}
