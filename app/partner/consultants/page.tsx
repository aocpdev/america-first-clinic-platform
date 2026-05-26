import Link from "next/link";
import { approveConsultant, rejectConsultant } from "@/app/(auth)/actions";
import { AssignConsultantModal } from "@/app/admin/consultants/assign-consultant-modal";
import { CreateConsultantModal } from "@/app/admin/consultants/create-consultant-modal";
import { EditConsultantModal } from "@/app/admin/consultants/edit-consultant-modal";
import { CreateLeaderModal, EditLeaderModal } from "@/app/admin/consultants/leader-section";
import { ManagerSection } from "@/app/admin/consultants/manager-section";
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

const partnerSections = [
  { id: "hierarchy", label: "Hierarchy" },
  { id: "profile", label: "Partner Profile" },
  { id: "managers", label: "Managers" },
  { id: "leaders", label: "Leaders" },
  { id: "approval", label: "Approval workflow" },
  { id: "network", label: "Seller Network" }
] as const;

const leaderSections = [
  { id: "hierarchy", label: "Hierarchy" },
  { id: "network", label: "Seller Network" }
] as const;

type PartnerSection = (typeof partnerSections)[number]["id"];
type LeaderSectionId = (typeof leaderSections)[number]["id"];
type TeamSection = PartnerSection | LeaderSectionId;

function getTeamSection(section: string | undefined, isGroupLeader: boolean): TeamSection {
  const sections = isGroupLeader ? leaderSections : partnerSections;
  return sections.some((item) => item.id === section) ? (section as TeamSection) : "hierarchy";
}

export default async function PartnerConsultantsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; updated?: string; section?: string; managerId?: string; leaderId?: string }>;
}) {
  const params = await searchParams;
  const user = await requirePartner();
  const isGroupLeader = user.role === "GROUP_LEADER";
  const nav = isGroupLeader ? groupLeaderNav : partnerNav;
  const activeSection = getTeamSection(params.section, isGroupLeader);
  const availableSections = isGroupLeader ? leaderSections : partnerSections;
  const errorMessages: Record<string, string> = {
    duplicate_email: "That email is already assigned to another partner, leader, or consultant.",
    duplicate_phone: "That phone number is already assigned to another partner, leader, or consultant.",
    invalid_group_leader: "That leader does not belong to your partner network.",
    invalid_manager: "That manager does not belong to your partner network.",
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
  const [pendingConsultants, consultants, groupLeaders, managers, hierarchyOrders] = effectivePartnerProfileId
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
          include: {
            user: true,
            managerProfile: true,
            groupLeaderProfile: {
              include: { managerProfile: true }
            }
          },
          orderBy: { createdAt: "desc" }
        }),
        prisma.groupLeaderProfile.findMany({
          where: groupLeaderProfile
            ? { id: groupLeaderProfile.id }
            : { partnerProfileId: effectivePartnerProfileId, user: { is: { role: "GROUP_LEADER" } } },
          include: { user: true, managerProfile: true },
          orderBy: { displayName: "asc" }
        }),
        prisma.managerProfile.findMany({
          where: groupLeaderProfile
            ? groupLeaderProfile.managerProfileId
              ? { id: groupLeaderProfile.managerProfileId, user: { is: { role: "MANAGER" } } }
              : { id: "__no-manager-assigned__" }
            : { partnerProfileId: effectivePartnerProfileId, user: { is: { role: "MANAGER" } } },
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
                  { managerProfile: { partnerProfileId: effectivePartnerProfileId } },
                  { groupLeaderProfile: { partnerProfileId: effectivePartnerProfileId } },
                  { consultantProfile: { partnerProfileId: effectivePartnerProfileId } }
                ]
              },
          select: {
            totalCents: true,
            partnerProfileId: true,
            managerProfileId: true,
            groupLeaderProfileId: true,
            consultantProfileId: true,
            managerProfile: {
              select: {
                partnerProfileId: true
              }
            },
            groupLeaderProfile: {
              select: {
                managerProfileId: true
              }
            },
            consultantProfile: {
              select: {
                partnerProfileId: true,
                managerProfileId: true,
                groupLeaderProfileId: true
              }
            },
            commissionSplits: {
              select: {
                participantRole: true,
                amountCents: true,
                partnerProfileId: true,
                managerProfileId: true,
                groupLeaderProfileId: true,
                consultantProfileId: true
              }
            }
          }
        })
      ])
    : [[], [], [], [], []];
  const hierarchyPartner = partnerProfile ?? groupLeaderProfile?.partnerProfile ?? null;
  const selectedManager = !isGroupLeader && params.managerId
    ? managers.find((manager) => manager.id === params.managerId) ?? null
    : null;
  const selectedLeader = !groupLeaderProfile && params.leaderId
    ? groupLeaders.find((leader) => leader.id === params.leaderId) ?? null
    : null;
  const hierarchyTree = hierarchyPartner
    ? buildSalesHierarchyTree({
        partner: hierarchyPartner,
        managers,
        groupLeaders,
        consultants,
        orders: hierarchyOrders,
        visibleManagerId: selectedManager?.id ?? null,
        visibleGroupLeaderId: groupLeaderProfile?.id ?? selectedLeader?.id ?? null,
        hidePartnerFinancials: Boolean(groupLeaderProfile),
        hideCommissionSetup: Boolean(groupLeaderProfile)
      })
    : null;
  const groupLeaderOptions = groupLeaders.map((leader) => ({
    id: leader.id,
    displayName: leader.displayName,
    managerProfileId: leader.managerProfileId,
    managerName: leader.managerProfile?.displayName ?? null
  }));
  const managerOptions = managers.map((manager) => ({
    id: manager.id,
    displayName: manager.displayName
  }));
  const sectionHref = (section: TeamSection) => `/partner/consultants?section=${section}`;

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

        {effectivePartnerProfileId ? (
          <Card className="p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              {selectedLeader ? (
                <Link
                  href={sectionHref("leaders")}
                  className="inline-flex h-10 items-center rounded-xl border border-border bg-white px-4 text-sm font-semibold text-clinic-ink transition hover:bg-clinic-mist"
                >
                  Back to leaders
                </Link>
              ) : (
                <div className="hidden lg:block" />
              )}
              <nav className="flex flex-wrap gap-2">
                {availableSections.map((section) => {
                  const isActive = activeSection === section.id;

                  return (
                    <Link
                      key={section.id}
                      href={sectionHref(section.id)}
                      className={`inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold transition ${
                        isActive
                          ? "bg-clinic-navy text-white shadow-line"
                          : "border border-border bg-white text-slate-600 hover:bg-clinic-mist hover:text-clinic-ink"
                      }`}
                    >
                      {section.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </Card>
        ) : null}

        {activeSection === "hierarchy" && hierarchyTree ? (
          <div className="space-y-4">
            {selectedManager ? (
              <Card className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-clinic-ink">{selectedManager.displayName} hierarchy</h2>
                    <p className="mt-1 text-sm text-slate-500">This view shows leaders and direct sellers assigned to this manager.</p>
                  </div>
                  {partnerProfile ? (
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href="/partner/consultants?section=managers"
                        className="inline-flex h-10 items-center rounded-xl border border-border bg-white px-4 text-sm font-semibold text-clinic-ink transition hover:bg-clinic-mist"
                      >
                        Back to managers
                      </Link>
                      <CreateLeaderModal
                        partnerProfileId={partnerProfile.id}
                        managers={managerOptions}
                        defaultManagerProfileId={selectedManager.id}
                        returnTo={`/partner/consultants?section=hierarchy&managerId=${selectedManager.id}`}
                        canManageCommissions
                      />
                      <CreateConsultantModal
                        partnerProfileId={partnerProfile.id}
                        managerProfileId={selectedManager.id}
                        managerName={selectedManager.displayName}
                        groupLeaders={groupLeaderOptions.filter((leader) => leader.managerProfileId === selectedManager.id)}
                        returnTo={`/partner/consultants?section=hierarchy&managerId=${selectedManager.id}`}
                        canManageSellerCommission
                      />
                    </div>
                  ) : null}
                </div>
              </Card>
            ) : selectedLeader ? (
              <Card className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-clinic-ink">{selectedLeader.displayName} hierarchy</h2>
                    <p className="mt-1 text-sm text-slate-500">This view only shows sellers assigned under this group leader.</p>
                  </div>
                  {partnerProfile ? (
                    <CreateConsultantModal
                      partnerProfileId={partnerProfile.id}
                      managerProfileId={selectedLeader.managerProfileId}
                      managerName={selectedLeader.managerProfile?.displayName ?? null}
                      groupLeaderProfileId={selectedLeader.id}
                      groupLeaderName={selectedLeader.displayName}
                      returnTo={`/partner/consultants?section=hierarchy&leaderId=${selectedLeader.id}`}
                      canManageSellerCommission
                    />
                  ) : null}
                </div>
              </Card>
            ) : null}
            <SalesHierarchyView
              tree={hierarchyTree}
              title={
                selectedLeader
                  ? `${selectedLeader.displayName} hierarchy`
                  : selectedManager
                    ? `${selectedManager.displayName} hierarchy`
                  : isGroupLeader
                    ? `${groupLeaderProfile?.displayName ?? "My"} hierarchy`
                    : `${partnerProfile?.companyName ?? partnerProfile?.displayName ?? "Partner"} hierarchy`
              }
            />
          </div>
        ) : null}

        {activeSection === "profile" && partnerProfile ? (
          <Card className="p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div
                  className="grid size-16 shrink-0 place-items-center rounded-2xl border border-border bg-clinic-mist bg-cover bg-center text-lg font-bold text-clinic-navy"
                  style={partnerProfile.user.avatarUrl ? { backgroundImage: `url(${partnerProfile.user.avatarUrl})` } : undefined}
                  aria-label={`${partnerProfile.companyName || partnerProfile.displayName} avatar`}
                >
                  {partnerProfile.user.avatarUrl ? null : initialsFromName(partnerProfile.companyName || partnerProfile.displayName)}
                </div>
                <div className="min-w-0">
                  <Badge>Partner Profile</Badge>
                  <h2 className="mt-3 text-3xl font-semibold text-clinic-ink">{partnerProfile.companyName || partnerProfile.displayName}</h2>
                  <p className="mt-2 break-all text-sm text-slate-500">{partnerProfile.user.email}</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[520px] lg:grid-cols-4">
                <div className="rounded-2xl bg-clinic-mist px-4 py-3 text-center">
                  <p className="text-2xl font-semibold text-clinic-navy">{percentLabel(partnerProfile.commissionBps)}</p>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Margin pool</p>
                </div>
                <div className="rounded-2xl bg-clinic-mist px-4 py-3 text-center">
                  <p className="text-2xl font-semibold text-clinic-navy">{groupLeaders.length}</p>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Leaders</p>
                </div>
                <div className="rounded-2xl bg-clinic-mist px-4 py-3 text-center">
                  <p className="text-2xl font-semibold text-clinic-navy">{managers.length}</p>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Managers</p>
                </div>
                <div className="rounded-2xl bg-clinic-mist px-4 py-3 text-center">
                  <p className="text-2xl font-semibold text-clinic-navy">{consultants.length}</p>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Sellers</p>
                </div>
              </div>
            </div>
            <div className="mt-6 rounded-3xl border border-border bg-clinic-mist/70 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Commission governance</p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                The company admin controls the partner margin pool. Inside this workspace, the partner can organize managers, leaders, sellers, and define team commission shares from that pool.
              </p>
            </div>
          </Card>
        ) : null}

        {activeSection === "managers" && partnerProfile ? (
          <ManagerSection
            partnerProfileId={partnerProfile.id}
            managers={managers}
            returnTo="/partner/consultants?section=managers"
          />
        ) : null}

        {activeSection === "leaders" && partnerProfile ? (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-clinic-ink">Group leaders</h2>
                <p className="mt-1 text-sm text-slate-500">Manage direct leader commissions and team overrides.</p>
              </div>
              <CreateLeaderModal partnerProfileId={partnerProfile.id} managers={managerOptions} canManageCommissions />
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
                          <p className="mt-1 text-xs font-semibold text-slate-400">
                            Manager: {leader.managerProfile?.displayName ?? "Direct partner"}
                          </p>
                        </div>
                      </div>
                      <Badge className="border-blue-100 bg-blue-50 text-clinic-navy">{percentLabel(leader.commissionBps)}</Badge>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs font-semibold text-slate-500">
                      <div className="rounded-2xl bg-clinic-mist px-2 py-3">
                        <p className="text-2xl text-clinic-navy">{percentLabel(leader.commissionBps)}</p>
                        <p className="mt-1">Direct share</p>
                      </div>
                      <div className="rounded-2xl bg-blue-50 px-2 py-3">
                        <p className="text-2xl text-clinic-navy">{percentLabel(leader.consultantOverrideBps)}</p>
                        <p className="mt-1">Team override</p>
                      </div>
                      <div className="rounded-2xl bg-clinic-mist px-2 py-3">
                        <p className="text-2xl text-clinic-navy">{leaderConsultants.length}</p>
                        <p className="mt-1">Sellers</p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                      <Link
                        href={`/partner/consultants?section=hierarchy&leaderId=${leader.id}`}
                        className="inline-flex h-9 items-center rounded-xl border border-border bg-white px-3 text-sm font-semibold text-clinic-ink transition hover:bg-clinic-mist"
                      >
                        View hierarchy
                      </Link>
                      <EditLeaderModal leader={leader} managers={managerOptions} returnTo="/partner/consultants?section=leaders" canManageCommissions />
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

        {activeSection === "network" && partnerProfile ? (
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
                managers={managerOptions}
                returnTo="/partner/consultants?section=network&updated=consultant_created"
                canManageSellerCommission
              />
            </div>
          </Card>
        ) : null}

        {activeSection === "network" && partnerProfile ? (
          <Card className="p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Assignment control</p>
                <h3 className="mt-2 text-2xl font-semibold text-clinic-ink">Seller placement</h3>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                  Move sellers between direct partner ownership, managers, and group leaders. Leaders can view their team but cannot reassign sellers.
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

        {activeSection === "approval" && partnerProfile ? (
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
                            <select
                              name="managerProfileId"
                              className="h-9 rounded-lg border border-input bg-white px-2 text-xs font-semibold text-clinic-ink"
                              defaultValue={applicant.requestedManagerProfileId ?? ""}
                            >
                              <option value="">Direct partner</option>
                              {managers.map((manager) => (
                                <option key={manager.id} value={manager.id}>{manager.displayName}</option>
                              ))}
                            </select>
                            <input
                              name="leaderCommissionPercent"
                              type="number"
                              min="0"
                              max="50"
                              step="0.01"
                              defaultValue="25"
                              className="h-9 w-32 rounded-lg border border-input bg-white px-2 text-xs font-semibold text-clinic-ink"
                              aria-label="Leader direct share of partner pool"
                            />
                            <input
                              name="consultantOverridePercent"
                              type="number"
                              min="0"
                              max="50"
                              step="0.01"
                              defaultValue="0"
                              className="h-9 w-32 rounded-lg border border-input bg-white px-2 text-xs font-semibold text-clinic-ink"
                              aria-label="Leader override from consultant sales"
                            />
                          </>
                        ) : (
                          <>
                            <select
                              name="managerProfileId"
                              className="h-9 rounded-lg border border-input bg-white px-2 text-xs font-semibold text-clinic-ink"
                              defaultValue={applicant.requestedManagerProfileId ?? ""}
                            >
                              <option value="">Direct partner</option>
                              {managers.map((manager) => (
                                <option key={manager.id} value={manager.id}>{manager.displayName}</option>
                              ))}
                            </select>
                            <select
                              name="groupLeaderProfileId"
                              className="h-9 rounded-lg border border-input bg-white px-2 text-xs font-semibold text-clinic-ink"
                              defaultValue={applicant.requestedGroupLeaderProfileId ?? ""}
                            >
                              <option value="">Direct partner</option>
                              {groupLeaders.map((leader) => (
                                <option key={leader.id} value={leader.id}>
                                  {leader.displayName}{leader.managerProfile ? ` - ${leader.managerProfile.displayName}` : ""}
                                </option>
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

        {activeSection === "network" ? (
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
                          <th className="px-5 py-3">Manager</th>
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
                    <td className="px-5 py-4 text-slate-600">{profile.managerProfile?.displayName ?? profile.groupLeaderProfile?.managerProfile?.displayName ?? "Direct partner"}</td>
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
                              managerProfileId: profile.managerProfileId,
                              groupLeaderProfileId: profile.groupLeaderProfileId
                            }}
                            partnerProfileId={partnerProfile.id}
                            managers={managerOptions}
                            groupLeaders={groupLeaderOptions}
                            returnTo="/partner/consultants?section=network&updated=assignment_updated"
                          />
                          <EditConsultantModal
                            consultant={{
                              id: profile.id,
                              firstName: profile.user.firstName,
                              lastName: profile.user.lastName,
                              email: profile.user.email,
                              phone: profile.user.phone,
                              managerProfileId: profile.managerProfileId,
                              groupLeaderProfileId: profile.groupLeaderProfileId,
                              commissionPercent: profile.commissionBps / 100
                            }}
                            partnerProfileId={partnerProfile.id}
                            managers={managerOptions}
                            groupLeaders={groupLeaderOptions}
                            returnTo="/partner/consultants?section=network&updated=consultant_updated"
                            canManageSellerCommission
                          />
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
                {consultants.length === 0 ? (
                  <tr>
                    <td colSpan={partnerProfile ? 6 : 4} className="px-5 py-8 text-center text-slate-500">
                      No consultants are assigned yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
        ) : null}
      </div>
    </SidebarShell>
  );
}
