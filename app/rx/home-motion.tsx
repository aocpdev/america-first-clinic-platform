"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Progressive enhancement: content is visible without JS or motion support. */
export function HomeMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element || !("IntersectionObserver" in window)) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const targets = Array.from(element.querySelectorAll<HTMLElement>("[data-rx-reveal]"));
    let observer: IntersectionObserver | undefined;
    const stop = () => {
      observer?.disconnect();
      targets.forEach(target => target.classList.remove("rx-reveal-enter"));
    };
    const start = () => {
      stop();
      if (preference.matches) return;
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer?.unobserve(entry.target);
          entry.target.classList.add("rx-reveal-enter");
        }
      }, { threshold: 0.08 });
      // Do not replay on already visible content or on restoration to an anchor.
      targets.filter(target => target.getBoundingClientRect().top >= window.innerHeight)
        .forEach(target => observer?.observe(target));
    };
    const focus = (event: FocusEvent) => {
      const target = event.target instanceof Element ? event.target.closest("[data-rx-reveal]") : null;
      if (target) { observer?.unobserve(target); target.classList.remove("rx-reveal-enter"); }
    };
    start();
    preference.addEventListener("change", start);
    element.addEventListener("focusin", focus);
    return () => { stop(); preference.removeEventListener("change", start); element.removeEventListener("focusin", focus); };
  }, []);
  return <div ref={root} className="rx-home-experience">{children}</div>;
}
