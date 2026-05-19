import Stripe from "stripe";
import { BasePaymentProvider } from "@/lib/payments/providers/base";
import type {
  ChargeInput,
  CheckoutSessionInput,
  PaymentCustomerInput,
  RefundInput
} from "@/lib/payments/types";

export class StripeProvider extends BasePaymentProvider {
  code = "stripe" as const;

  private client() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) return null;
    return new Stripe(secretKey);
  }

  async createCustomer(input: PaymentCustomerInput) {
    const stripe = this.client();
    if (!stripe) {
      return this.placeholder("created", { providerCustomerId: `stripe_customer_${input.customerId}` });
    }

    const customer = await stripe.customers.create({
      email: input.email,
      name: input.name,
      metadata: {
        companyId: input.companyId,
        crmCustomerId: input.customerId,
        ...(input.metadata ?? {})
      }
    });

    return this.placeholder("created", {
      providerCustomerId: customer.id,
      raw: customer
    });
  }

  async createCheckoutSession(input: CheckoutSessionInput) {
    const stripe = this.client();
    if (!stripe) {
      return this.placeholder("created", {
        providerSessionId: `stripe_session_${input.orderId}`,
        redirectUrl: input.successUrl
      });
    }

    const customer = await this.createCustomer({
      companyId: input.companyId,
      customerId: input.customerId,
      email: input.metadata?.customerEmail ?? "",
      name: input.metadata?.customerName,
      metadata: input.metadata
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customer.providerCustomerId,
      payment_method_types: ["card"],
      line_items: input.lineItems.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: "usd",
          unit_amount: item.unitAmount.amount,
          product_data: {
            name: item.name
          }
        }
      })),
      payment_intent_data: {
        setup_future_usage: "off_session",
        metadata: input.metadata
      },
      metadata: input.metadata,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl
    });

    return this.placeholder("created", {
      providerCustomerId: customer.providerCustomerId,
      providerSessionId: session.id,
      redirectUrl: session.url ?? input.successUrl,
      raw: session
    });
  }

  async chargePayment(input: ChargeInput) {
    const stripe = this.client();
    if (!stripe) return super.chargePayment(input);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: input.amount.amount,
      currency: "usd",
      payment_method: input.paymentMethodToken,
      confirm: true,
      capture_method: input.capture === false ? "manual" : "automatic",
      metadata: {
        companyId: input.companyId,
        customerId: input.customerId,
        orderId: input.orderId,
        ...(input.metadata ?? {})
      }
    });

    return this.placeholder(input.capture === false ? "authorized" : "captured", {
      providerTransactionId: paymentIntent.id,
      raw: paymentIntent
    });
  }

  async refundPayment(input: RefundInput) {
    const stripe = this.client();
    if (!stripe) return super.refundPayment(input);

    const refund = await stripe.refunds.create({
      payment_intent: input.transactionId,
      amount: input.amount?.amount,
      reason: input.reason === "fraudulent" || input.reason === "duplicate" || input.reason === "requested_by_customer" ? input.reason : undefined
    });

    return this.placeholder("refunded", {
      providerTransactionId: refund.id,
      raw: refund
    });
  }

  async verifyWebhook(payload: string, signature: string | null) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const stripe = this.client();
    if (!stripe || !webhookSecret || !signature) return false;

    try {
      stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      return true;
    } catch {
      return false;
    }
  }

  constructWebhookEvent(payload: string, signature: string | null) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const stripe = this.client();
    if (!stripe || !webhookSecret || !signature) return null;

    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }
}
