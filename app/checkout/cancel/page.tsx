import Link from "next/link";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { Button } from "@/components/ui/button";

export default function CheckoutCancelPage() {
  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-4xl font-semibold text-clinic-ink">Checkout paused</h1>
        <p className="mt-4 text-slate-600">No payment was captured. Your referral attribution can continue in the current session.</p>
        <Link href="/shop"><Button className="mt-8" variant="outline">Return to shop</Button></Link>
      </main>
    </>
  );
}
