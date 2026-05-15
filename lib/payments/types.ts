export type PaymentProviderCode = "stripe" | "authorize_net" | "nmi" | "ach";

export type Money = {
  amount: number;
  currency: "USD";
};

export type PaymentCustomerInput = {
  companyId: string;
  customerId: string;
  email: string;
  name?: string;
  metadata?: Record<string, string>;
};

export type CheckoutSessionInput = {
  companyId: string;
  customerId: string;
  orderId: string;
  successUrl: string;
  cancelUrl: string;
  lineItems: Array<{ name: string; quantity: number; unitAmount: Money }>;
  metadata?: Record<string, string>;
};

export type SubscriptionInput = CheckoutSessionInput & {
  interval: "month" | "year";
};

export type ChargeInput = {
  companyId: string;
  customerId: string;
  orderId: string;
  paymentMethodToken: string;
  amount: Money;
  capture?: boolean;
  metadata?: Record<string, string>;
};

export type RefundInput = {
  companyId: string;
  transactionId: string;
  amount?: Money;
  reason?: string;
};

export type ACHTransactionInput = {
  companyId: string;
  customerId: string;
  orderId: string;
  bankAccountToken: string;
  amount: Money;
  metadata?: Record<string, string>;
};

export type PaymentProviderResult = {
  provider: PaymentProviderCode;
  providerCustomerId?: string;
  providerSessionId?: string;
  providerSubscriptionId?: string;
  providerTransactionId?: string;
  status: "created" | "pending" | "authorized" | "captured" | "failed" | "refunded";
  redirectUrl?: string;
  raw?: unknown;
};

export interface PaymentProvider {
  code: PaymentProviderCode;
  createCustomer(input: PaymentCustomerInput): Promise<PaymentProviderResult>;
  createCheckoutSession(input: CheckoutSessionInput): Promise<PaymentProviderResult>;
  createSubscription(input: SubscriptionInput): Promise<PaymentProviderResult>;
  chargePayment(input: ChargeInput): Promise<PaymentProviderResult>;
  refundPayment(input: RefundInput): Promise<PaymentProviderResult>;
  capturePayment(input: { companyId: string; transactionId: string; amount?: Money }): Promise<PaymentProviderResult>;
  tokenizeCard(input: { companyId: string; customerId: string; providerToken: string }): Promise<PaymentProviderResult>;
  createACHTransaction(input: ACHTransactionInput): Promise<PaymentProviderResult>;
  verifyWebhook(payload: string, signature: string | null): Promise<boolean>;
}
