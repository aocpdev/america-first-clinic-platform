import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, MessageCircle, Video, ClipboardCheck } from "lucide-react";
import { requireRxCompany, rxBasePath } from "@/lib/products/rx-catalog";

export const metadata: Metadata = {
  title: "Telehealth | Care that starts with you",
  description: "Explore a more personal approach to virtual care with Go Virtual Health. Your goals, your questions, and a thoughtful conversation about your next step.",
  alternates: { canonical: "https://rx.govirtualhealth.com/telehealth" },
  openGraph: { title: "Telehealth · Go Virtual Health", description: "Your goals. A real conversation.", url: "https://rx.govirtualhealth.com/telehealth", type: "website", images: [{ url: "/rx/wellness/telehealth-home-v1.webp", width: 1536, height: 1024, alt: "Illustrative virtual consultation at home" }] }
};

const steps = [
  { icon: MessageCircle, title: "Start with your goals", text: "Bring your questions and share what you would like to explore. Your individual health history matters." },
  { icon: Video, title: "Make time for a conversation", text: "A consultation is an opportunity to discuss your needs and understand the options that may be appropriate for you." },
  { icon: ClipboardCheck, title: "Understand your next step", text: "Any recommendations follow an individual clinical evaluation. A consultation does not guarantee a prescription or treatment." }
];
const questions = [
  { title: "How is Telehealth different from the catalog?", text: "Telehealth is a separate consultation experience. The catalog lets you explore products; a clinical conversation focuses on your health history, questions and personal goals." },
  { title: "What can I discuss during a consultation?", text: "You can bring questions about your wellness goals and care options. The clinician determines what is appropriate to address through a virtual visit and whether additional evaluation is needed." },
  { title: "Does a visit guarantee a prescription?", text: "No. Prescriptions and treatment recommendations require an individual clinical evaluation and are not guaranteed by booking or paying for a consultation." },
  { title: "Can I book a visit here today?", text: "Not yet. This is a preview of our dedicated Telehealth experience. Scheduling, availability and consultation pricing will be confirmed before bookings open. No appointment or payment is created on this page." }
];

export default async function TelehealthPage() {
  await requireRxCompany();
  const base = await rxBasePath();
  return <div className="rx-telehealth-page">
    <section className="rx-telehealth-hero" aria-labelledby="telehealth-title">
      <div className="rx-telehealth-hero-copy">
        <p className="rx-home-eyebrow">Go Virtual Health / Telehealth</p>
        <h1 id="telehealth-title">Care that<br />starts with <span>you.</span></h1>
        <p>Your questions deserve a conversation. Explore a thoughtful approach to virtual care, built around your goals and your next chapter.</p>
        <a className="rx-home-primary" href="#your-visit">Explore your visit <ArrowDown size={17} aria-hidden="true" /></a>
        <span className="rx-telehealth-availability">Online scheduling is coming soon</span>
      </div>
      <div className="rx-telehealth-hero-photo"><Image src="/rx/wellness/telehealth-home-v1.webp" alt="Illustrative scene of a woman using her laptop for a virtual consultation at home" fill priority sizes="(max-width: 760px) 100vw, 55vw" /></div>
    </section>
    <section id="your-visit" className="rx-telehealth-visit" aria-labelledby="telehealth-visit-title">
      <div className="rx-telehealth-section-heading"><p className="rx-home-eyebrow">A more personal approach</p><h2 id="telehealth-visit-title">More listening.<br /><span>More clarity.</span></h2><p>Not a one-size-fits-all answer. A space to understand where you are and explore what comes next.</p></div>
      <ol className="rx-telehealth-steps">{steps.map((step, index) => <li key={step.title}><div><step.icon size={24} strokeWidth={1.4} aria-hidden="true" /><span>0{index + 1}</span></div><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol>
    </section>
    <section className="rx-telehealth-story" aria-labelledby="telehealth-story-title">
      <div className="rx-telehealth-story-photo"><Image src="/rx/wellness/telehealth-clinician-v1.webp" alt="Illustrative clinician at a laptop in a calm consultation setting; not an actual team member" fill sizes="(max-width: 760px) 100vw, 50vw" /></div>
      <div className="rx-telehealth-story-copy"><p className="rx-home-eyebrow">The conversation comes first</p><h2 id="telehealth-story-title">A person.<br /><span>Not just a purchase.</span></h2><p>Your health history, preferences and questions help shape the conversation. The next step should be appropriate for you—not simply the next item in a cart.</p><a href="#telehealth-questions" className="rx-button-text">A little more clarity <ArrowDown size={16} aria-hidden="true" /></a><p className="rx-telehealth-fineprint">Images are illustrative and do not depict actual patients or members of our clinical team.</p></div>
    </section>
    <section id="telehealth-questions" className="rx-telehealth-faq" aria-labelledby="telehealth-faq-title"><div><p className="rx-home-eyebrow">Before your visit</p><h2 id="telehealth-faq-title">Good questions.<br /><span>Clear answers.</span></h2></div><div>{questions.map(question => <details key={question.title}><summary>{question.title}</summary><p>{question.text}</p></details>)}</div></section>
    <section className="rx-telehealth-next" aria-labelledby="telehealth-next-title"><p className="rx-home-eyebrow">Your next chapter</p><h2 id="telehealth-next-title">Let’s start with<br />a conversation.</h2><p>We’re preparing your dedicated consultation experience. Scheduling, pricing and availability will be shared before visits can be booked.</p><span className="rx-telehealth-coming-soon"><Video size={18} aria-hidden="true" />Scheduling coming soon</span><Link href={`${base || "/"}`} className="rx-button-text">Back to Go Virtual Health <ArrowUpRight size={16} aria-hidden="true" /></Link><p className="rx-telehealth-fineprint">This preview does not book a consultation, collect health information or process a payment.</p></section>
  </div>;
}
