import { LEGAL_COMPANY_NAME, LEGAL_POLICY_UPDATED } from "@/lib/legal/company";
import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { MOBILE_INFORMATION_POLICY, CUSTOMER_TEXT_MESSAGING_POLICY, PARTNER_TEXT_MESSAGING_POLICY, OTHER_TEXT_MESSAGING_PROGRAMS, SMS_CONSENT_AND_SUPPORT } from "@/lib/legal/sms-policy";

export const metadata: Metadata = {
  title: "Privacy Policy | Go Virtual Health",
  description: "Privacy policy for Go Virtual Health websites, CRM, checkout, and communications."
};

export default function PrivacyPolicyContent({ showNavigation = true }: { showNavigation?: boolean }) {
  return (
    <LegalPage
      showNavigation={showNavigation}
      eyebrow="Privacy"
      title="Privacy Policy"
      updated={LEGAL_POLICY_UPDATED}
      intro={`This Privacy Policy explains how Go Virtual Health, operated by ${LEGAL_COMPANY_NAME}, collects, uses, and protects information across its website, CRM, checkout, agent, and customer communication workflows.`}
      sections={[
        {
          title: "Information we collect",
          body: "We may collect information you provide directly, including name, email, phone number, shipping address, account details, order details, agent assignment, program interest, notes, payment status, and communications. For healthcare or wellness workflows, additional information may be collected only as needed for eligibility, operational, or provider-related processes."
        },
        {
          title: "How we use information",
          body: "We use information to create accounts, manage agent approvals, process orders, support customers, send invoices or receipts, coordinate fulfillment, track sales attribution, calculate commissions, improve internal reporting, prevent fraud, maintain security, and comply with legal, payment, tax, and operational obligations."
        },
        {
          title: "Cookies and tracking",
          body: "We and our service providers may use cookies and similar technologies to operate the site, remember preferences, and understand how the platform is used. You can control cookies in your browser settings; disabling them may limit some features."
        },
        {
          title: "Payment information",
          body: "Payment processing may be handled by third-party payment providers. We do not intend to store raw card numbers or CVV codes in the CRM. When direct card collection is enabled, payment details should be tokenized or collected through approved payment-provider tools designed for secure processing."
        },
        {
          title: "Service providers",
          body: "We may share information with vendors that help operate the platform, including hosting, database, authentication, storage, email, analytics, payment processing, invoicing, CRM integrations, fulfillment, and professional service providers. These providers may process information only for authorized business purposes, subject to the Mobile information and SMS consent restrictions below. Mobile information and messaging consent are not shared for marketing or promotional purposes; messaging delivery providers receive only what is needed to deliver the messages."
        },
        {
          title: "Mobile information and SMS consent",
          body: MOBILE_INFORMATION_POLICY
        },
        {
          title: "Customer text messaging",
          body: CUSTOMER_TEXT_MESSAGING_POLICY
        },
        {
          title: "Partner account text messaging",
          body: PARTNER_TEXT_MESSAGING_POLICY
        },
        {
          title: "SMS choices and support",
          body: SMS_CONSENT_AND_SUPPORT
        },
        {
          title: "Customer and application text programs",
          body: OTHER_TEXT_MESSAGING_PROGRAMS
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
          title: "Your rights",
          body: "You may request access to, correction of, or deletion of your personal information by contacting support@govirtualhealth.com."
        },
        {
          title: "Contact",
          body: "Questions about privacy or data handling can be sent to support@govirtualhealth.com. We may update this policy as our platform, vendors, payment providers, healthcare workflows, or legal requirements change."
        }
      ]}
    />
  );
}
