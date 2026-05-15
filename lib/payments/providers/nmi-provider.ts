import { BasePaymentProvider } from "@/lib/payments/providers/base";

export class NMIProvider extends BasePaymentProvider {
  code = "nmi" as const;
}
