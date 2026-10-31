import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

// Explicit tenant, read-only transaction, aggregate output only. No Stripe API calls.
let stage = "environment";
async function main() {
  const companySlug = process.argv.find(arg => arg.startsWith("--company="))?.slice(10);
  if (!companySlug) throw new Error("Specify --company=SLUG");
  loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
  stage = "connection";
  const db = new PrismaClient({ log: [] });
  try {
    const report = await db.$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      stage = "company";
      const company = await tx.company.findUniqueOrThrow({ where: { slug: companySlug }, select: { id: true } });
      stage = "provider";
      const provider = await tx.paymentProvider.findFirst({ where: { companyId: company.id, code: "stripe", isDefault: true }, orderBy: { updatedAt: "desc" }, select: { mode: true, active: true } });
      stage = "agency-fee";
      const fee = await tx.agencyFeeSetting.findUnique({ where: { companyId: company.id }, select: { isEnabled: true, feeBps: true, basis: true, stripeConnectedAccountId: true } });
      stage = "settlement-tables";
      const schema = await tx.$queryRaw<Array<{ owner: boolean; commission: boolean }>>`SELECT to_regclass('public."RxCustomerOwner"') IS NOT NULL AS owner, to_regclass('public."RxOrderCommission"') IS NOT NULL AS commission`;
      const legacyLive = process.env.STRIPE_SECRET_KEY?.trim().startsWith("sk_live_");
      const liveKey = process.env.STRIPE_LIVE_SECRET_KEY?.trim() || (legacyLive ? process.env.STRIPE_SECRET_KEY?.trim() : undefined);
      const webhook = process.env.STRIPE_LIVE_WEBHOOK_SECRET?.trim() || (legacyLive ? process.env.STRIPE_WEBHOOK_SECRET?.trim() : undefined);
      return {
        company: companySlug, providerMode: provider?.mode ?? "MISSING", providerActive: provider?.active ?? false,
        localLiveSecretPresent: Boolean(liveKey?.startsWith("sk_live_")), localLiveWebhookPresent: Boolean(webhook?.startsWith("whsec_")),
        agencyFeeEnabled: fee?.isEnabled ?? false, agencyFeePercent: fee ? fee.feeBps / 100 : null,
        agencyFeeBasis: fee?.basis ?? null, agencyFeeDestinationConfigured: Boolean(fee?.stripeConnectedAccountId),
        settlementTablesPresent: schema[0],
        note: "Local environment credentials only; deployed credentials and Stripe account capabilities are not verified. No writes or payment API calls."
      };
    }, { timeout: 15000 });
    console.log(JSON.stringify(report, null, 2));
  } finally { await db.$disconnect(); }
}
main().catch(error => {
  const code = error && typeof error.code === "string" && /^P\d{4}$/.test(error.code) ? error.code : "UNAVAILABLE";
  console.error(`Read-only payment readiness audit failed at ${stage} (${code}). No credentials or patient data were printed.`);
  process.exitCode = 1;
});
