import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";

export function StoreHero({ base }: { base: string }) {
  return <section className="rx-home-hero" aria-labelledby="rx-home-heading">
    <div className="rx-home-hero-shell">
      <div className="rx-home-copy rx-enter">
        <p className="rx-home-eyebrow">Wellness, on your terms</p>
        <h1 id="rx-home-heading">Your next chapter.<br /><span>Starts with you.</span></h1>
        <p className="rx-home-intro">A little more you. Explore products and programs for your goals, your routine, and whatever comes next.</p>
        <div className="rx-home-actions"><a href="#categories" className="rx-home-primary">Find your focus <ArrowRight size={18} aria-hidden="true" /></a><Link href={`${base}/catalog#catalog`} className="rx-home-secondary">Shop the collection <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
        <p className="rx-home-preview">Explore today. Online ordering is coming soon.</p>
      </div>
      <div className="rx-home-photo">
        <Image src="/rx/wellness/hero-v1.webp" alt="A woman enjoying a quiet, sunlit moment at home" fill priority sizes="(max-width: 760px) 100vw, 50vw" />
        <div className="rx-home-photo-caption"><span>A fresh perspective.</span><p>More possibilities.<br />At your pace.</p></div>
      </div>
    </div>
    <div className="rx-home-reassurance"><span>Explore by your goals</span><span>Clear product details</span><span>Current catalog pricing</span></div>
  </section>;
}
