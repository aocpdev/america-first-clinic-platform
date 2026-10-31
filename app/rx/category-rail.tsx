"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { rxCarouselMetrics } from "@/lib/products/rx-carousel";

type Category = { id: string; name: string; _count: { products: number } };

// Editorial imagery only. Category names, IDs and availability are owned by Admin.
const imagery: Record<string, string> = {
  "Clinical Services": "clinical",
  "Cognitive & Mitochondria": "focus",
  "Detox & Immune Support": "balance",
  "Hair Restoration & Skin": "hair",
  "Peptides & Longevity": "longevity",
  "Weight Loss": "hero",
  "Weight Loss (GLP-1 & Metabolic)": "movement"
};

export function CategoryRail({ categories, base }: { categories: Category[]; base: string }) {
  const rail = useRef<HTMLUListElement>(null);
  const [position, setPosition] = useState({ start: 1, end: Math.min(4, categories.length), ...rxCarouselMetrics(4, categories.length, 0) });
  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      const visible = Array.from(element.children).flatMap((child, index) => {
        const rect = child.getBoundingClientRect();
        return rect.right > bounds.left + 8 && rect.left < bounds.right - 8 ? [index + 1] : [];
      });
      const next = { start: visible[0] ?? 1, end: visible.at(-1) ?? 1, ...rxCarouselMetrics(element.clientWidth, element.scrollWidth, element.scrollLeft) };
      setPosition(current => current.start === next.start && current.end === next.end && current.previous === next.previous && current.next === next.next && current.thumbLeft === next.thumbLeft && current.thumbWidth === next.thumbWidth && current.progress === next.progress ? current : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.addEventListener("scroll", measure, { passive: true });
    return () => { observer.disconnect(); element.removeEventListener("scroll", measure); };
  }, [categories]);
  const move = (direction: number) => {
    const element = rail.current;
    if (!element) return;
    const cards = Array.from(element.children);
    const first = cards[0]?.getBoundingClientRect();
    const second = cards[1]?.getBoundingClientRect();
    const step = first && second ? second.left - first.left : element.clientWidth;
    element.scrollBy({ left: direction * step, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };
  if (!categories.length) return null;
  return <section id="categories" className="rx-focus-section" aria-labelledby="rx-focus-heading" aria-roledescription="carousel">
    <div className="rx-focus-heading" data-rx-reveal><div><p className="rx-home-eyebrow">Discover your possibilities</p><h2 id="rx-focus-heading">Find your focus.</h2></div><Link href={`${base}/catalog#catalog`}>Explore all products <ArrowUpRight size={17} aria-hidden="true" /></Link></div>
    <ul ref={rail} id="rx-category-rail" className="rx-focus-rail" aria-label="Product categories" tabIndex={0} onKeyDown={event => {
      if (event.target !== event.currentTarget) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1); }
      if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        event.currentTarget.scrollTo({ left: event.key === "Home" ? 0 : event.currentTarget.scrollWidth, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      }
    }}>
      {categories.map(category => <li key={category.id}><Link href={`${base}/catalog?category=${encodeURIComponent(category.id)}#catalog`} className="rx-focus-card">
        <div className="rx-focus-image"><Image src={`/rx/wellness/${imagery[category.name] ?? "balance"}-v1.webp`} alt="" fill sizes="(max-width: 540px) 76vw, (max-width: 850px) 45vw, 300px" /><span aria-hidden="true"><ArrowUpRight size={18} /></span></div>
        <div className="rx-focus-caption"><h3>{category.name}</h3><p>{category._count.products} {category._count.products === 1 ? "product" : "products"}</p></div>
      </Link></li>)}
    </ul>
    <div className="rx-focus-controls">
      <p className="sr-only" aria-live="polite" aria-atomic="true">Showing categories {position.start}–{position.end} of {categories.length}</p>
      <div className="rx-focus-position" role="meter" aria-label="Category carousel position" aria-valuemin={0} aria-valuemax={100} aria-valuenow={position.progress} aria-valuetext={`Showing categories ${position.start} through ${position.end} of ${categories.length}`}>
        <span className="rx-focus-track"><span style={{ width: `${position.thumbWidth}%`, left: `${position.thumbLeft}%` }} /></span>
      </div>
      <button type="button" onClick={() => move(-1)} disabled={!position.previous} aria-label="Previous categories" aria-controls="rx-category-rail"><ArrowLeft size={23} strokeWidth={1.8} aria-hidden="true" /></button>
      <button type="button" onClick={() => move(1)} disabled={!position.next} aria-label="Next categories" aria-controls="rx-category-rail"><ArrowRight size={23} strokeWidth={1.8} aria-hidden="true" /></button>
    </div>
  </section>;
}
