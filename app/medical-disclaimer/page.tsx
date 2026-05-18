import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Medical Disclaimer | America First Clinic",
  description: "Medical disclaimer for America First Clinic wellness information and programs."
};

export default function MedicalDisclaimerPage() {
  return (
    <LegalPage
      eyebrow="Medical notice"
      title="Medical Disclaimer"
      updated="May 18, 2026"
      intro="America First Clinic provides wellness information, sales support, and access to products or programs operated by The IV Infusion Co. This disclaimer explains the limits of website and CRM information."
      sections={[
        {
          title: "Information is not medical advice",
          body: "Website content, product descriptions, consultant scripts, CRM notes, emails, SMS messages, and checkout materials are for general informational and operational purposes only. They are not medical advice, diagnosis, treatment, or a substitute for evaluation by a qualified licensed healthcare professional."
        },
        {
          title: "No provider-patient relationship by website use",
          body: "Using this website, speaking with a consultant, submitting a form, or placing an order does not automatically create a provider-patient relationship. Any service that requires medical evaluation, prescription review, or clinical supervision must be completed through the appropriate licensed provider workflow."
        },
        {
          title: "Prescription-related and GLP-1 workflows",
          body: "Programs that may involve prescription-related workflows, including GLP-1 related programs, require appropriate review, eligibility determination, and authorization by licensed professionals where applicable. We do not guarantee that any customer will qualify for a medication, prescription, protocol, program, or treatment."
        },
        {
          title: "Individual results vary",
          body: "Wellness, weight management, vitamin, injection, and healthcare-related results vary by individual. Outcomes depend on medical history, lifestyle, adherence, provider guidance, product suitability, and other factors. No specific result, weight loss amount, health improvement, or timeline is guaranteed."
        },
        {
          title: "Emergency care",
          body: "America First Clinic is not an emergency medical provider. If you are experiencing a medical emergency, severe allergic reaction, chest pain, difficulty breathing, or another urgent condition, call 911 or seek immediate emergency medical care."
        },
        {
          title: "Customer responsibility",
          body: "Customers should disclose accurate health history, medications, allergies, pregnancy status, and other relevant information to their healthcare provider. Customers should follow provider instructions, product labels, storage requirements, and safety guidance."
        }
      ]}
    />
  );
}
