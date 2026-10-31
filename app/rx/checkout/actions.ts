"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireCustomerSession } from "@/lib/customers/customer-session";
import { readRxCart } from "@/lib/orders/rx-cart-session";
import { createRxCheckoutOrder } from "@/lib/orders/rx-checkout-order";
import { RX_REFERRAL_COOKIE } from "@/lib/referrals/rx-browsing-referral";
import { createRxStripeCheckout } from "@/lib/payments/rx-stripe-checkout";
import { rxCheckoutCanCharge } from "@/lib/payments/rx-checkout-release";
import { assertRxStripeConfiguration } from "@/lib/payments/rx-stripe-policy";
import { getCompanyStripeRuntimeConfig } from "@/lib/payments/stripe-config";
import { readSmsChoice } from "@/lib/legal/sms-consent";

export type CheckoutState = { error?: string };
export async function startRxCheckout(_previous: CheckoutState, form: FormData): Promise<CheckoutState> {
  if (!rxCheckoutCanCharge()) return { error: "Online payment is not available yet. No payment has been taken." };
  // getUser() + verified email + explicit customer/user/tenant binding, not an email lookup.
  const customer = await requireCustomerSession();
  if (!customer.userId) return { error: "Please sign in with your verified customer account." };
  let paymentUrl: string;
  try {
    // Fail before persisting an order if credentials are missing or in the wrong mode.
    assertRxStripeConfiguration(await getCompanyStripeRuntimeConfig(customer.companyId));
    const cart = await readRxCart(customer.companyId);
    const referral = (await cookies()).get(RX_REFERRAL_COOKIE)?.value;
    const order = await createRxCheckoutOrder(prisma,
      { companyId: customer.companyId, customerId: customer.id, userId: customer.userId },
      { requestId: form.get("requestId"), expectedTotalCents: Number(form.get("expectedTotalCents")),
        ...readSmsChoice(form),
        cart: { items: cart.items, couponCode: cart.couponCode },
        shipping: { line1: form.get("line1"), line2: form.get("line2") ?? "", city: form.get("city"), state: form.get("state"), postalCode: form.get("postalCode"), country: "US" } }, referral);
    paymentUrl = (await createRxStripeCheckout(prisma, order)).url;
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const messages: Record<string, string> = {
      SMS_PHONE_REQUIRED: "Please update the phone number in your profile, or leave text updates unchecked to continue without SMS.",
      INVALID_SMS_CONSENT: "Please refresh this page and review the optional text updates choice.",
      RX_PRICE_CHANGED: "The price has changed. Return to your cart to review the current total.",
      RX_CUSTOMER_DETAILS_REQUIRED: "Your customer profile needs to be completed before ordering. Please contact our team.",
      RX_PENDING_CHECKOUT_REVIEW_REQUIRED: "You already have a pending checkout. Please contact our team before changing that order.",
      RX_ADJUSTED_TOTAL_REVIEW_REQUIRED: "This selection needs a pricing review before payment. Please contact our team.",
      ORIGINAL_SELLER_REVIEW_REQUIRED: "We need to confirm your original seller before you can pay. Please contact our team.",
      HISTORICAL_OWNER_REVIEW_REQUIRED: "We need to verify your purchase history before you can pay. Please contact our team."
    };
    return { error: error instanceof Error && error.name === "ZodError" ? "Please check your shipping details and try again." :
      Object.hasOwn(messages, code) ? messages[code] : "We could not open secure payment. No payment was taken by this request. Please try again or contact our team." };
  }
  // Next's redirect throws; keep it outside the error handler. Never mark paid here.
  redirect(paymentUrl);
}
