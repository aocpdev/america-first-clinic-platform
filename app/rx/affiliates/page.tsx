import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Link2, SlidersHorizontal, Users } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { requireRxCompany, rxBasePath } from "@/lib/products/rx-catalog";
import { applicationToken } from "@/lib/referrals/affiliate-application";
import { ApplicationForm } from "./application-form";

export const metadata: Metadata = { title: "Become an affiliate", description: "Connect your community with Go Virtual Health. Explore our affiliate program and apply for review.", alternates: { canonical: "https://rx.govirtualhealth.com/affiliates" } };
const steps = [
  { number: "01", title: "Make the introduction.", copy: "Tell us about yourself and the community you serve. Our team reviews each application." },
  { number: "02", title: "Get your own space.", copy: "After approval and account setup, explore products, see your estimated earnings, and prepare your payout details." },
  { number: "03", title: "Share what connects.", copy: "Use your personal store link or a dedicated product link. The program is designed to recognize your original referrals on repeat purchases." }
];
const faqs = [
  ["Who can apply?", "Creators, gyms, trainers, artists, and people with an engaged community are welcome to apply. Every application is reviewed before access is granted."],
  ["How are commissions calculated?", "Your commission is a percentage of the eligible product margin, not the retail price. The admin manages product costs and program rates. Your account will show your assigned rate and estimated earnings; refunds, adjustments, and approval can affect payable amounts."],
  ["What happens when a customer buys again?", "The planned checkout flow keeps the original referring affiliate or agent attached to the customer. A later referral link does not replace that relationship. Online ordering and paid commission processing are not open in this preview."],
  ["Does applying create my account?", "No. Applications are reviewed first. If approved, account verification and payout setup are separate steps. No bank information is requested on this page."],
  ["What customer information can I access?", "The affiliate workspace is designed for referral and earnings activity, not access to private patient records. Program guidance and approved product information must be followed when promoting products."]
];

export default async function AffiliateLandingPage() {
  const company = await requireRxCompany();
  const base = await rxBasePath();
  // The public shop can launch before the separate affiliate schema is activated.
  const settings = process.env.AFFILIATE_ADMIN_ENABLED === "true"
    ? await prisma.affiliateProgramSetting.findUnique({ where: { companyId: company.id }, select: { commissionBps: true } }) : null;
  const rate = (settings?.commissionBps ?? 2500) / 100;
  const secret = process.env.AFFILIATE_APPLICATION_SECRET ?? "";
  const localPreview = process.env.NODE_ENV !== "production" && !process.env.VERCEL &&
    new URL(process.env.DATABASE_URL ?? "http://invalid").hostname === "127.0.0.1" &&
    new URL(process.env.DATABASE_URL ?? "http://invalid").pathname === "/gvh_affiliate_test";
  const enabled = process.env.AFFILIATE_APPLICATIONS_ENABLED === "true" && secret.length >= 32 &&
    (localPreview || Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY));
  return <>
    <section className="mx-auto max-w-7xl px-4 pb-14 pt-5 sm:px-8 sm:pt-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-[#183d35] px-7 py-12 text-white sm:p-14 lg:p-20">
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 top-12 h-[32rem] w-[32rem] rounded-full border border-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 top-28 h-[24rem] w-[24rem] rounded-full border border-white/10" />
        <div className="relative grid items-end gap-12 lg:grid-cols-[1.5fr_1fr]">
          <div className="rx-enter"><p className="text-[11px] uppercase tracking-[.23em] text-[#bed2c5]">The Go Virtual Health affiliate program</p><h1 className="mt-8 max-w-2xl text-5xl font-medium leading-[1.02] tracking-[-.055em] sm:text-7xl">Your community.<br /><span className="text-[#bed2c5]">New possibilities.</span></h1><p className="mt-7 max-w-md text-base leading-7 text-[#d0dfd6]">Bring your connections to Go Virtual Health. A dedicated place to share products, understand your earnings, and grow a thoughtful partnership.</p><a href="#apply" className="mt-8 inline-flex min-h-14 items-center gap-8 rounded-full bg-[#edf3e9] px-7 text-sm font-medium text-[#183d35]">Let’s work together<ArrowUpRight size={18} aria-hidden="true" /></a><p className="mt-4 text-xs text-[#bed2c5]">Application required. Subject to review and program availability.</p></div>
          <div className="rounded-3xl border border-white/15 bg-white/5 p-7 backdrop-blur-sm"><p className="text-xs uppercase tracking-[.18em] text-[#bed2c5]">Current standard rate</p><p className="mt-5 text-7xl font-medium tracking-[-.06em]">{rate}%</p><p className="mt-3 text-lg text-[#e4ece6]">of eligible product margin</p><div className="my-6 h-px bg-white/15" /><p className="text-sm leading-7 text-[#d0dfd6]">Your assigned rate is confirmed in your account. Product estimates are based on the catalog managed by Go Virtual Health.</p><p className="mt-4 text-xs leading-6 text-[#bed2c5]">Not a percentage of the sale price. Earnings are not guaranteed. Payouts require verified purchases and approval.</p></div>
        </div>
      </div>
      <p className="mt-7 text-center text-xs leading-6 tracking-wide text-slate-500">Creators & influencers <span className="mx-3">/</span> Gyms & trainers <span className="mx-3">/</span> Artists & communities</p>
    </section>
    <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:py-16"><p className="text-xs uppercase tracking-[.18em] text-[#648074]">A clear path forward</p><h2 className="mt-4 text-4xl font-medium tracking-[-.045em] text-[#183d35] sm:text-5xl">From connection to collaboration.</h2><div className="mt-12 grid gap-9 md:grid-cols-3">{steps.map(step => <article key={step.number} className="border-t border-slate-200 pt-6"><p className="text-sm text-[#648074]">{step.number}</p><h3 className="mt-7 text-2xl font-medium tracking-tight">{step.title}</h3><p className="mt-4 max-w-sm text-sm leading-7 text-slate-600">{step.copy}</p></article>)}</div></section>
    <section className="mx-auto grid max-w-7xl gap-6 px-5 py-12 sm:px-8 md:grid-cols-3">{[
      { Icon: Link2, title: "One link. Or one product.", text: "Share the full store or introduce a specific product with your unique referral link." },
      { Icon: SlidersHorizontal, title: "Clarity before you share.", text: "View current products, prices, and estimated earnings from your affiliate workspace." },
      { Icon: Users, title: "A lasting introduction.", text: "The original-referral policy is designed to preserve attribution on repeat purchases, not just the first order." }
    ].map(({ Icon, title, text }) => <article key={title} className="rounded-3xl bg-[#f2f5f2] p-7"><Icon className="h-6 w-6 text-[#456457]" strokeWidth={1.4} aria-hidden="true" /><h3 className="mt-8 text-xl font-medium tracking-tight">{title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{text}</p></article>)}</section>
    <section id="apply" className="mx-auto grid max-w-7xl scroll-mt-24 gap-10 px-5 py-16 sm:px-8 lg:grid-cols-2 lg:gap-24"><div><p className="text-xs uppercase tracking-[.18em] text-[#648074]">Start a conversation</p><h2 className="mt-5 max-w-md text-5xl font-medium leading-[1.05] tracking-[-.05em] text-[#183d35]">Your next partnership starts here.</h2><p className="mt-6 max-w-sm text-base leading-7 text-slate-600">Tell us a little about you. We’ll review your application before any account or program access is provided.</p><Link href={`${base}/catalog#catalog`} className="mt-8 inline-flex min-h-12 items-center gap-3 text-sm font-medium text-[#183d35]">Explore the collection first <ArrowRight size={16} aria-hidden="true" /></Link></div><div className="rounded-3xl border border-slate-200 p-6 sm:p-9"><h3 className="mb-7 text-2xl font-medium tracking-tight">Let’s get acquainted.</h3><ApplicationForm enabled={enabled} token={enabled ? applicationToken(secret, company.id) : ""} siteKey={localPreview ? undefined : process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} /></div></section>
    <section className="mx-auto max-w-3xl px-5 py-12 sm:px-8"><h2 className="mb-8 text-3xl font-medium tracking-tight">A few things worth knowing.</h2>{faqs.map(([question, answer]) => <details key={question} className="group border-b border-slate-200 py-5"><summary className="cursor-pointer text-base font-medium leading-7">{question}</summary><p className="mt-4 text-sm leading-7 text-slate-600">{answer}</p></details>)}</section>
  </>;
}
