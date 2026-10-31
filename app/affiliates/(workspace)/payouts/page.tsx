import Stripe from "stripe";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { prisma } from "@/lib/db/prisma";
import { requireAffiliateSession } from "@/lib/referrals/affiliate-session";
import { getAffiliatePayoutRecipient } from "@/lib/referrals/affiliate-payout-recipient";
import { getCompanyStripeRuntimeConfig } from "@/lib/payments/stripe-config";
import { startAffiliatePayoutSetup } from "./actions";

export default async function AffiliatePayoutsPage({ searchParams }: { searchParams: Promise<{ error?: string; setup?: string }> }) {
  const affiliate = await requireAffiliateSession();
  const params = await searchParams;
  const enabled = process.env.AFFILIATE_PAYOUT_SETUP_ENABLED === "true";
  const user = await getAffiliatePayoutRecipient(affiliate);
  const stored = user ? await prisma.payoutAccount.findFirst({ where: { userId: user.id, companyId: affiliate.companyId } }) : null;
  let verified = false;
  let ready = false;
  let bank: string | null = null;
  if (enabled && stored?.stripeConnectedAccountId) {
    try {
      const config = await getCompanyStripeRuntimeConfig(affiliate.companyId);
      if (config.secretKey) {
        const account = await new Stripe(config.secretKey).accounts.retrieve(stored.stripeConnectedAccountId);
        verified = true;
        ready = account.details_submitted && account.payouts_enabled && account.capabilities?.transfers === "active" &&
          !(account.requirements?.currently_due?.length) && !(account.requirements?.past_due?.length);
        const destination = account.external_accounts?.data.find(item => item.object === "bank_account") as Stripe.BankAccount | undefined;
        bank = destination ? `${destination.bank_name || "Bank account"} •••• ${destination.last4}` : null;
      }
    } catch { /* Never present a stale stored status as verified readiness. */ }
  }
  return <div className="max-w-3xl space-y-6"><div><h1 className="text-3xl font-semibold tracking-tight text-clinic-navy">Payouts</h1>
    <p className="mt-3 text-sm leading-6 text-slate-500">Set up the account where Go Virtual Health can send your approved earnings.</p></div>
    {(params.error || (enabled && stored && !verified)) && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">We could not verify your payment profile. Try again or contact your program administrator.</p>}
    <Card className="rounded-2xl p-6 sm:p-8"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold text-clinic-navy">Payment profile</h2>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">{!enabled ? "Launch preparation" : ready ? "Ready to receive payments" : stored ? "Action required" : "Not started"}</span></div>
      <p className="mt-4 text-sm leading-6 text-slate-600">Complete identity verification and add your bank destination through our secure payment processor. You do not need to open a separate Stripe business account; a connected payment profile is created for you.</p>
      {bank && <p className="mt-4 text-sm font-medium">{bank}</p>}
      <ol className="mt-6 space-y-3 text-sm text-slate-600"><li>1. Verify your legal identity.</li><li>2. Add your bank destination.</li><li>3. Complete any information required by the processor.</li></ol>
      <p className="mt-6 border-t pt-5 text-xs leading-5 text-slate-500">Full bank and taxpayer numbers are not stored in this application. Payment setup is not confirmation of W-9 certification or 1099 filing. Go Virtual Health remains responsible for its tax reporting.</p>
      {enabled && user ? <form action={startAffiliatePayoutSetup} className="mt-6"><SubmitButton pendingText="Opening secure setup…">{stored ? "Manage payment setup" : "Start secure setup"}</SubmitButton></form> : <p className="mt-6 rounded-xl bg-blue-50 p-4 text-sm leading-6 text-clinic-navy">Secure registration is not activated in this preview. Do not enter real bank or tax information here.</p>}
    </Card><p className="text-xs leading-5 text-slate-500">Setup does not send money. Affiliate earnings and payment history will appear after referral purchases and the commission ledger are activated.</p>
  </div>;
}
