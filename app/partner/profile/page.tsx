import { SidebarShell } from "@/components/layout/sidebar-shell";
import { ProfileSettings } from "@/components/profile/profile-settings";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { groupLeaderNav, partnerNav } from "@/lib/constants/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { updatePartnerBankAccount, updatePartnerCompany } from "@/app/profile/actions";
import { prisma } from "@/lib/db/prisma";
import { BadgeCheck, Landmark, LockKeyhole, ShieldCheck, WalletCards } from "lucide-react";

function maskLast4(value?: string | null) {
  return value ? `•••• ${value}` : "Not connected";
}

async function getPartnerBankAccount(partnerProfileId?: string | null) {
  if (!partnerProfileId) return null;
  try {
    return await prisma.partnerBankAccount.findUnique({ where: { partnerProfileId } });
  } catch {
    return null;
  }
}

export default async function PartnerProfilePage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const isGroupLeader = user.role === "GROUP_LEADER";
  const nav = isGroupLeader ? groupLeaderNav : partnerNav;
  const partnerProfile = await prisma.partnerProfile.findUnique({ where: { userId: user.id } });
  const bankAccount = await getPartnerBankAccount(partnerProfile?.id);

  return (
    <SidebarShell nav={nav} eyebrow={isGroupLeader ? "Group leader" : "Partner"} title="Profile">
      <ProfileSettings
        user={user}
        title={isGroupLeader ? "Leader profile" : "Partner profile"}
        description={isGroupLeader ? "Manage your personal CRM profile and account settings." : "Manage the partner identity used for assigned agent visibility, commission reporting, and internal activity."}
        error={params.error}
        updated={params.updated}
      >
        {!isGroupLeader ? <Card className="p-6 shadow-sm">
          <div>
            <h3 className="text-lg font-semibold text-clinic-ink">Partner company</h3>
            <p className="mt-1 text-sm text-slate-500">
              Agents will select this company name when requesting access.
            </p>
          </div>
          <form action={updatePartnerCompany} className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              name="companyName"
              defaultValue={partnerProfile?.companyName ?? partnerProfile?.displayName ?? ""}
              placeholder="Company name"
              className="h-11 flex-1 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10"
              required
            />
            <SubmitButton>Save company</SubmitButton>
          </form>
        </Card> : null}

        {!isGroupLeader ? (
          <section className="overflow-hidden rounded-[32px] border border-white/70 bg-white/80 shadow-[0_24px_80px_rgba(15,35,60,0.10)] backdrop-blur-xl">
            <div className="border-b border-white/70 bg-gradient-to-br from-white via-slate-50 to-blue-50/70 p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="grid size-14 shrink-0 place-items-center rounded-[24px] bg-white text-clinic-navy shadow-sm ring-1 ring-blue-100">
                    <Landmark className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-clinic-red">Partner payout banking</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-clinic-ink">Bank account for partner payouts</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                      Add the account where Go Virtual Health will send partner payout packets. The CRM stores encrypted bank details and only displays the last four digits.
                    </p>
                  </div>
                </div>
                <div className="rounded-[24px] border border-emerald-100 bg-white/75 px-5 py-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                    <BadgeCheck className="h-4 w-4" />
                    {bankAccount ? "Ready for admin payout" : "Bank setup needed"}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {bankAccount
                      ? `${bankAccount.bankName || "Bank account"} ${maskLast4(bankAccount.accountLast4)}`
                      : "Add banking before the admin can send funds."}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 p-6 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-4">
                <div className="rounded-[28px] border border-border bg-white/80 p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="grid size-11 place-items-center rounded-2xl bg-clinic-mist text-clinic-navy">
                      <WalletCards className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Current destination</p>
                      <p className="mt-1 text-lg font-semibold text-clinic-ink">{maskLast4(bankAccount?.accountLast4)}</p>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-clinic-mist/80 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Routing</p>
                      <p className="mt-2 font-semibold text-clinic-navy">{maskLast4(bankAccount?.routingLast4)}</p>
                    </div>
                    <div className="rounded-2xl bg-emerald-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Status</p>
                      <p className="mt-2 font-semibold text-emerald-700">{bankAccount?.status ?? "Not ready"}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[28px] border border-blue-100 bg-blue-50/70 p-5">
                  <div className="flex items-start gap-3">
                    <LockKeyhole className="mt-0.5 h-5 w-5 text-clinic-navy" />
                    <p className="text-sm leading-6 text-slate-600">
                      Bank numbers are encrypted before they are stored. Admins and partners see only the final four digits for reconciliation.
                    </p>
                  </div>
                </div>
              </div>

              <form action={updatePartnerBankAccount} className="grid gap-4 rounded-[28px] border border-border bg-white/85 p-5 shadow-sm md:grid-cols-2">
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-semibold text-clinic-ink">Account holder name</span>
                  <input
                    name="accountHolderName"
                    defaultValue={bankAccount?.accountHolderName ?? partnerProfile?.companyName ?? partnerProfile?.displayName ?? ""}
                    required
                    className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-clinic-ink">Account type</span>
                  <select
                    name="accountHolderType"
                    defaultValue={bankAccount?.accountHolderType ?? "company"}
                    className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10"
                  >
                    <option value="company">Business</option>
                    <option value="individual">Individual</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-clinic-ink">Bank name</span>
                  <input
                    name="bankName"
                    defaultValue={bankAccount?.bankName ?? ""}
                    placeholder="Chase, Bank of America..."
                    className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-clinic-ink">Routing number</span>
                  <input
                    name="routingNumber"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={9}
                    placeholder={bankAccount ? "Enter to replace" : "9 digits"}
                    required
                    className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-clinic-ink">Account number</span>
                  <input
                    name="accountNumber"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder={bankAccount ? "Enter to replace" : "Account number"}
                    required
                    className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10"
                  />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-semibold text-clinic-ink">Confirm account number</span>
                  <input
                    name="confirmAccountNumber"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Re-enter account number"
                    required
                    className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10"
                  />
                </label>
                <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600 md:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="inline-flex items-center gap-2 font-semibold text-clinic-navy">
                    <ShieldCheck className="h-4 w-4" />
                    Encrypted payout destination
                  </span>
                  <SubmitButton pendingText="Securing bank...">Save bank account</SubmitButton>
                </div>
              </form>
            </div>
          </section>
        ) : null}
      </ProfileSettings>
    </SidebarShell>
  );
}
