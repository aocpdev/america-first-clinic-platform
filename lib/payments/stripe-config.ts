import { prisma } from "@/lib/db/prisma";

export type StripeEnvironmentMode = "test" | "live";

export type StripeRuntimeConfig = {
  mode: StripeEnvironmentMode;
  secretKey?: string;
  publishableKey?: string;
  webhookSecret?: string;
  configured: boolean;
  webhookConfigured: boolean;
};

export type StripeEnvironmentStatus = {
  testConfigured: boolean;
  testWebhookConfigured: boolean;
  liveConfigured: boolean;
  liveWebhookConfigured: boolean;
};

function envValue(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function secretMode(secretKey?: string) {
  if (secretKey?.startsWith("sk_live_")) return "live";
  if (secretKey?.startsWith("sk_test_")) return "test";
  return undefined;
}

function publishableMode(key?: string) {
  if (key?.startsWith("pk_live_")) return "live";
  if (key?.startsWith("pk_test_")) return "test";
  return undefined;
}

export function normalizeStripeMode(mode?: string | null): StripeEnvironmentMode {
  return mode === "live" ? "live" : "test";
}

export function stripeRuntimeConfig(modeInput?: string | null): StripeRuntimeConfig {
  const mode = normalizeStripeMode(modeInput);
  const legacySecret = envValue("STRIPE_SECRET_KEY");
  const legacyPublishable = envValue("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
  const legacyWebhook = envValue("STRIPE_WEBHOOK_SECRET");
  const legacySecretMode = secretMode(legacySecret);
  const legacyPublishableMode = publishableMode(legacyPublishable);

  const secretKey =
    mode === "live"
      ? envValue("STRIPE_LIVE_SECRET_KEY") ?? (legacySecretMode === "live" ? legacySecret : undefined)
      : envValue("STRIPE_TEST_SECRET_KEY") ?? (legacySecretMode === "test" ? legacySecret : undefined);

  const publishableKey =
    mode === "live"
      ? envValue("NEXT_PUBLIC_STRIPE_LIVE_PUBLISHABLE_KEY") ?? (legacyPublishableMode === "live" ? legacyPublishable : undefined)
      : envValue("NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY") ?? (legacyPublishableMode === "test" ? legacyPublishable : undefined);

  const webhookSecret =
    mode === "live"
      ? envValue("STRIPE_LIVE_WEBHOOK_SECRET") ?? (legacySecretMode === "live" ? legacyWebhook : undefined)
      : envValue("STRIPE_TEST_WEBHOOK_SECRET") ?? (legacySecretMode === "test" ? legacyWebhook : undefined);

  return {
    mode,
    secretKey,
    publishableKey,
    webhookSecret,
    configured: Boolean(secretKey && publishableKey),
    webhookConfigured: Boolean(webhookSecret)
  };
}

export function stripeEnvironmentStatus(): StripeEnvironmentStatus {
  const test = stripeRuntimeConfig("test");
  const live = stripeRuntimeConfig("live");

  return {
    testConfigured: test.configured,
    testWebhookConfigured: test.webhookConfigured,
    liveConfigured: live.configured,
    liveWebhookConfigured: live.webhookConfigured
  };
}

export async function getCompanyStripeMode(companyId?: string | null): Promise<StripeEnvironmentMode> {
  if (!companyId) return "test";

  const provider = await prisma.paymentProvider.findFirst({
    where: { companyId, code: "stripe", isDefault: true },
    select: { mode: true },
    orderBy: { updatedAt: "desc" }
  });

  return normalizeStripeMode(provider?.mode);
}

export async function getCompanyStripeRuntimeConfig(companyId?: string | null) {
  return stripeRuntimeConfig(await getCompanyStripeMode(companyId));
}

export function stripeWebhookConfigs() {
  return [stripeRuntimeConfig("test"), stripeRuntimeConfig("live")].filter(
    (config) => config.secretKey && config.webhookSecret
  );
}

export function stripeRuntimeConfigForEvent(livemode?: boolean, metadataMode?: string | null) {
  return stripeRuntimeConfig(metadataMode ?? (livemode ? "live" : "test"));
}
