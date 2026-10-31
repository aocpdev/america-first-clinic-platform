"use client";

import Image from "next/image";
import { useState } from "react";

export function AffiliateProductImage({ src, alt, title }: { src: string | null; alt: string | null; title: string }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return <div className="relative flex aspect-[4/3] w-full shrink-0 items-center justify-center overflow-hidden bg-slate-50">
    {src && failedSource !== src ? <Image src={src} alt={alt || title} fill sizes="(min-width: 1280px) 360px, (min-width: 768px) 45vw, 90vw" className="object-contain p-6 mix-blend-multiply" onError={() => setFailedSource(src)} />
      : <span className="px-2 text-center text-xs leading-4 text-slate-400">{src ? "Image unavailable" : "No image added"}</span>}
  </div>;
}
