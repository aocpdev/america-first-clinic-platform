import { BasePaymentProvider } from "@/lib/payments/providers/base";

export class ACHProvider extends BasePaymentProvider {
  code = "ach" as const;
}
