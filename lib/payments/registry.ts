import { ACHProvider } from "@/lib/payments/providers/ach-provider";
import { AuthorizeNetProvider } from "@/lib/payments/providers/authorize-net-provider";
import { NMIProvider } from "@/lib/payments/providers/nmi-provider";
import { StripeProvider } from "@/lib/payments/providers/stripe-provider";
import type { PaymentProvider, PaymentProviderCode } from "@/lib/payments/types";

const providers: Record<PaymentProviderCode, PaymentProvider> = {
  stripe: new StripeProvider(),
  authorize_net: new AuthorizeNetProvider(),
  nmi: new NMIProvider(),
  ach: new ACHProvider()
};

export function getPaymentProvider(code: PaymentProviderCode): PaymentProvider {
  const provider = providers[code];
  if (!provider) {
    throw new Error(`Unsupported payment provider: ${code}`);
  }
  return provider;
}

export function listPaymentProviders() {
  return Object.keys(providers) as PaymentProviderCode[];
}
