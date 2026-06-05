import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Refund Policy | Go Virtual Health",
  description: "Refund and cancellation policy for Go Virtual Health orders and services."
};

export default function RefundPolicyPage() {
  return (
    <LegalPage
      eyebrow="Customer policy"
      title="Refund Policy"
      updated="May 18, 2026"
      intro="This policy explains how refunds, cancellations, and order adjustments are handled for Go Virtual Health products, services, and programs operated by ACV2 Investment Group LLC."
      sections={[
        {
          title: "General refund approach",
          body: "Refund eligibility depends on the type of product or service, fulfillment status, clinical review status, payment status, and applicable health and safety rules. We review refund requests in good faith, but some items cannot be returned or refunded once prepared, shipped, dispensed, used, opened, or clinically rendered."
        },
        {
          title: "Cancellations before fulfillment",
          body: "If an order has not been processed, shipped, dispensed, scheduled, or clinically started, you may request cancellation by contacting support@americafirstclinic.com as soon as possible. Approved cancellations are refunded to the original payment method when available."
        },
        {
          title: "Products and wellness items",
          body: "Unopened, unused, non-prescription retail products may be eligible for review within 14 days of delivery. Products that are sterile, injectable, refrigerated, temperature-sensitive, personalized, prescription-related, opened, used, damaged after delivery, or restricted by health and safety rules are final sale unless required otherwise by law."
        },
        {
          title: "Services, programs, and clinical workflows",
          body: "Consultations, administrative review, onboarding, medical review, program setup, prescription-related workflows, and services already rendered may be non-refundable. If a customer is not eligible for a program after required review, any available refund or credit will depend on what services have already been performed and what costs have already been incurred."
        },
        {
          title: "Shipping, failed delivery, and address issues",
          body: "Shipping fees, return shipping, failed delivery costs, address correction fees, and carrier-related charges may be non-refundable. Customers are responsible for providing a complete and accurate shipping address before fulfillment."
        },
        {
          title: "Refund timing",
          body: "Approved refunds are generally submitted to the original payment method. Bank and card network timing varies, and it may take several business days for the refund to appear. We cannot guarantee processing times controlled by third-party payment providers or financial institutions."
        },
        {
          title: "How to request a refund",
          body: "To request a refund or order review, email support@americafirstclinic.com with your name, order number, contact information, reason for the request, and any supporting details such as delivery issues or product condition."
        }
      ]}
    />
  );
}
