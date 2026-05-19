import { approveConsultant, createGroupLeader, createPartnerByAdmin, rejectConsultant } from "@/app/(auth)/actions";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { adminNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";

export default async function AdminConsultantsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const params = await searchParams;
  const [pendingConsultants, activeConsultants, partners, groupLeaders] = await Promise.all([
    prisma.user.findMany({
      where: {
        requestedRole: "CONSULTANT",
        status: "PENDING_APPROVAL"
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.consultantProfile.findMany({
      include: { user: true, partnerProfile: true, groupLeaderProfile: true },
      orderBy: { createdAt: "desc" },
      take: 12
    }),
    prisma.partnerProfile.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" }
    }),
    prisma.groupLeaderProfile.findMany({
      include: { user: true, partnerProfile: true },
      orderBy: { createdAt: "desc" }
    })
  ]);
  const partnerById = new Map(partners.map((partner) => [partner.id, partner]));
  const leadersByPartnerId = new Map<string, typeof groupLeaders>();
  groupLeaders.forEach((leader) => {
    const leaders = leadersByPartnerId.get(leader.partnerProfileId) ?? [];
    leaders.push(leader);
    leadersByPartnerId.set(leader.partnerProfileId, leaders);
  });

  return (
    <SidebarShell nav={adminNav} eyebrow="Admin" title="Consultants">
      <div className="space-y-6">
        {params.updated === "partner_created" ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            Partner account created.
          </div>
        ) : null}
        {params.updated === "group_leader_created" ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            Group leader account created.
          </div>
        ) : null}
        {params.error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-clinic-red">
            The requested action could not be completed. Please review the details and try again.
          </div>
        ) : null}

        <Card className="p-6">
          <div>
            <Badge>Admin only</Badge>
            <h2 className="mt-4 text-2xl font-semibold text-clinic-ink">Create partner company</h2>
            <p className="mt-2 max-w-3xl text-slate-600">
              Partners are created only by administrators. Consultants can then select the partner company during registration.
            </p>
          </div>
          <form action={createPartnerByAdmin} className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <input
              name="firstName"
              placeholder="First name"
              className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10"
              required
            />
            <input
              name="lastName"
              placeholder="Last name"
              className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10"
              required
            />
            <input
              name="email"
              type="email"
              placeholder="Partner email"
              className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10"
              required
            />
            <input
              name="password"
              type="password"
              minLength={8}
              placeholder="Temporary password"
              className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10"
              required
            />
            <input
              name="companyName"
              placeholder="Partner company"
              className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10"
              required
            />
            <input
              name="commissionPercent"
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="Partner % of margin"
              defaultValue="12.5"
              className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10"
              required
            />
            <div className="md:col-span-2 xl:col-span-6">
              <SubmitButton variant="accent" pendingText="Creating partner...">Create partner</SubmitButton>
            </div>
          </form>
        </Card>

        <Card className="p-6">
          <div>
            <Badge>Partner hierarchy</Badge>
            <h2 className="mt-4 text-2xl font-semibold text-clinic-ink">Create group leader</h2>
            <p className="mt-2 max-w-3xl text-slate-600">
              Group leaders sit under a partner and can have consultants assigned under them.
            </p>
          </div>
          <form action={createGroupLeader} className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <input name="firstName" placeholder="First name" className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10" required />
            <input name="lastName" placeholder="Last name" className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10" required />
            <input name="email" type="email" placeholder="Leader email" className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10" required />
            <input name="password" type="password" minLength={8} placeholder="Temporary password" className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10" required />
            <select name="partnerProfileId" className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10" required defaultValue="">
              <option value="" disabled>Partner company</option>
              {partners.map((partner) => (
                <option key={partner.id} value={partner.id}>{partner.companyName || partner.displayName}</option>
              ))}
            </select>
            <input name="commissionPercent" type="number" min="0" max="100" step="0.01" placeholder="Leader % of margin" defaultValue="6.25" className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10" required />
            <div className="md:col-span-2 xl:col-span-6">
              <SubmitButton variant="accent" pendingText="Creating leader...">Create group leader</SubmitButton>
            </div>
          </form>
        </Card>

        <Card className="p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Badge>Approval workflow</Badge>
              <h2 className="mt-4 text-2xl font-semibold text-clinic-ink">Pending consultant applications</h2>
              <p className="mt-2 max-w-3xl text-slate-600">
                Consultants can register, but seller access remains locked until a company admin approves them.
                Approval creates their consultant profile, referral slug, and seller permissions.
              </p>
            </div>
            <div className="rounded-xl bg-clinic-mist px-4 py-3 text-center">
              <p className="text-3xl font-semibold text-clinic-navy">{pendingConsultants.length}</p>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Pending</p>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-border p-5">
            <h3 className="text-lg font-semibold text-clinic-ink">Partner companies</h3>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {partners.map((partner) => (
              <div key={partner.id} className="rounded-xl border border-border p-4">
                <p className="font-semibold text-clinic-ink">{partner.companyName || partner.displayName}</p>
                <p className="mt-1 text-sm text-slate-500">{partner.user.email}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Contact: {partner.displayName} · {partner.commissionBps / 100}% margin
                </p>
              </div>
            ))}
            {partners.length === 0 && <p className="text-sm text-slate-500">Partner companies will appear here.</p>}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-border p-5">
            <h3 className="text-lg font-semibold text-clinic-ink">Applications queue</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-clinic-mist text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-5 py-3">Applicant</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Partner company</th>
                  <th className="px-5 py-3">Requested</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {pendingConsultants.map((user) => (
                  <tr key={user.id}>
                    <td className="px-5 py-4 font-semibold text-clinic-ink">
                      {[user.firstName, user.lastName].filter(Boolean).join(" ") || "Unnamed applicant"}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{user.email}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {user.requestedPartnerProfileId
                        ? partnerById.get(user.requestedPartnerProfileId)?.companyName ||
                          partnerById.get(user.requestedPartnerProfileId)?.displayName ||
                          "Unknown partner"
                        : "Not selected"}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{new Intl.DateTimeFormat("en-US").format(user.createdAt)}</td>
                    <td className="px-5 py-4">
                      <Badge className="border-amber-200 bg-amber-50 text-amber-700">Pending approval</Badge>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <form action={rejectConsultant}>
                          <input type="hidden" name="userId" value={user.id} />
                          <input type="hidden" name="reason" value="Application rejected by company admin." />
                          <SubmitButton size="sm" variant="outline" pendingText="Rejecting...">Reject</SubmitButton>
                        </form>
                        <form action={approveConsultant}>
                          <input type="hidden" name="userId" value={user.id} />
                          <select
                            name="partnerProfileId"
                            className="mr-2 h-9 rounded-lg border border-input bg-white px-2 text-xs font-semibold text-clinic-ink"
                            defaultValue={user.requestedPartnerProfileId ?? partners[0]?.id ?? ""}
                          >
                            <option value="">No partner</option>
                            {partners.map((partner) => (
                              <option key={partner.id} value={partner.id}>{partner.companyName || partner.displayName}</option>
                            ))}
                          </select>
                          <select
                            name="groupLeaderProfileId"
                            className="mr-2 h-9 rounded-lg border border-input bg-white px-2 text-xs font-semibold text-clinic-ink"
                            defaultValue=""
                          >
                            <option value="">No leader</option>
                            {groupLeaders.map((leader) => (
                              <option key={leader.id} value={leader.id}>
                                {leader.displayName} · {leader.partnerProfile.companyName || leader.partnerProfile.displayName}
                              </option>
                            ))}
                          </select>
                          <input
                            name="consultantCommissionPercent"
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            defaultValue="12.5"
                            className="mr-2 h-9 w-24 rounded-lg border border-input bg-white px-2 text-xs font-semibold text-clinic-ink"
                            aria-label="Consultant percent of margin"
                          />
                          <SubmitButton size="sm" variant="accent" pendingText="Approving...">Approve</SubmitButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
                {pendingConsultants.length === 0 && (
                  <tr>
                    <td className="px-5 py-8 text-center text-slate-500" colSpan={6}>
                      No consultant applications are waiting for approval.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-border p-5">
            <h3 className="text-lg font-semibold text-clinic-ink">Approved consultants</h3>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {activeConsultants.map((profile) => (
              <div key={profile.id} className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-clinic-ink">
                      {[profile.user.firstName, profile.user.lastName].filter(Boolean).join(" ")}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{profile.user.email}</p>
                  </div>
                  <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Active</Badge>
                </div>
                <div className="mt-4 rounded-lg bg-clinic-mist p-3 text-sm">
                  <p className="font-semibold text-clinic-navy">/c/{profile.referralSlug}</p>
                  <p className="mt-1 text-slate-500">Code: {profile.referralCode}</p>
                  <p className="mt-1 text-slate-500">Partner: {profile.partnerProfile?.companyName ?? profile.partnerProfile?.displayName ?? "Unassigned"}</p>
                  <p className="mt-1 text-slate-500">Leader: {profile.groupLeaderProfile?.displayName ?? "Unassigned"}</p>
                  <p className="mt-1 text-slate-500">Consultant commission: {profile.commissionBps / 100}% of margin</p>
                </div>
              </div>
            ))}
            {activeConsultants.length === 0 && (
              <p className="text-sm text-slate-500">Approved consultants will appear here.</p>
            )}
          </div>
        </Card>
      </div>
    </SidebarShell>
  );
}
