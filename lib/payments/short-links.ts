import type { PaymentProviderCode } from "@/lib/payments/types";

export function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function paymentShortCode(orderId: string) {
  return orderId.replaceAll("-", "").slice(0, 10).toUpperCase();
}

export function paymentShortUrl(orderId: string) {
  return `${appBaseUrl()}/pay/${paymentShortCode(orderId)}`;
}

export function invoiceShortUrl(orderId: string) {
  return `${appBaseUrl()}/i/${paymentShortCode(orderId)}`;
}

export function fallbackOrderPaymentUrl(orderId: string, providerCode: PaymentProviderCode) {
  return `${appBaseUrl()}/checkout?orderId=${orderId}&provider=${providerCode}`;
}
