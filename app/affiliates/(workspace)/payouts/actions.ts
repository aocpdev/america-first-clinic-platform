"use server";

import Stripe from "stripe";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireAffiliateSession } from "@/lib/referrals/affiliate-session";
import { getAffiliatePayoutRecipient } from "@/lib/referrals/affiliate-payout-recipient";
import { affiliatePayoutReturnBase } from "@/lib/referrals/affiliate-workspace-policy";
import { getCompanyStripeRuntimeConfig } from "@/lib/payments/stripe-config";

export async function startAffiliatePayoutSetup() {
  const affiliate = await requireAffiliateSession();
  if (process.env.AFFILIATE_PAYOUT_SETUP_ENABLED !== "true") notFound();
  const user = await getAffiliatePayoutRecipient(affiliate);
  if (!user) redirect("/affiliates/payouts?error=unavailable");
  let destination: string;
  try {
    const config = await getCompanyStripeRuntimeConfig(affiliate.companyId);
    if (!config.secretKey) throw new Error("PROCESSOR_UNAVAILABLE");
    const base = affiliatePayoutReturnBase(process.env.AFFILIATE_PORTAL_URL, config.mode === "live");
    const stripe = new Stripe(config.secretKey);
    let stored = await prisma.payoutAccount.findUnique({ where: { userId: user.id } });
    if (stored && stored.companyId !== affiliate.companyId) throw new Error("INVALID_RECIPIENT");
    if (!stored?.stripeConnectedAccountId) {
      const account = await stripe.accounts.create({ type: "express", country: "US",
        email: affiliate.email, business_profile: { name: affiliate.displayName },
        capabilities: { transfers: { requested: true } },
        metadata: { companyId: affiliate.companyId, userId: user.id, affiliateId: affiliate.id,
          source: "affiliate_payout_setup", stripeMode: config.mode } },
      { idempotencyKey: `affiliate-recipient-v1-${affiliate.companyId}-${user.id}-${config.mode}` });
      stored = await prisma.$transaction(async tx => {
        const record = await tx.payoutAccount.upsert({ where: { userId: user.id },
          create: { userId: user.id, companyId: affiliate.companyId, stripeConnectedAccountId: account.id,
            status: "ACTION_REQUIRED", onboardingStartedAt: new Date() },
          update: {} });
        if (record.companyId !== affiliate.companyId) throw new Error("INVALID_RECIPIENT");
        if (!record.stripeConnectedAccountId) {
          await tx.payoutAccount.updateMany({ where: { id: record.id, companyId: affiliate.companyId,
            stripeConnectedAccountId: null }, data: { stripeConnectedAccountId: account.id,
            status: "ACTION_REQUIRED", onboardingStartedAt: record.onboardingStartedAt ?? new Date() } });
        }
        await tx.auditLog.create({ data: { companyId: affiliate.companyId, userId: user.id,
          resource: "AffiliateProfile", resourceId: affiliate.id, action: "AFFILIATE_PAYOUT_SETUP_STARTED" } });
        return tx.payoutAccount.findUniqueOrThrow({ where: { id: record.id } });
      });
    }
    const link = await stripe.accountLinks.create({ account: stored.stripeConnectedAccountId!, type: "account_onboarding",
      refresh_url: `${base}/affiliates/payouts?setup=refresh`, return_url: `${base}/affiliates/payouts?setup=returned` });
    destination = link.url;
  } catch { redirect("/affiliates/payouts?error=unavailable"); }
  redirect(destination);
}
