import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { Button } from "@/components/ui/button";

export default function CheckoutSuccessPage() {
  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
        <h1 className="mt-5 text-4xl font-semibold text-clinic-ink">Order confirmed</h1>
        <p className="mt-4 text-slate-600">The order, payment event, attribution, and commission are ready for server-side processing.</p>
        <Link href="/shop"><Button className="mt-8">Continue shopping</Button></Link>
      </main>
    </>
  );
}
