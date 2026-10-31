import { ArrowUpRight, ClipboardList, Stethoscope, PackageCheck } from "lucide-react";

const steps = [
  { icon: ClipboardList, title: "Explore your options", description: "Compare current product details and pricing. Your questions are a good place to start." },
  { icon: Stethoscope, title: "Clinical review comes first", description: "Prescription treatments require a clinician’s evaluation and approval. Browsing a product does not establish eligibility." },
  { icon: PackageCheck, title: "Follow your order", description: "Once an approved order is fulfilled, shipment tracking is added to its order details." }
];
export function CareJourney({ service = false }: { service?: boolean }) {
  const journey = service ? [...steps.slice(0, 2), { icon: ClipboardList, title: "Review your next steps", description: "Follow the instructions provided by your care team. Service details depend on your selection." }] : steps;
  return <section id="care-journey" className="rx-landing-section rx-journey">
    <div className="rx-section-heading"><div><p className="rx-eyebrow">A clearer path forward</p><h2>Thoughtful care.<br /><span>One step at a time.</span></h2></div><p>From exploring the catalog to understanding what comes next. A little more clarity, at every step.</p></div>
    <div className="rx-journey-grid">{journey.map((step, index) => <article key={step.title}><div className="rx-step-top"><step.icon size={23} strokeWidth={1.4} aria-hidden="true" /><span>0{index + 1}</span></div><h3>{step.title}</h3><p>{step.description}</p></article>)}</div>
    <p className="rx-preview-note"><ArrowUpRight size={16} aria-hidden="true" /> You’re viewing our catalog preview. Online checkout is not open yet.</p>
  </section>;
}
export function ProductQuestions({ service = false }: { service?: boolean }) {
  const questions = [
    ["Can I order online today?", "Not yet. You can explore products and review a selection in this preview. No order, prescription or payment is created."],
    ["Do I need a prescription?", "Prescription medications require evaluation and a prescription from a licensed clinician. Product availability does not mean a treatment is appropriate for you. Discuss benefits, risks and alternatives with your clinician."],
    ["Where does the pricing come from?", "The displayed product price comes from the current Go Virtual Health catalog. Review the exact product and quantity; a supply period in a product name does not establish automatic billing. Final charges will be shown when checkout becomes available."],
    ["Will I be able to track my shipment?", "Tracking is added when your order is fulfilled. Shipment details will appear with your order in the customer portal once online ordering is available."]
  ];
  return <section id="questions" className="rx-landing-section rx-faq"><div><p className="rx-eyebrow">A little clarity</p><h2>Good questions.<br /><span>Clear answers.</span></h2></div><div>{(service ? questions.slice(0, 3) : questions).map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>;
}
