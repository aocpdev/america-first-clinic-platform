import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function ClinicLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-3", className)}>
      <Image
        src="/america-first-clinic-logo.jpeg"
        alt="America First Clinic logo"
        width={compact ? 38 : 46}
        height={compact ? 38 : 46}
        className="rounded-lg object-cover"
        priority
      />
      {!compact && (
        <div className="leading-tight">
          <p className="font-display text-xl font-semibold tracking-normal text-clinic-navy">America First Clinic</p>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-clinic-red">Sales CRM</p>
        </div>
      )}
    </Link>
  );
}
