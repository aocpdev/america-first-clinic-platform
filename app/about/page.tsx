import { MarketingHeader } from "@/components/layout/marketing-header";
import { Card } from "@/components/ui/card";

export default function AboutPage() {
  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-clinic-red">About the platform</p>
        <h1 className="mt-3 text-4xl font-semibold text-clinic-ink">A CRM commerce operating system for healthcare and wellness growth.</h1>
        <p className="mt-5 text-lg leading-8 text-slate-600">
          America First Clinic is designed around consultant-led sales, customer care, compliant operational
          workflows, and processor flexibility. The application keeps orders, subscriptions, commissions,
          customers, and reporting independent from the payment processor.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {["Multi-tenant ready", "Healthcare payment prepared", "Commission-first CRM"].map((item) => (
            <Card key={item} className="p-5 text-sm font-semibold text-clinic-ink">{item}</Card>
          ))}
        </div>
      </main>
    </>
  );
}
