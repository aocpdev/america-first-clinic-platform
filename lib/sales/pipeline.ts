export const CUSTOMER_PIPELINE_STAGES = [
  { value: "AWAITING_PAYMENT", label: "Awaiting Payment" },
  { value: "NEW_SALE", label: "New Sale" },
  { value: "GFE", label: "Exam" },
  { value: "MEDICAL_REVIEW", label: "Medical Review" },
  { value: "APPROVAL", label: "Approval" },
  { value: "PRESCRIPTION_CONFIRMED", label: "Prescription Confirmed" },
  { value: "DEFERRED", label: "Deferred" },
  { value: "FULFILLMENT", label: "Fulfillment" },
  { value: "SHIPPED", label: "Shipped" }
] as const;

export type CustomerPipelineStage = (typeof CUSTOMER_PIPELINE_STAGES)[number]["value"];

export function isCustomerPipelineStage(value: string): value is CustomerPipelineStage {
  return CUSTOMER_PIPELINE_STAGES.some((stage) => stage.value === value);
}

export const ORDER_PIPELINE_STAGES = [
  {
    value: "AWAITING_PAYMENT",
    label: "Awaiting Payment",
    description: "Invoice or checkout link was sent and the order is waiting for payment."
  },
  {
    value: "NEW_SALE",
    label: "New Sale",
    description: "Payment was captured and the sale is ready to start the clinical workflow."
  },
  {
    value: "GFE",
    label: "Exam",
    description: "Clinical exam or intake review is in progress."
  },
  {
    value: "MEDICAL_REVIEW",
    label: "Medical Review",
    description: "The exam was deferred to a medical director or is pending clinical review."
  },
  {
    value: "APPROVAL",
    label: "Approval",
    description: "The order has been clinically approved. Prescription records stay visible to Go Virtual Health only."
  },
  {
    value: "PRESCRIPTION_CONFIRMED",
    label: "Prescription Confirmed",
    description: "Qualiphy confirmed the prescription or treatment order."
  },
  {
    value: "FULFILLMENT",
    label: "Fulfillment",
    description: "Tracking has been received and the order is being fulfilled."
  },
  {
    value: "SHIPPED",
    label: "Shipped",
    description: "The product has shipped and agent commissions can be approved."
  },
  {
    value: "DEFERRED",
    label: "Deferred",
    description: "The order was deferred and refund handling is required when payment was captured."
  }
] as const;

export const ORDER_PROGRESS_STAGES = ORDER_PIPELINE_STAGES.filter((stage) => stage.value !== "DEFERRED");

export type OrderPipelineStage = (typeof ORDER_PIPELINE_STAGES)[number]["value"];

export function isOrderPipelineStage(value: string): value is OrderPipelineStage {
  return ORDER_PIPELINE_STAGES.some((stage) => stage.value === value);
}

export function orderPipelineLabel(value: string | null | undefined) {
  return ORDER_PIPELINE_STAGES.find((stage) => stage.value === value)?.label ?? "New Sale";
}

export function orderPipelineDescription(value: string | null | undefined) {
  return ORDER_PIPELINE_STAGES.find((stage) => stage.value === value)?.description ?? ORDER_PIPELINE_STAGES[0].description;
}
