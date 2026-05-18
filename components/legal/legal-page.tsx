import { LegalFooter } from "@/components/layout/legal-footer";
import { MarketingHeader } from "@/components/layout/marketing-header";

type LegalSection = {
  title: string;
  body: string;
};

export function LegalPage({
  eyebrow,
  title,
  updated,
  intro,
  sections
}: {
  eyebrow: string;
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-clinic-red">{eyebrow}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal text-clinic-ink">{title}</h1>
        <p className="mt-3 text-sm font-semibold text-slate-500">Last updated: {updated}</p>
        <p className="mt-6 text-lg leading-8 text-slate-600">{intro}</p>
        <div className="mt-10 space-y-7">
          {sections.map((section) => (
            <section key={section.title} className="rounded-2xl border border-border bg-white p-6 shadow-line">
              <h2 className="text-xl font-semibold text-clinic-ink">{section.title}</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">{section.body}</p>
            </section>
          ))}
        </div>
      </main>
      <LegalFooter />
    </>
  );
}
