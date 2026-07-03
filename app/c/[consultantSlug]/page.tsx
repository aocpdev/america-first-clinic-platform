import Link from "next/link";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function ConsultantStorefront({ params }: { params: Promise<{ consultantSlug: string }> }) {
  const { consultantSlug } = await params;
  const name = consultantSlug.split("-").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");

  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <Card className="overflow-hidden p-8 shadow-soft">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-clinic-red">Agent storefront</p>
          <h1 className="mt-4 text-4xl font-semibold text-clinic-ink">{name}'s wellness recommendations</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            Purchases from this page are attributed to the consultant through referral slug, cookies,
            checkout metadata, and recurring customer attribution.
          </p>
          <Link href="/shop?ref=JOHN123">
            <Button className="mt-8" variant="accent">Shop with referral code</Button>
          </Link>
        </Card>
      </main>
    </>
  );
}
