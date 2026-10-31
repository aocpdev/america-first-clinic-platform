"use client";
import { useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { GVH_LOGO_SRC, GVH_LOGO_WIDTH, GVH_LOGO_HEIGHT } from "@/lib/brand";
import { ArrowUpRight, ChevronDown, UserRound, ShoppingBag } from "lucide-react";

export function StoreNavigation({ base, categories, cartCount }: { base: string; categories: Array<{ id: string; name: string }>; cartCount: number }) {
  const catalog = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname() ?? "";
  const home = base || "/";
  const close = () => { if (catalog.current) catalog.current.open = false; };
  const links = [
    { label: "Weight loss", href: `${base}/weight-loss`, active: pathname.endsWith("/weight-loss") },
    { label: "Catalog", href: `${base}/catalog#catalog`, active: pathname.endsWith("/catalog") },
    { label: "Become an affiliate", href: `${base}/affiliates`, active: pathname.endsWith("/affiliates") }
  ];
  return <header className="rx-glass-header"><div className="rx-glass-bar">
    <Link href={home} aria-label="Go Virtual Health home" className="rx-glass-brand"><Image src={GVH_LOGO_SRC} alt="Go Virtual Health" width={GVH_LOGO_WIDTH} height={GVH_LOGO_HEIGHT} sizes="64px" priority /></Link>
    <nav aria-label="Store navigation" className="rx-glass-links">
      <details ref={catalog} className="rx-shop-menu" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }} onKeyDown={event => { if (event.key === "Escape") { close(); catalog.current?.querySelector("summary")?.focus(); } }}>
        <summary>Explore <ChevronDown size={14} aria-hidden="true" /></summary>
        <div className="rx-shop-panel" onClick={event => { if ((event.target as HTMLElement).closest("a")) close(); }}>
          <div><p className="rx-eyebrow">Find your focus</p><h2>Your next step,<br />made simpler.</h2><Link href={`${base}/catalog#catalog`}>Shop all products <ArrowUpRight size={16} aria-hidden="true" /></Link><Link href={`${base}/telehealth`} aria-current={pathname.endsWith("/telehealth") ? "page" : undefined}>Telehealth · Explore your visit <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
          <div className="rx-shop-categories">{categories.map(category => <Link key={category.id} href={`${base}/catalog?category=${encodeURIComponent(category.id)}#catalog`}>{category.name}<ArrowUpRight size={14} aria-hidden="true" /></Link>)}</div>
        </div>
      </details>
      {links.map(link => <Link key={link.label} href={link.href} aria-label={link.label} aria-current={link.active ? "page" : undefined}>{link.label === "Become an affiliate" ? <><span className="rx-nav-wide-label">{link.label}</span><span className="rx-nav-short-label">Affiliates</span></> : link.label}</Link>)}
    </nav>
    <div className="rx-nav-actions"><Link href={`${base}/cart#cart`} className="rx-nav-cart" aria-label={`Shopping cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}><ShoppingBag size={19} aria-hidden="true" /><span aria-hidden="true">{cartCount > 99 ? "99+" : cartCount}</span></Link><Link href={`${base}/login`} className="rx-glass-login"><UserRound size={16} aria-hidden="true" /><span>Log in</span><ArrowUpRight size={15} className="rx-login-arrow" aria-hidden="true" /></Link></div>
  </div></header>;
}
