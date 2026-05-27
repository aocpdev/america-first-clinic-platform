"use client";

import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

const LAST_PATH_KEY = "afc:last-path";

function fallbackForPath(pathname: string) {
  const [, workspace] = pathname.split("/");
  const base = workspace ? `/${workspace}` : "";

  if (!base) return "/";
  if (pathname === `${base}/dashboard`) return null;
  if (pathname.startsWith(`${base}/orders/`)) return `${base}/orders`;
  if (pathname.startsWith(`${base}/customers/`)) return `${base}/customers`;

  return `${base}/dashboard`;
}

export function BackNavigator() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const [previousPath, setPreviousPath] = useState<string | null>(null);
  const currentPath = useMemo(() => {
    const query = searchParams?.toString() ?? "";
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);
  const fallback = fallbackForPath(pathname);

  useEffect(() => {
    const lastPath = window.sessionStorage.getItem(LAST_PATH_KEY);

    if (lastPath && lastPath !== currentPath && lastPath.startsWith("/")) {
      setPreviousPath(lastPath);
    } else {
      setPreviousPath(null);
    }

    window.sessionStorage.setItem(LAST_PATH_KEY, currentPath);
  }, [currentPath]);

  if (!fallback) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-10 rounded-2xl border-border bg-white/90 px-3 text-clinic-navy shadow-[0_8px_22px_rgba(7,55,99,0.08)] hover:bg-clinic-mist sm:px-4"
      onClick={() => router.push(previousPath ?? fallback)}
      aria-label="Go back"
    >
      <ArrowLeft className="h-4 w-4" />
      <span className="hidden sm:inline">Back</span>
    </Button>
  );
}
