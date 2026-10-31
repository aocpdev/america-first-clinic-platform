import { ClinicLogo } from "@/components/layout/logo";
import { requireAffiliateSession } from "@/lib/referrals/affiliate-session";
import { signOutAffiliate } from "../login/actions";
import { AffiliateNavigation } from "./navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Affiliates · Go Virtual Health", robots: { index: false, follow: false } };

export default async function AffiliateWorkspaceLayout({ children }: { children: React.ReactNode }) {
  await requireAffiliateSession();
  return <div className="min-h-screen bg-slate-50">
    <a href="#affiliate-main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-4">Skip to content</a>
    <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5"><ClinicLogo />
      <form action={signOutAffiliate}><button className="min-h-11 rounded-lg px-3 text-sm font-medium text-slate-500 hover:bg-slate-50">Sign out</button></form></div></header>
    <AffiliateNavigation />
    <main id="affiliate-main" className="mx-auto max-w-6xl px-5 py-8 sm:py-12" data-clarity-mask="true">{children}</main>
  </div>;
}
