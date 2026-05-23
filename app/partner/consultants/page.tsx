import Link from "next/link";
import { approveConsultant, rejectConsultant } from "@/app/(auth)/actions";
import { AssignConsultantModal } from "@/app/admin/consultants/assign-consultant-modal";
import { CreateConsultantModal } from "@/app/admin/consultants/create-consultant-modal";
import { EditConsultantModal } from "@/app/admin/consultants/edit-consultant-modal";
import { CreateLeaderModal, EditLeaderModal } from "@/app/admin/consultants/leader-section";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { SalesHierarchyView } from "@/components/network/sales-hierarchy-view";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { groupLeaderNav, partnerNav } from "@/lib/constants/navigation";
import { requirePartner } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { buildSalesHierarchyTree, percentLabel } from "@/lib/network/sales-hierarchy";

function displayName(user: { firstName: string | null; lastName: string | null; email: string }) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email;
}

function initialsFromName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default async function PartnerConsultantsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const params = await searchParams;
  const user = await requirePartner();
  const isGroupLeader = user.role === "GROUP_LEADER";
  const nav = isGroupLeader ? groupLeaderNav : partnerNav;
  const errorMessages: Record<string, string> = {
    duplicate_email: "That email is already assigned to another partner, leader, or consultant.",
    duplicate_phone: "That phone number is already assigned to another partner, leader, or consultant.",
    invalid_group_leader: "That leader does not belong to your partner network.",
    application_not_found: "That application could not be found or has already been processed.",
    consultant_not_found: "That consultant could not be found.",
    access_denied: "You do not have permission to move that seller."
  };

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
            requestedRole: groupLeaderProfile ? "CONSULTANT" : { in: ["CONSULTANT", "GROUP_LEADER"] },
            status: "PENDING_APPROVAL",
            requestedPartnerProfileId: effectivePartnerProfileId,
            ...(groupLeaderProfile ? { requestedGroupLeaderProfileId: groupLeaderProfile.id } : {})
          },
          orderBy: { createdAt: "desc" }
        }),
        prisma.consultantProfile.findMany({
          where: {
            partnerProfileId: effectivePartnerProfileId,
            user: { is: { role: "CONSULTANT" } },
            ...(groupLeaderProfile ? { groupLeaderProfileId: groupLeaderProfile.id } : {})
          },
          include: { user: true, groupLeaderProfile: true },
          orderBy: { createdAt: "desc" }
        }),
        prisma.groupLeaderProfile.findMany({
          where: groupLeaderProfile
            ? { id: groupLeaderProfile.id }
            : { partnerProfileId: effectivePartnerProfileId, user: { is: { role: "GROUP_LEADER" } } },
          include: { user: true },
          orderBy: { displayName: "asc" }
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
  const groupLeaderOptions = groupLeaders.map((leader) => ({
    id: leader.id,
    displayName: leader.displayName
  }));

  return (
    <SidebarShell nav={nav} eyebrow={isGroupLeader ? "Group leader" : "Partner"} title={isGroupLeader ? "Team" : "Partner network"}>
      <div className="space-y-6">
        {params.updated ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            Network updated successfully.
          </div>
        ) : null}
        {params.error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-clinic-red">
            {errorMessages[params.error] ?? "The requested action could not be completed. Please review the details and try again."}
          </div>
        ) : null}

        {!effectivePartnerProfileId ? (
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-clinic-ink">Profile setup required</h2>
            <p className="mt-2 text-slate-600">An owner must assign your partner or leader profile before team data appears here.</p>
          </Card>
        ) : null}

        {hierarchyTree ? (
          <SalesHierarchyView
            tree={hierarchyTree}
            title={isGroupLeader ? `${groupLeaderProfile?.displayName ?? "My"} hierarchy` : `${partnerProfile?.companyName ?? partnerProfile?.displayName ?? "Partner"} hierarchy`}
          />
        ) : null}

        {partnerProfile ? (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-clinic-ink">Group leaders</h2>
                <p className="mt-1 text-sm text-slate-500">Manage how your partner pool is shared with leaders and assigned sellers.</p>
              </div>
              <CreateLeaderModal partnerProfileId={partnerProfile.id} />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {groupLeaders.map((leader) => {
                const leaderConsultants = consultants.filter((profile) => profile.groupLeaderProfileId === leader.id);

                return (
                  <Card
                    key={leader.id}
                    className="rounded-3xl border border-border bg-white p-5 shadow-line transition hover:-translate-y-0.5 hover:border-clinic-navy/30 hover:shadow-soft"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="grid size-12 shrink-0 place-items-center rounded-2xl border border-border bg-clinic-mist bg-cover bg-center text-sm font-bold text-clinic-navy"
                          style={leader.user.avatarUrl ? { backgroundImage: `url(${leader.user.avatarUrl})` } : undefined}
                          aria-label={`${leader.displayName} avatar`}
                        >
                          {leader.user.avatarUrl ? null : initialsFromName(leader.displayName)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-lg font-semibold text-clinic-ink">{leader.displayName}</p>
                          <p className="mt-1 truncate text-sm text-slate-500">{leader.user.email}</p>
                        </div>
                      </div>
                      <Badge className="border-blue-100 bg-blue-50 text-clinic-navy">{percentLabel(leader.commissionBps)}</Badge>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs font-semibold text-slate-500">
                      <div className="rounded-2xl bg-clinic-mist px-2 py-3">
                        <p className="text-2xl text-clinic-navy">{percentLabel(leader.commissionBps)}</p>
                        <p className="mt-1">Direct pool</p>
                      </div>
                      <div className="rounded-2xl bg-blue-50 px-2 py-3">
                        <p className="text-2xl text-clinic-navy">{percentLabel(leader.consultantOverrideBps)}</p>
                        <p className="mt-1">Override pool</p>
                      </div>
                      <div className="rounded-2xl bg-clinic-mist px-2 py-3">
                        <p className="text-2xl text-clinic-navy">{leaderConsultants.length}</p>
                        <p className="mt-1">Sellers</p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                      <Link
                        href="/partner/consultants"
                        className="inline-flex h-9 items-center rounded-xl border border-border bg-white px-3 text-sm font-semibold text-clinic-ink transition hover:bg-clinic-mist"
                      >
                        View hierarchy
                      </Link>
                      <EditLeaderModal leader={leader} returnTo="/partner/consultants?section=leaders" />
                    </div>
                  </Card>
                );
              })}
              {groupLeaders.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border bg-white p-6 md:col-span-2 xl:col-span-3">
                  <h3 className="text-lg font-semibold text-clinic-ink">No group leaders yet</h3>
                  <p className="mt-2 text-sm text-slate-500">Create leaders when you are ready to organize consultants by group.</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {partnerProfile ? (
          <Card className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Seller network</p>
                <h3 className="mt-2 text-2xl font-semibold text-clinic-ink">Consultants</h3>
                <p className="mt-1 text-sm text-slate-500">Create sellers directly under your partner account or assign them to a group leader.</p>
              </div>
              <CreateConsultantModal
                partnerProfileId={partnerProfile.id}
                groupLeaders={groupLeaderOptions}
                returnTo="/partner/consultants?updated=consultant_created"
              />
            </div>
          </Card>
        ) : null}

        {partnerProfile ? (
          <Card className="p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Assignment control</p>
                <h3 className="mt-2 text-2xl font-semibold text-clinic-ink">Seller placement</h3>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                  Move sellers between direct partner ownership and your group leaders. Leaders can view their team but cannot reassign sellers.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[420px]">
                <div className="rounded-2xl border border-border bg-clinic-mist px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Direct partner</p>
                  <p className="mt-2 text-2xl font-semibold text-clinic-navy">
                    {consultants.filter((profile) => !profile.groupLeaderProfileId).length}
                  </p>
                </div>
                {groupLeaders.slice(0, 3).map((leader) => (
                  <div key={leader.id} className="rounded-2xl border border-border bg-white px-4 py-3">
                    <p className="truncate text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{leader.displayName}</p>
                    <p className="mt-2 text-2xl font-semibold text-clinic-navy">
                      {consultants.filter((profile) => profile.groupLeaderProfileId === leader.id).length}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ) : null}

        {partnerProfile ? (
          <Card className="overflow-hidden">
            <div className="border-b border-border p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Badge>Approval workflow</Badge>
                  <h2 className="mt-4 text-2xl font-semibold text-clinic-ink">Pending applications</h2>
                </div>
                <Badge className="w-fit border-amber-200 bg-amber-50 text-amber-700">{pendingConsultants.length} pending</Badge>
              </div>
            </div>
            <div className="divide-y divide-border bg-white">
              {pendingConsultants.map((applicant) => {
                const isLeaderApplication = applicant.requestedRole === "GROUP_LEADER";
                return (
                  <div key={applicant.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-clinic-ink">{displayName(applicant)}</p>
                        <Badge className={isLeaderApplication ? "border-blue-100 bg-blue-50 text-clinic-navy" : "border-emerald-100 bg-emerald-50 text-emerald-700"}>
                          {isLeaderApplication ? "Group leader" : "Seller"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{applicant.email}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <form action={rejectConsultant}>
                        <input type="hidden" name="userId" value={applicant.id} />
                        <input type="hidden" name="reason" value="Application rejected by partner." />
                        <SubmitButton size="sm" variant="outline" pendingText="Rejecting...">Reject</SubmitButton>
                      </form>
                      <form action={approveConsultant} className="flex flex-wrap justify-end gap-2">
                        <input type="hidden" name="userId" value={applicant.id} />
                        {isLeaderApplication ? (
                          <>
                            <input
                              name="leaderCommissionPercent"
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              defaultValue="25"
                              className="h-9 w-32 rounded-lg border border-input bg-white px-2 text-xs font-semibold text-clinic-ink"
                              aria-label="Leader direct share of partner pool"
                            />
                            <input
                              name="consultantOverridePercent"
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              defaultValue="0"
                              className="h-9 w-32 rounded-lg border border-input bg-white px-2 text-xs font-semibold text-clinic-ink"
                              aria-label="Leader override from consultant sales"
                            />
                          </>
                        ) : (
                          <>
                            <select
                              name="groupLeaderProfileId"
                              className="h-9 rounded-lg border border-input bg-white px-2 text-xs font-semibold text-clinic-ink"
                              defaultValue={applicant.requestedGroupLeaderProfileId ?? ""}
                            >
                              <option value="">Direct partner</option>
                              {groupLeaders.map((leader) => (
                                <option key={leader.id} value={leader.id}>{leader.displayName}</option>
                              ))}
                            </select>
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
                          </>
                        )}
                        <SubmitButton size="sm" variant="accent" pendingText="Approving...">Approve</SubmitButton>
                      </form>
                    </div>
                  </div>
                );
              })}
              {pendingConsultants.length === 0 ? (
                <p className="p-5 text-sm text-slate-500">No applications are waiting for approval.</p>
              ) : null}
            </div>
          </Card>
        ) : null}

        <Card className="overflow-hidden">
          <div className="border-b border-border p-5">
            <Badge>{isGroupLeader ? "My team" : "Seller network"}</Badge>
            <h3 className="mt-4 text-2xl font-semibold text-clinic-ink">Consultants</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-clinic-mist text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-5 py-3">Consultant</th>
                  <th className="px-5 py-3">Leader</th>
                  <th className="px-5 py-3">Referral</th>
                  {partnerProfile ? <th className="px-5 py-3">Pool share</th> : null}
                  {partnerProfile ? <th className="px-5 py-3 text-right">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {consultants.map((profile) => (
                  <tr key={profile.id}>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-clinic-ink">{displayName(profile.user)}</p>
                      <p className="mt-1 text-xs text-slate-500">{profile.user.email}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{profile.groupLeaderProfile?.displayName ?? "Direct partner"}</td>
                    <td className="px-5 py-4 font-semibold text-clinic-navy">/c/{profile.referralSlug}</td>
                    {partnerProfile ? <td className="px-5 py-4">{percentLabel(profile.commissionBps)} of partner pool</td> : null}
                    {partnerProfile ? (
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <AssignConsultantModal
                            consultant={{
                              id: profile.id,
                              name: displayName(profile.user),
                              email: profile.user.email,
                              avatarUrl: profile.user.avatarUrl,
                              groupLeaderProfileId: profile.groupLeaderProfileId
                            }}
                            partnerProfileId={partnerProfile.id}
                            groupLeaders={groupLeaderOptions}
                            returnTo="/partner/consultants?updated=assignment_updated"
                          />
                          <EditConsultantModal
                            consultant={{
                              id: profile.id,
                              firstName: profile.user.firstName,
                              lastName: profile.user.lastName,
                              email: profile.user.email,
                              phone: profile.user.phone,
                              groupLeaderProfileId: profile.groupLeaderProfileId,
                              commissionPercent: profile.commissionBps / 100
                            }}
                            partnerProfileId={partnerProfile.id}
                            groupLeaders={groupLeaderOptions}
                            returnTo="/partner/consultants?updated=consultant_updated"
                          />
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
                {consultants.length === 0 ? (
                  <tr>
                    <td colSpan={partnerProfile ? 5 : 3} className="px-5 py-8 text-center text-slate-500">
                      No consultants are assigned yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </SidebarShell>
  );
}
