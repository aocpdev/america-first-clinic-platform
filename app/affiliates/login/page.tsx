import { redirect } from "next/navigation";
import { ClinicLogo } from "@/components/layout/logo";
import { getAffiliateSession, requireAffiliatePortalEnabled } from "@/lib/referrals/affiliate-session";
import { AffiliateLoginForm } from "./form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Affiliate sign in · Go Virtual Health", robots: { index: false, follow: false } };

export default async function AffiliateLoginPage() {
  requireAffiliatePortalEnabled();
  if (await getAffiliateSession()) redirect("/affiliates");
  return <main className="flex min-h-screen items-center justify-center bg-clinic-mist px-5 py-12">
    <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
      <ClinicLogo /><p className="mt-8 text-xs font-semibold uppercase tracking-widest text-slate-500">Affiliate workspace</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-clinic-navy">Welcome back</h1>
      <p className="mb-8 mt-3 text-sm leading-6 text-slate-500">Sign in with the verified account connected to your approved affiliate profile.</p>
      <AffiliateLoginForm />
      <p className="mt-7 border-t pt-5 text-xs leading-5 text-slate-500">Need access? Contact your Go Virtual Health program administrator. Affiliate access does not include the patient CRM.</p>
    </section>
  </main>;
}
