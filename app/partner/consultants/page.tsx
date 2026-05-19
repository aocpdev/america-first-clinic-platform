import { approveConsultant, createConsultantByAdmin, createGroupLeader, rejectConsultant, startImpersonation } from "@/app/(auth)/actions";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { SalesHierarchyView } from "@/components/network/sales-hierarchy-view";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { partnerNav } from "@/lib/constants/navigation";
import { requirePartner } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { buildSalesHierarchyTree } from "@/lib/network/sales-hierarchy";

export default async function PartnerConsultantsPage() {
  const user = await requirePartner();
  const partnerProfile = await prisma.partnerProfile.findUnique({
    where: { userId: user.id },
    include: { user: true }
  });
  const groupLeaderProfile = await prisma.groupLeaderProfile.findUnique({
    where: { userId: user.id },
    include: {
      user: true,
      partnerProfile: {
        include: { user: true }
      }
    }
  });
  const effectivePartnerProfileId = partnerProfile?.id ?? groupLeaderProfile?.partnerProfileId ?? null;
  const [pendingConsultants, consultants, groupLeaders, hierarchyOrders] = effectivePartnerProfileId
    ? await Promise.all([
        prisma.user.findMany({
          where: {
            requestedRole: "CONSULTANT",
            status: "PENDING_APPROVAL",
            requestedPartnerProfileId: effectivePartnerProfileId,
            ...(groupLeaderProfile ? { requestedGroupLeaderProfileId: groupLeaderProfile.id } : {})
          },
          orderBy: { createdAt: "desc" }
        }),
        prisma.consultantProfile.findMany({
          where: {
            partnerProfileId: effectivePartnerProfileId,
            ...(groupLeaderProfile ? { groupLeaderProfileId: groupLeaderProfile.id } : {})
          },
          include: { user: true, groupLeaderProfile: true },
          orderBy: { createdAt: "desc" }
        }),
        prisma.groupLeaderProfile.findMany({
          where: { partnerProfileId: effectivePartnerProfileId },
          include: { user: true },
          orderBy: { createdAt: "desc" }
        }),
        prisma.order.findMany({
          where: groupLeaderProfile
            ? {
                OR: [
                  { groupLeaderProfileId: groupLeaderProfile.id },
                  { consultantProfile: { groupLeaderProfileId: groupLeaderProfile.id } }
                ]
              }
            : {
                OR: [
                  { partnerProfileId: effectivePartnerProfileId },
                  { consultantProfile: { partnerProfileId: effectivePartnerProfileId } }
                ]
              },
          select: {
            totalCents: true,
            partnerProfileId: true,
            groupLeaderProfileId: true,
            consultantProfileId: true,
            consultantProfile: {
              select: {
                partnerProfileId: true,
                groupLeaderProfileId: true
              }
            },
            commissionSplits: {
              select: {
                participantRole: true,
                amountCents: true,
                partnerProfileId: true,
                groupLeaderProfileId: true,
                consultantProfileId: true
              }
            }
          }
        })
      ])
    : [[], [], [], []];
  const hierarchyPartner = partnerProfile ?? groupLeaderProfile?.partnerProfile ?? null;
  const hierarchyTree = hierarchyPartner
    ? buildSalesHierarchyTree({
        partner: hierarchyPartner,
        groupLeaders,
        consultants,
        orders: hierarchyOrders,
        visibleGroupLeaderId: groupLeaderProfile?.id ?? null,
        hidePartnerFinancials: Boolean(groupLeaderProfile),
        hideCommissionSetup: Boolean(groupLeaderProfile)
      })
    : null;

  return (
    <SidebarShell nav={partnerNav} eyebrow={user.role === "GROUP_LEADER" ? "Group leader" : "Partner"} title="My consultants">
      <div className="space-y-6">
        {partnerProfile && (
          <Card className="p-6">
            <div>
              <Badge>Team structure</Badge>
              <h2 className="mt-4 text-2xl font-semibold text-clinic-ink">Create group leader</h2>
              <p className="mt-2 max-w-3xl text-slate-600">Leaders manage a smaller group of consultants inside your partner organization.</p>
            </div>
            <form action={createGroupLeader} className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <input name="firstName" placeholder="First name" className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10" required />
              <input name="lastName" placeholder="Last name" className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10" required />
              <input name="email" type="email" placeholder="Leader email" className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10" required />
              <input name="password" type="password" minLength={8} placeholder="Temporary password" className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10" required />
              <input name="commissionPercent" type="number" min="0" max="100" step="0.01" placeholder="% of partner pool" defaultValue="25" className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10" required />
              <div className="md:col-span-2 xl:col-span-5">
                <SubmitButton variant="accent" pendingText="Creating leader...">Create group leader</SubmitButton>
              </div>
            </form>
          </Card>
        )}

        {partnerProfile && (
          <Card className="overflow-hidden">
            <div className="border-b border-border p-5">
              <h2 className="text-lg font-semibold text-clinic-ink">Group leaders</h2>
              <p className="mt-1 text-sm text-slate-500">Leaders roll up to your partner dashboard and can have consultants assigned.</p>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
              {groupLeaders.map((leader) => (
                <div key={leader.id} className="rounded-xl border border-border p-4">
                  <p className="font-semibold text-clinic-ink">{leader.displayName}</p>
                  <p className="mt-1 text-sm text-slate-500">{leader.user.email}</p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {leader.commissionBps / 100}% of partner pool
                  </p>
                  <form action={startImpersonation} className="mt-4">
                    <input type="hidden" name="targetUserId" value={leader.userId} />
                    <SubmitButton size="sm" variant="outline" pendingText="Opening...">View as leader</SubmitButton>
                  </form>
                </div>
              ))}
              {groupLeaders.length === 0 && <p className="text-sm text-slate-500">No group leaders have been created yet.</p>}
            </div>
          </Card>
        )}

        {partnerProfile && (
          <Card className="p-6">
            <div>
              <Badge>Consultants</Badge>
              <h2 className="mt-4 text-2xl font-semibold text-clinic-ink">Create consultant</h2>
              <p className="mt-2 max-w-3xl text-slate-600">
                Add a seller directly under your partner account or assign them to a group leader.
              </p>
            </div>
            <form action={createConsultantByAdmin} className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <input type="hidden" name="partnerProfileId" value={partnerProfile.id} />
              <input name="firstName" placeholder="First name" className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10" required />
              <input name="lastName" placeholder="Last name" className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10" required />
              <input name="email" type="email" placeholder="Consultant email" className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10" required />
              <input name="password" type="password" minLength={8} placeholder="Temporary password" className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10" required />
              <select name="groupLeaderProfileId" className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10" defaultValue="">
                <option value="">Direct partner</option>
                {groupLeaders.map((leader) => (
                  <option key={leader.id} value={leader.id}>{leader.displayName}</option>
                ))}
              </select>
              <input name="consultantCommissionPercent" type="number" min="0" max="100" step="0.01" defaultValue="50" placeholder="% of partner pool" className="h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10" required />
              <div className="md:col-span-2 xl:col-span-6">
                <SubmitButton variant="accent" pendingText="Creating consultant...">Create consultant</SubmitButton>
              </div>
            </form>
          </Card>
        )}

        {hierarchyTree ? (
          <SalesHierarchyView
            tree={hierarchyTree}
            title={groupLeaderProfile ? "My team hierarchy" : "Partner hierarchy"}
          />
        ) : null}

        <Card className="overflow-hidden">
          <div className="border-b border-border p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-clinic-ink">Pending consultant applications</h2>
                <p className="mt-1 text-sm text-slate-500">
                  These sellers selected {partnerProfile?.companyName ?? partnerProfile?.displayName ?? "your company"} during registration.
                </p>
              </div>
              <Badge className="w-fit border-amber-200 bg-amber-50 text-amber-700">{pendingConsultants.length} pending</Badge>
            </div>
          </div>
          <div className="divide-y divide-border bg-white">
            {pendingConsultants.map((applicant) => (
              <div key={applicant.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-semibold text-clinic-ink">
                    {[applicant.firstName, applicant.lastName].filter(Boolean).join(" ") || "Unnamed applicant"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{applicant.email}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Requested {new Intl.DateTimeFormat("en-US").format(applicant.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={rejectConsultant}>
                    <input type="hidden" name="userId" value={applicant.id} />
                    <input type="hidden" name="reason" value="Application rejected by partner." />
                    <SubmitButton size="sm" variant="outline" pendingText="Rejecting...">Reject</SubmitButton>
                  </form>
                  <form action={approveConsultant}>
                    <input type="hidden" name="userId" value={applicant.id} />
                    {groupLeaderProfile ? (
                      <input type="hidden" name="groupLeaderProfileId" value={groupLeaderProfile.id} />
                    ) : (
                      <select
                        name="groupLeaderProfileId"
                        className="h-9 rounded-lg border border-input bg-white px-2 text-xs font-semibold text-clinic-ink"
                        defaultValue=""
                      >
                        <option value="">No leader</option>
                        {groupLeaders.map((leader) => (
                          <option key={leader.id} value={leader.id}>{leader.displayName}</option>
                        ))}
                      </select>
                    )}
                    {partnerProfile ? (
                      <input
                        name="consultantCommissionPercent"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        defaultValue="50"
                        className="h-9 w-24 rounded-lg border border-input bg-white px-2 text-xs font-semibold text-clinic-ink"
                        aria-label="Consultant share of partner pool"
                      />
                    ) : null}
                    <SubmitButton size="sm" variant="accent" pendingText="Approving...">Approve</SubmitButton>
                  </form>
                </div>
              </div>
            ))}
            {pendingConsultants.length === 0 && (
              <p className="p-5 text-sm text-slate-500">No consultant applications are waiting for your approval.</p>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-border p-5">
            <h2 className="text-lg font-semibold text-clinic-ink">Assigned seller network</h2>
            <p className="mt-1 text-sm text-slate-500">These consultants roll up to your partner dashboard and payout queue.</p>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {consultants.map((profile) => (
              <div key={profile.id} className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-clinic-ink">{[profile.user.firstName, profile.user.lastName].filter(Boolean).join(" ")}</p>
                    <p className="mt-1 text-sm text-slate-500">{profile.user.email}</p>
                  </div>
                  <Badge>Consultant</Badge>
                </div>
                <p className="mt-4 rounded-lg bg-clinic-mist p-3 text-sm font-semibold text-clinic-navy">/c/{profile.referralSlug}</p>
                <p className="mt-3 text-sm text-slate-500">Leader: {profile.groupLeaderProfile?.displayName ?? "Unassigned"}</p>
                {partnerProfile ? (
                  <>
                    <p className="mt-1 text-sm text-slate-500">Consultant commission: {profile.commissionBps / 100}% of partner pool</p>
                    <form action={startImpersonation} className="mt-4">
                      <input type="hidden" name="targetUserId" value={profile.userId} />
                      <SubmitButton size="sm" variant="outline" pendingText="Opening...">View as consultant</SubmitButton>
                    </form>
                  </>
                ) : null}
              </div>
            ))}
            {consultants.length === 0 && <p className="text-sm text-slate-500">No consultants are assigned to this partner yet.</p>}
          </div>
        </Card>
      </div>
    </SidebarShell>
  );
}
