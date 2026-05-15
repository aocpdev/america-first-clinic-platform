import { LockKeyhole } from "lucide-react";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function CheckoutPage() {
  return (
    <>
      <MarketingHeader />
      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_.9fr] lg:px-8">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <LockKeyhole className="h-5 w-5 text-clinic-red" />
            <h1 className="text-2xl font-semibold text-clinic-ink">Secure checkout</h1>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Input placeholder="First name" />
            <Input placeholder="Last name" />
            <Input className="sm:col-span-2" placeholder="Email address" />
            <Input className="sm:col-span-2" placeholder="Payment token placeholder" />
          </div>
          <p className="mt-4 text-sm text-slate-500">
            Payment details are tokenized by the selected provider. Sensitive keys never ship to the browser.
          </p>
          <Button className="mt-6 w-full" variant="accent">Create order</Button>
        </Card>
        <Card className="h-fit p-6">
          <h2 className="text-lg font-semibold text-clinic-ink">Order summary</h2>
          <div className="mt-5 space-y-3 text-sm text-slate-600">
            <div className="flex justify-between"><span>GLP-1 Support Program</span><span>$799</span></div>
            <div className="flex justify-between"><span>Taxes</span><span>Calculated</span></div>
            <div className="flex justify-between"><span>Payment provider</span><span>NMI ready</span></div>
            <div className="border-t border-border pt-3 font-semibold text-clinic-ink flex justify-between"><span>Total</span><span>$799</span></div>
          </div>
        </Card>
      </main>
    </>
  );
}
