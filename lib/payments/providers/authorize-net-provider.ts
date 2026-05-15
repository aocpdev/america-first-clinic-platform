import { BasePaymentProvider } from "@/lib/payments/providers/base";

export class AuthorizeNetProvider extends BasePaymentProvider {
  code = "authorize_net" as const;
}
