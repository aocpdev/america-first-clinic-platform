import Stripe from "stripe";

import { prisma } from "@/lib/db/prisma";
import { getCompanyStripeRuntimeConfig } from "@/lib/payments/stripe-config";

export const payoutRecipientRoles = ["PARTNER", "MANAGER", "GROUP_LEADER", "CONSULTANT"] as const;

export function isPayoutRecipientRole(role: string) {
  return payoutRecipientRoles.includes(role as (typeof payoutRecipientRoles)[number]);
}

function payoutAccountStatus(account: Stripe.Account) {
  const currentlyDue = account.requirements?.currently_due ?? [];
  const pastDue = account.requirements?.past_due ?? [];
  const transfersEnabled = account.capabilities?.transfers === "active";
  return account.details_submitted && transfersEnabled && currentlyDue.length === 0 && pastDue.length === 0
    ? "READY"
    : "ACTION_REQUIRED";
}

export async function syncPayoutAccount(user: { id: string; companyId: string | null }) {
  if (!user.companyId) return null;
  const stored = await prisma.payoutAccount.findUnique({ where: { userId: user.id } });
  if (!stored?.stripeConnectedAccountId) return stored;

  const config = await getCompanyStripeRuntimeConfig(user.companyId);
  if (!config.secretKey) return stored;

  try {
    const stripe = new Stripe(config.secretKey);
    const account = await stripe.accounts.retrieve(stored.stripeConnectedAccountId);
    const bankAccount = account.external_accounts?.data.find((item) => item.object === "bank_account") as Stripe.BankAccount | undefined;
    const status = payoutAccountStatus(account);
    return await prisma.payoutAccount.update({
      where: { id: stored.id },
      data: {
        status,
        detailsSubmitted: account.details_submitted,
        transfersEnabled: account.capabilities?.transfers === "active",
        payoutsEnabled: account.payouts_enabled,
        bankName: bankAccount?.bank_name ?? null,
        bankAccountLast4: bankAccount?.last4 ?? null,
        requirementsCurrentlyDue: account.requirements?.currently_due ?? [],
        requirementsPastDue: account.requirements?.past_due ?? [],
        onboardingCompletedAt: status === "READY" ? stored.onboardingCompletedAt ?? new Date() : null,
        lastSyncedAt: new Date()
      }
    });
  } catch {
    return stored;
  }
}

export async function getPayoutSetup(user: { id: string; companyId: string | null; role: string }, sync = false) {
  if (!isPayoutRecipientRole(user.role) || !user.companyId) return null;
  const account = sync
    ? await syncPayoutAccount(user)
    : await prisma.payoutAccount.findUnique({ where: { userId: user.id } });

  return {
    status: account?.status ?? "NOT_STARTED",
    connected: Boolean(account?.stripeConnectedAccountId),
    detailsSubmitted: account?.detailsSubmitted ?? false,
    transfersEnabled: account?.transfersEnabled ?? false,
    payoutsEnabled: account?.payoutsEnabled ?? false,
    bankName: account?.bankName ?? null,
    bankAccountLast4: account?.bankAccountLast4 ?? null,
    requirementsCount: (account?.requirementsCurrentlyDue.length ?? 0) + (account?.requirementsPastDue.length ?? 0),
    lastSyncedAt: account?.lastSyncedAt ?? null
  };
}
