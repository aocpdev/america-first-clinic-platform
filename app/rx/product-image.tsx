"use client";

import Image from "next/image";
import { useState } from "react";
import { affiliateProductImageSource } from "@/lib/referrals/affiliate-links";

export function RxProductImage({ src, alt, title, priority = false }: { src?: string; alt?: string | null; title: string; priority?: boolean }) {
  const safeSource = affiliateProductImageSource(src);
  const [failed, setFailed] = useState<string | null>(null);
  return <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-clinic-mist">
    {safeSource && failed !== safeSource ? <Image src={safeSource} alt={alt || title} fill priority={priority}
      sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw" className="object-contain p-5" onError={() => setFailed(safeSource)} />
      : <div className="px-6 text-center"><span className="mx-auto mb-3 block h-10 w-10 rounded-2xl border border-blue-100 bg-white" aria-hidden="true" /><p className="text-xs text-slate-400">{safeSource ? "Image unavailable" : "Product image coming soon"}</p></div>}
  </div>;
}
