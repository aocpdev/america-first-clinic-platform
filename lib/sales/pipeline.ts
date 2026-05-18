export const CUSTOMER_PIPELINE_STAGES = [
  { value: "NEW_LEAD", label: "New lead" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "INTAKE_SENT", label: "Intake sent" },
  { value: "INTAKE_COMPLETE", label: "Intake complete" },
  { value: "CART_BUILT", label: "Cart built" },
  { value: "PAYMENT_PENDING", label: "Payment pending" },
  { value: "PAID", label: "Paid" },
  { value: "FULFILLMENT", label: "Fulfillment" },
  { value: "FOLLOW_UP", label: "Follow-up" }
] as const;

export type CustomerPipelineStage = (typeof CUSTOMER_PIPELINE_STAGES)[number]["value"];

export function isCustomerPipelineStage(value: string): value is CustomerPipelineStage {
  return CUSTOMER_PIPELINE_STAGES.some((stage) => stage.value === value);
}
