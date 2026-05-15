import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClinicLogo } from "@/components/layout/logo";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/82 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <ClinicLogo />
        <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex">
          <Link href="/shop" className="hover:text-clinic-navy">Shop</Link>
          <Link href="/about" className="hover:text-clinic-navy">About</Link>
          <Link href="/c/john-smith" className="hover:text-clinic-navy">Consultant Portal</Link>
          <Link href="/admin/dashboard" className="hover:text-clinic-navy">Admin</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost">Log in</Button>
          </Link>
          <Link href="/register" className="hidden sm:block">
            <Button variant="accent">
              Get started
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
