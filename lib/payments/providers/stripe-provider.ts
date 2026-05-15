import { BasePaymentProvider } from "@/lib/payments/providers/base";

export class StripeProvider extends BasePaymentProvider {
  code = "stripe" as const;
}
