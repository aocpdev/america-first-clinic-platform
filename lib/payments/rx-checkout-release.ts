/** Release interlock, deliberately independent of environment flags. Set true only
 * after the RX webhook, durable agency-fee/refund dispatcher, clinical notifications,
 * deployment migration, shipping/tax policy and real customer auth are verified.
 * A flag alone must not expose charges to the existing legacy webhook. */
export const RX_CHECKOUT_RELEASE_READY = false;

// Enable processing before accepting new charges; disabling checkout must not stop
// settlement of previously accepted payments or their refunds.
export function rxWebhookCanProcess(env: Record<string, string | undefined> = process.env) {
  return env.RX_WEBHOOK_PROCESSING_ENABLED === "true" && !env.LOCAL_CATALOG_SOURCE_URL;
}

export function rxCheckoutCanCharge(env: Record<string, string | undefined> = process.env) {
  // Disabling referral handling must not silently turn first referred purchases
  // into DIRECT acquisitions. Payment activation requires attribution routing too.
  return RX_CHECKOUT_RELEASE_READY && rxWebhookCanProcess(env) && env.RX_PAID_CHECKOUT_ENABLED === "true" &&
    env.RX_REFERRALS_ENABLED === "true" && env.RX_STOREFRONT_ENABLED === "true" && env.CUSTOMER_PORTAL_ENABLED === "true" && !env.LOCAL_CATALOG_SOURCE_URL;
}
