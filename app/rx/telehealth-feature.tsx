import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Video } from "lucide-react";

export function TelehealthFeature({ base }: { base: string }) {
  return <section id="telehealth" className="rx-telehealth-feature" aria-labelledby="rx-telehealth-feature-title">
    <div className="rx-telehealth-feature-shell">
      <div className="rx-telehealth-feature-copy" data-rx-reveal>
        <span className="rx-telehealth-service-label"><Video size={17} aria-hidden="true" />Telehealth</span>
        <h2 id="rx-telehealth-feature-title">Your goals.<br /><span>A real conversation.</span></h2>
        <p>There’s more to your health than a product. Make space for a conversation about your goals, your questions, and what may be right for you.</p>
        <Link href={`${base}/telehealth`} className="rx-home-primary">Explore telehealth <ArrowUpRight size={18} aria-hidden="true" /></Link>
        <p className="rx-telehealth-fineprint">A separate consultation experience, centered on you. Treatment recommendations depend on an individual clinical evaluation.</p>
      </div>
      <div className="rx-telehealth-feature-photo" data-rx-reveal>
        <Image src="/rx/wellness/telehealth-home-v1.webp" alt="Illustrative scene of a woman connecting from home on her laptop" fill sizes="(max-width: 760px) 100vw, 55vw" />
        <span className="rx-telehealth-photo-label"><Video size={17} aria-hidden="true" />A more personal connection</span>
      </div>
    </div>
  </section>;
}
