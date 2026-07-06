import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service | Go Virtual Health",
  description: "Terms governing use of Go Virtual Health services and CRM access."
};

export default function TermsOfServicePage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Service"
      updated="May 18, 2026"
      intro="These Terms of Service govern access to Go Virtual Health websites, checkout flows, agent portals, customer communications, and related services operated by ACV2 Investment Group LLC."
      sections={[
        {
          title: "Operator and brand use",
          body: "Go Virtual Health is operated by ACV2 Investment Group LLC. References to Go Virtual Health, we, us, or our mean the website, brand, sales platform, and related services operated by ACV2 Investment Group LLC. Go Virtual Health may be used as a brand name and may later be registered or operated as a DBA or related business name."
        },
        {
          title: "Eligibility and accounts",
          body: "You must provide accurate information when creating an account, placing an order, requesting agent access, or interacting with our team. Agent accounts require approval before accessing sales tools. We may suspend or restrict access if information is inaccurate, a user violates these terms, or continued access creates operational, compliance, payment, or security risk."
        },
        {
          title: "Healthcare and wellness services",
          body: "Some products or programs may relate to wellness, weight management, vitamin injections, telehealth workflows, or prescription-adjacent services. Content on this website is informational and does not create a provider-patient relationship by itself. When a service requires clinical review, eligibility, prescription approval, or medical supervision, the customer must complete the required process with an appropriate licensed provider before the product or service can be fulfilled."
        },
        {
          title: "Orders, payments, and subscriptions",
          body: "Prices, product availability, subscription terms, and program requirements may change. Orders are subject to review, payment authorization, product availability, fraud screening, and any required healthcare eligibility checks. Payment may be processed by third-party providers, including card, ACH, invoice, or future healthcare payment processors. We do not authorize agents or users to store raw payment card details outside approved payment systems."
        },
        {
          title: "Agent and partner access",
          body: "Agents, partners, managers, and Go Virtual Health team members may access different information based on their role. Users are responsible for keeping login credentials secure and may only access customer, order, sales, and commission information they are authorized to view. Unauthorized access, data export, sharing, or misuse is prohibited."
        },
        {
          title: "No guarantee of results",
          body: "Wellness, weight management, and health-related outcomes vary by person. We do not guarantee eligibility for any program, approval of any prescription-related service, specific medical results, weight loss, performance outcomes, or uninterrupted availability of products or services."
        },
        {
          title: "Acceptable use",
          body: "You may not use the platform for unlawful activity, misrepresentation, unauthorized medical claims, payment fraud, scraping, interference with service operations, or violation of privacy, healthcare, consumer protection, or payment network rules. Agents must use approved product information and may not promise medical outcomes or make unsupported claims."
        },
        {
          title: "Limitation of liability",
          body: "To the fullest extent permitted by law, Go Virtual Health and ACV2 Investment Group LLC are not liable for indirect, incidental, special, consequential, or punitive damages arising from use of the site, CRM, checkout, products, services, delays, third-party processors, or communications. Some jurisdictions do not allow certain limitations, so parts of this section may not apply to you."
        },
        {
          title: "Changes and contact",
          body: "We may update these terms as our services, policies, payment providers, or legal requirements change. Continued use after an update means you accept the updated terms. Questions can be sent to support@govirtualhealth.com."
        }
      ]}
    />
  );
}
