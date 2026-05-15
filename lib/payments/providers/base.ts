import type {
  ACHTransactionInput,
  ChargeInput,
  CheckoutSessionInput,
  PaymentCustomerInput,
  PaymentProvider,
  PaymentProviderCode,
  PaymentProviderResult,
  RefundInput,
  SubscriptionInput
} from "@/lib/payments/types";

export abstract class BasePaymentProvider implements PaymentProvider {
  abstract code: PaymentProviderCode;

  protected placeholder(status: PaymentProviderResult["status"], extra: Partial<PaymentProviderResult> = {}): PaymentProviderResult {
    return { provider: this.code, status, ...extra };
  }

  async createCustomer(input: PaymentCustomerInput) {
    return this.placeholder("created", { providerCustomerId: `${this.code}_customer_${input.customerId}` });
  }

  async createCheckoutSession(input: CheckoutSessionInput) {
    return this.placeholder("created", {
      providerSessionId: `${this.code}_session_${input.orderId}`,
      redirectUrl: input.successUrl
    });
  }

  async createSubscription(input: SubscriptionInput) {
    return this.placeholder("created", { providerSubscriptionId: `${this.code}_subscription_${input.orderId}` });
  }

  async chargePayment(input: ChargeInput) {
    return this.placeholder(input.capture === false ? "authorized" : "captured", {
      providerTransactionId: `${this.code}_transaction_${input.orderId}`
    });
  }

  async refundPayment(input: RefundInput) {
    return this.placeholder("refunded", { providerTransactionId: input.transactionId });
  }

  async capturePayment(input: { companyId: string; transactionId: string }) {
    return this.placeholder("captured", { providerTransactionId: input.transactionId });
  }

  async tokenizeCard(input: { companyId: string; customerId: string; providerToken: string }) {
    return this.placeholder("created", { providerTransactionId: `${this.code}_vault_${input.customerId}` });
  }

  async createACHTransaction(input: ACHTransactionInput) {
    return this.placeholder("pending", { providerTransactionId: `${this.code}_ach_${input.orderId}` });
  }

  async verifyWebhook() {
    return true;
  }
}
