import type { PaymentProviderCode } from "@/lib/payments/types";
import { portalBaseUrl, publicSiteBaseUrl } from "@/lib/urls";

export function appBaseUrl() {
  return portalBaseUrl();
}

export function paymentShortCode(orderId: string) {
  return orderId.replaceAll("-", "").slice(0, 10).toUpperCase();
}

export function paymentShortUrl(orderId: string) {
  return `${publicSiteBaseUrl()}/pay/${paymentShortCode(orderId)}`;
}

export function invoiceShortUrl(orderId: string) {
  return `${publicSiteBaseUrl()}/i/${paymentShortCode(orderId)}`;
}

export function fallbackOrderPaymentUrl(orderId: string, providerCode: PaymentProviderCode) {
  return `${publicSiteBaseUrl()}/checkout?orderId=${orderId}&provider=${providerCode}`;
}
