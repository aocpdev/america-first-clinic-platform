import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function ClinicLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-3", className)}>
      <Image
        src={compact ? "/go-virtual-health-emblem.png" : "/go-virtual-health-logo.jpeg"}
        alt="Go Virtual Health logo"
        width={compact ? 38 : 210}
        height={compact ? 38 : 70}
        className={cn(compact ? "rounded-full object-contain" : "h-14 w-auto object-contain")}
        priority
      />
    </Link>
  );
}
