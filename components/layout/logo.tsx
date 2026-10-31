import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { GVH_LOGO_SRC, GVH_LOGO_WIDTH, GVH_LOGO_HEIGHT } from "@/lib/brand";

export function ClinicLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-3", className)}>
      <Image
        src={GVH_LOGO_SRC}
        alt="Go Virtual Health logo"
        width={GVH_LOGO_WIDTH}
        height={GVH_LOGO_HEIGHT}
        sizes={compact ? "40px" : "64px"}
        className={compact ? "h-10 w-auto object-contain" : "h-14 w-auto object-contain"}
        priority
      />
    </Link>
  );
}
