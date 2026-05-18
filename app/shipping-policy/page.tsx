import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Shipping Policy | America First Clinic",
  description: "Shipping and fulfillment policy for America First Clinic orders."
};

export default function ShippingPolicyPage() {
  return (
    <LegalPage
      eyebrow="Fulfillment"
      title="Shipping Policy"
      updated="May 18, 2026"
      intro="This policy describes how America First Clinic handles order processing, shipping, delivery, and address responsibilities for products and programs operated by The IV Infusion Co."
      sections={[
        {
          title: "Order processing",
          body: "Orders are processed after payment authorization and any required eligibility, inventory, compliance, or clinical checks are complete. Standard processing may take 1 to 3 business days, but timing can vary based on product type, provider review, payment review, holidays, and carrier availability."
        },
        {
          title: "Shipping locations",
          body: "Products and programs are available only where legally permitted and operationally supported. Some healthcare, wellness, injectable, prescription-related, refrigerated, or temperature-sensitive items may be restricted by state, provider, carrier, pharmacy, or compliance requirements."
        },
        {
          title: "Shipping methods and tracking",
          body: "When tracking is available, customers may receive tracking information by email, SMS, invoice communication, or customer support. Delivery estimates are not guarantees. Carrier delays, weather, address issues, and supply limitations may affect arrival time."
        },
        {
          title: "Customer address responsibility",
          body: "Customers must provide a complete and accurate shipping address, phone number, and delivery information before fulfillment. We are not responsible for delays, failed delivery, loss, or extra charges caused by incorrect or incomplete customer-provided information."
        },
        {
          title: "Temperature-sensitive and medical items",
          body: "Some items may require special handling, limited shipping windows, signature requirements, or specific delivery instructions. Customers are responsible for promptly retrieving delivered items and following any storage or use instructions provided with the product or by a licensed provider."
        },
        {
          title: "Lost, damaged, or delayed packages",
          body: "If a package appears lost, damaged, or delayed, contact support@americafirstclinic.com with your order number and supporting details. We may work with the carrier or fulfillment partner to review the issue, but replacement or refund eligibility depends on the item type, carrier findings, and applicable policy."
        }
      ]}
    />
  );
}
