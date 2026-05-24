import Link from "next/link";

const legalLinks = [
  { href: "/terms-of-service", label: "Terms" },
  { href: "/privacy-policy", label: "Privacy" },
  { href: "/refund-policy", label: "Refunds" },
  { href: "/shipping-policy", label: "Shipping" },
  { href: "/medical-disclaimer", label: "Medical Disclaimer" }
];

export function LegalFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer className={compact ? "mt-6 text-center" : "border-t border-border bg-white"}>
      <div className={compact ? "" : "mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"}>
        <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-500">
          {legalLinks.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-clinic-navy">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
