import { LEGAL_COMPANY_NAME, LEGAL_POLICY_UPDATED } from "@/lib/legal/company";
import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { MOBILE_INFORMATION_POLICY, CUSTOMER_TEXT_MESSAGING_POLICY, PARTNER_TEXT_MESSAGING_POLICY, OTHER_TEXT_MESSAGING_PROGRAMS, SMS_CONSENT_AND_SUPPORT } from "@/lib/legal/sms-policy";

export const metadata: Metadata = {
  title: "Terms of Service | Go Virtual Health",
  description: "Terms governing use of Go Virtual Health services and CRM access."
};

export default function TermsOfServiceContent({ showNavigation = true }: { showNavigation?: boolean }) {
  return (
    <LegalPage
      showNavigation={showNavigation}
      eyebrow="Legal"
      title="Terms of Service"
      updated={LEGAL_POLICY_UPDATED}
      intro={`These Terms of Service govern access to Go Virtual Health websites, checkout flows, agent portals, customer communications, and related services operated by ${LEGAL_COMPANY_NAME}.`}
      sections={[
        {
          title: "Operator and brand use",
          body: `Go Virtual Health is operated by ${LEGAL_COMPANY_NAME}. References to Go Virtual Health, we, us, or our mean ${LEGAL_COMPANY_NAME} and its websites, sales platform, and related services.`
        },
        {
          title: "Eligibility and accounts",
          body: "You must be at least 18 years old to use the Services and to enroll in any text messaging program. You must provide accurate information when creating an account, placing an order, requesting agent access, or interacting with our team. Agent accounts require approval before accessing sales tools. We may suspend or restrict access if information is inaccurate, a user violates these terms, or continued access creates operational, compliance, payment, or security risk."
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
          title: "Customer text messaging",
          body: CUSTOMER_TEXT_MESSAGING_POLICY
        },
        {
          title: "Partner account text messaging",
          body: `${PARTNER_TEXT_MESSAGING_POLICY}\n\n${SMS_CONSENT_AND_SUPPORT}`
        },
        {
          title: "Mobile information and SMS consent",
          body: MOBILE_INFORMATION_POLICY
        },
        {
          title: "Customer and application text programs",
          body: OTHER_TEXT_MESSAGING_PROGRAMS
        },
        {
          title: "Acceptable use",
          body: "You may not use the platform for unlawful activity, misrepresentation, unauthorized medical claims, payment fraud, scraping, interference with service operations, or violation of privacy, healthcare, consumer protection, or payment network rules. Agents must use approved product information and may not promise medical outcomes or make unsupported claims."
        },
        {
          title: "Limitation of liability",
          body: `To the fullest extent permitted by law, ${LEGAL_COMPANY_NAME} is not liable for indirect, incidental, special, consequential, or punitive damages arising from use of the site, CRM, checkout, products, services, delays, third-party processors, or communications. Some jurisdictions do not allow certain limitations, so parts of this section may not apply to you.`
        },
        {
          title: "Changes and contact",
          body: "We may update these terms as our services, policies, payment providers, or legal requirements change. Continued use after an update means you accept the updated terms. Questions can be sent to support@govirtualhealth.com."
        }
      ]}
    />
  );
}
