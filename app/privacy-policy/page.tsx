import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy | Go Virtual Health",
  description: "Privacy policy for Go Virtual Health websites, CRM, checkout, and communications."
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="Privacy Policy"
      updated="May 18, 2026"
      intro="This Privacy Policy explains how Go Virtual Health, operated by ACV2 Investment Group LLC, collects, uses, and protects information across its website, CRM, checkout, consultant, and customer communication workflows."
      sections={[
        {
          title: "Information we collect",
          body: "We may collect information you provide directly, including name, email, phone number, shipping address, account details, order details, consultant assignment, program interest, notes, payment status, and communications. For healthcare or wellness workflows, additional information may be collected only as needed for eligibility, operational, or provider-related processes."
        },
        {
          title: "How we use information",
          body: "We use information to create accounts, manage consultant approvals, process orders, support customers, send invoices or receipts, coordinate fulfillment, track sales attribution, calculate commissions, improve internal reporting, prevent fraud, maintain security, and comply with legal, payment, tax, and operational obligations."
        },
        {
          title: "Payment information",
          body: "Payment processing may be handled by third-party payment providers. We do not intend to store raw card numbers or CVV codes in the CRM. When direct card collection is enabled, payment details should be tokenized or collected through approved payment-provider tools designed for secure processing."
        },
        {
          title: "Service providers",
          body: "We may share information with vendors that help operate the platform, including hosting, database, authentication, storage, email, analytics, payment processing, invoicing, SMS, CRM integrations, fulfillment, and professional service providers. These providers may process information only for authorized business purposes."
        },
        {
          title: "Healthcare information",
          body: "Some information may relate to wellness, medical, or prescription-adjacent workflows. Where protected health information or regulated clinical data is involved, it should be handled through appropriate provider, pharmacy, telehealth, or compliant operational workflows. This policy does not replace any separate healthcare provider privacy notice that may apply."
        },
        {
          title: "Security and access",
          body: "We use role-based access, server-side controls, authentication, and operational safeguards to limit access to information. No system can be guaranteed completely secure, and users are responsible for protecting their login credentials and using the platform only for authorized purposes."
        },
        {
          title: "Contact",
          body: "Questions about privacy or data handling can be sent to support@americafirstclinic.com. We may update this policy as our platform, vendors, payment providers, healthcare workflows, or legal requirements change."
        }
      ]}
    />
  );
}
