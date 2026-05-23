import Link from "next/link";
import {
  approveConsultant,
  rejectConsultant,
  updatePartnerProfileByAdmin
} from "@/app/(auth)/actions";
import { AssignConsultantModal } from "@/app/admin/consultants/assign-consultant-modal";
import { CreateConsultantModal } from "@/app/admin/consultants/create-consultant-modal";
import { CreatePartnerModal } from "@/app/admin/consultants/create-partner-modal";
import { EditConsultantModal } from "@/app/admin/consultants/edit-consultant-modal";
import { LeaderSection } from "@/app/admin/consultants/leader-section";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { SalesHierarchyView } from "@/components/network/sales-hierarchy-view";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PhoneInput } from "@/components/ui/phone-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { adminNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";
import { buildSalesHierarchyTree, percentLabel } from "@/lib/network/sales-hierarchy";

function displayUserName(user: { firstName: string | null; lastName: string | null; email: string }) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email;
}

function inputClass(extra = "") {
  return `h-11 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-clinic-navy focus:ring-4 focus:ring-clinic-navy/10 ${extra}`;
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
  { id: "workspace", label: "Partner Profile" },
  { id: "leaders", label: "Leaders" },
  { id: "approval", label: "Approval workflow" },
  { id: "network", label: "Seller Network" }
] as const;

type PartnerSection = (typeof partnerSections)[number]["id"];

function getPartnerSection(section: string | undefined): PartnerSection {
  return partnerSections.some((item) => item.id === section) ? (section as PartnerSection) : "hierarchy";
}

export default async function AdminConsultantsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; updated?: string; partnerId?: string; section?: string; leaderId?: string }>;
}) {
  const params = await searchParams;
  const [pendingConsultants, partners] = await Promise.all([
    prisma.user.findMany({
      where: {
        requestedRole: { in: ["CONSULTANT", "GROUP_LEADER"] },
        status: "PENDING_APPROVAL"
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.partnerProfile.findMany({
      include: {
        user: true,
        groupLeaders: {
          where: { user: { is: { role: "GROUP_LEADER" } } },
          include: { user: true },
          orderBy: { displayName: "asc" }
        },
        consultants: {
          where: { user: { is: { role: "CONSULTANT" } } },
          include: { user: true, groupLeaderProfile: true },
          orderBy: { createdAt: "desc" }
        }
      },
      orderBy: [{ companyName: "asc" }, { displayName: "asc" }]
    })
  ]);

  const selectedPartner = params.partnerId
    ? partners.find((partner) => partner.id === params.partnerId) ?? null
    : null;
  const selectedLeader = selectedPartner && params.leaderId
    ? selectedPartner.groupLeaders.find((leader) => leader.id === params.leaderId) ?? null
    : null;
  const selectedOrders = selectedPartner
    ? await prisma.order.findMany({
        where: {
          OR: [
            { partnerProfileId: selectedPartner.id },
            { consultantProfile: { partnerProfileId: selectedPartner.id } }
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
    : [];
  const hierarchyTree = selectedPartner
    ? buildSalesHierarchyTree({
        partner: selectedPartner,
        groupLeaders: selectedPartner.groupLeaders,
        consultants: selectedPartner.consultants,
        orders: selectedOrders,
        visibleGroupLeaderId: selectedLeader?.id ?? null
      })
    : null;
  const selectedPending = selectedPartner
    ? pendingConsultants.filter((user) => user.requestedPartnerProfileId === selectedPartner.id)
    : [];
  const activeSection = getPartnerSection(params.section);
  const sectionHref = (section: PartnerSection) =>
    selectedPartner ? `/admin/consultants?partnerId=${selectedPartner.id}&section=${section}` : "/admin/consultants";
  const errorMessages: Record<string, string> = {
    duplicate_email: "That email is already assigned to another partner, leader, or consultant.",
    duplicate_phone: "That phone number is already assigned to another partner, leader, or consultant.",
    invalid_group_leader: "That leader does not belong to this partner network.",
    application_not_found: "That application could not be found or has already been processed.",
    consultant_not_found: "That consultant could not be found.",
    access_denied: "You do not have permission to move that seller."
  };

  return (
    <SidebarShell nav={adminNav} eyebrow="Admin" title="Partner network">
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

        {!selectedPartner ? (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-clinic-ink">Partners</h2>
                <p className="mt-1 text-sm text-slate-500">Open a partner workspace to manage leaders, approvals, and seller hierarchy.</p>
              </div>
              <CreatePartnerModal />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {partners.map((partner) => {
                const partnerPendingCount = pendingConsultants.filter((user) => user.requestedPartnerProfileId === partner.id).length;

                return (
                  <Card
                    key={partner.id}
                    className="group rounded-3xl border border-border bg-white p-5 shadow-line transition hover:-translate-y-0.5 hover:border-clinic-navy/30 hover:shadow-soft"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="grid size-12 shrink-0 place-items-center rounded-2xl border border-border bg-clinic-mist bg-cover bg-center text-sm font-bold text-clinic-navy"
                          style={partner.user.avatarUrl ? { backgroundImage: `url(${partner.user.avatarUrl})` } : undefined}
                          aria-label={`${partner.companyName || partner.displayName} avatar`}
                        >
                          {partner.user.avatarUrl ? null : initialsFromName(partner.companyName || partner.displayName)}
                        </div>
                        <p className="truncate text-lg font-semibold text-clinic-ink">{partner.companyName || partner.displayName}</p>
                      </div>
                      <Badge className="border-blue-100 bg-blue-50 text-clinic-navy">{percentLabel(partner.commissionBps)}</Badge>
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs font-semibold text-slate-500">
                      <div className="rounded-2xl bg-clinic-mist px-2 py-3">
                        <p className="text-2xl text-clinic-navy">{partner.groupLeaders.length}</p>
                        <p className="mt-1">Leaders</p>
                      </div>
                      <div className="rounded-2xl bg-clinic-mist px-2 py-3">
                        <p className="text-2xl text-clinic-navy">{partner.consultants.length}</p>
                        <p className="mt-1">Sellers</p>
                      </div>
                      <div className="rounded-2xl bg-red-50 px-2 py-3">
                        <p className="text-2xl text-clinic-red">{partnerPendingCount}</p>
                        <p className="mt-1">Pending</p>
                      </div>
                    </div>
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                      <Link
                        href={`/admin/consultants?partnerId=${partner.id}`}
                        className="inline-flex h-9 items-center rounded-xl border border-border bg-white px-3 text-sm font-semibold text-clinic-ink transition hover:bg-clinic-mist"
                      >
                        Open workspace
                      </Link>
                    </div>
                  </Card>
                );
              })}
              {partners.length === 0 ? (
                <Card className="p-6 md:col-span-2 xl:col-span-3">
                  <h2 className="text-xl font-semibold text-clinic-ink">No partners yet</h2>
                  <p className="mt-2 text-slate-600">Create the first partner to start building leaders and consultants.</p>
                </Card>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <Link
                  href="/admin/consultants"
                  className="inline-flex h-10 items-center rounded-xl border border-border bg-white px-4 text-sm font-semibold text-clinic-ink transition hover:bg-clinic-mist"
                >
                  Back to partners
                </Link>
                <nav className="flex flex-wrap gap-2">
                  {partnerSections.map((section) => {
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

              {activeSection === "workspace" ? (
              <Card className="p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <Badge>Partner Profile</Badge>
                    <h2 className="mt-4 text-3xl font-semibold text-clinic-ink">
                      {selectedPartner.companyName || selectedPartner.displayName}
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">{selectedPartner.user.email}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-2xl bg-clinic-mist px-4 py-3">
                      <p className="text-2xl font-semibold text-clinic-navy">{percentLabel(selectedPartner.commissionBps)}</p>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Margin pool</p>
                    </div>
                    <div className="rounded-2xl bg-clinic-mist px-4 py-3">
                      <p className="text-2xl font-semibold text-clinic-navy">{selectedPartner.groupLeaders.length}</p>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Leaders</p>
                    </div>
                    <div className="rounded-2xl bg-clinic-mist px-4 py-3">
                      <p className="text-2xl font-semibold text-clinic-navy">{selectedPartner.consultants.length}</p>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Sellers</p>
                    </div>
                  </div>
                </div>

                <form action={updatePartnerProfileByAdmin} className="mt-6 grid gap-4">
                  <input type="hidden" name="partnerProfileId" value={selectedPartner.id} />
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">First name</span>
                      <input name="firstName" defaultValue={selectedPartner.user.firstName ?? ""} className={inputClass("w-full")} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Last name</span>
                      <input name="lastName" defaultValue={selectedPartner.user.lastName ?? ""} className={inputClass("w-full")} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Partner display name</span>
                      <input name="displayName" defaultValue={selectedPartner.displayName} className={inputClass("w-full")} required />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Partner company</span>
                      <input name="companyName" defaultValue={selectedPartner.companyName ?? selectedPartner.displayName} className={inputClass("w-full")} required />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Phone</span>
                      <PhoneInput name="phone" defaultValue={selectedPartner.user.phone ?? ""} className={inputClass("w-full")} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Partner margin pool</span>
                      <input name="commissionPercent" type="number" min="0" max="100" step="0.01" defaultValue={selectedPartner.commissionBps / 100} className={inputClass("w-full")} required />
                    </label>
                  </div>
                  <div className="rounded-2xl border border-border bg-clinic-mist px-4 py-3 text-sm text-slate-600">
                    Account email: <span className="font-semibold text-clinic-ink">{selectedPartner.user.email}</span>
                  </div>
                  <div>
                    <SubmitButton variant="outline" pendingText="Saving...">Save partner profile</SubmitButton>
                  </div>
                </form>
              </Card>
              ) : null}

              {activeSection === "hierarchy" && hierarchyTree ? (
                <div className="space-y-4">
                  {selectedLeader ? (
                    <Card className="p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <Link
                            href={sectionHref("leaders")}
                            className="text-sm font-semibold text-clinic-navy transition hover:text-clinic-red"
                          >
                            Back to leaders
                          </Link>
                          <h2 className="mt-2 text-2xl font-semibold text-clinic-ink">{selectedLeader.displayName} hierarchy</h2>
                          <p className="mt-1 text-sm text-slate-500">This view only shows consultants assigned under this group leader.</p>
                        </div>
                        <CreateConsultantModal
                          partnerProfileId={selectedPartner.id}
                          groupLeaderProfileId={selectedLeader.id}
                          groupLeaderName={selectedLeader.displayName}
                          returnTo={`/admin/consultants?partnerId=${selectedPartner.id}&section=hierarchy&leaderId=${selectedLeader.id}`}
                        />
                      </div>
                    </Card>
                  ) : null}
                  <SalesHierarchyView
                    tree={hierarchyTree}
                    title={selectedLeader ? `${selectedLeader.displayName} hierarchy` : `${selectedPartner.companyName || selectedPartner.displayName} hierarchy`}
                  />
                </div>
              ) : null}

              {activeSection === "leaders" ? (
              <LeaderSection
                partnerProfileId={selectedPartner.id}
                leaders={selectedPartner.groupLeaders}
                returnTo={`/admin/consultants?partnerId=${selectedPartner.id}&section=leaders`}
              />
              ) : null}

              {activeSection === "network" ? (
              <>
              <Card className="p-5">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Assignment control</p>
                    <h3 className="mt-2 text-2xl font-semibold text-clinic-ink">Seller placement</h3>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                      Assign sellers directly to {selectedPartner.companyName || selectedPartner.displayName} or place them under a group leader.
                      Customer ownership follows the seller when the assignment changes.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[420px]">
                    <div className="rounded-2xl border border-border bg-clinic-mist px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Direct partner</p>
                      <p className="mt-2 text-2xl font-semibold text-clinic-navy">
                        {selectedPartner.consultants.filter((profile) => !profile.groupLeaderProfileId).length}
                      </p>
                    </div>
                    {selectedPartner.groupLeaders.slice(0, 3).map((leader) => (
                      <div key={leader.id} className="rounded-2xl border border-border bg-white px-4 py-3">
                        <p className="truncate text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{leader.displayName}</p>
                        <p className="mt-2 text-2xl font-semibold text-clinic-navy">
                          {selectedPartner.consultants.filter((profile) => profile.groupLeaderProfileId === leader.id).length}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Seller network</p>
                    <h3 className="mt-2 text-2xl font-semibold text-clinic-ink">Consultants</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Add a seller directly under this partner or assign them to a group leader.
                    </p>
                  </div>
                  <CreateConsultantModal
                    partnerProfileId={selectedPartner.id}
                    groupLeaders={selectedPartner.groupLeaders.map((leader) => ({
                      id: leader.id,
                      displayName: leader.displayName
                    }))}
                    returnTo={`/admin/consultants?partnerId=${selectedPartner.id}&section=network`}
                  />
                </div>
              </Card>

              <Card className="overflow-hidden">
                <div className="border-b border-border p-5">
                  <Badge>Seller network</Badge>
                  <h3 className="mt-4 text-2xl font-semibold text-clinic-ink">Consultants</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-left text-sm">
                    <thead className="bg-clinic-mist text-xs uppercase tracking-[0.14em] text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Consultant</th>
                        <th className="px-5 py-3">Leader</th>
                        <th className="px-5 py-3">Referral</th>
                        <th className="px-5 py-3">Pool share</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-white">
                      {selectedPartner.consultants.map((profile) => (
                        <tr key={profile.id}>
                          <td className="px-5 py-4">
                            <p className="font-semibold text-clinic-ink">{displayUserName(profile.user)}</p>
                            <p className="mt-1 text-xs text-slate-500">{profile.user.email}</p>
                          </td>
                          <td className="px-5 py-4 text-slate-600">{profile.groupLeaderProfile?.displayName ?? "Direct partner"}</td>
                          <td className="px-5 py-4 font-semibold text-clinic-navy">/c/{profile.referralSlug}</td>
                          <td className="px-5 py-4">{percentLabel(profile.commissionBps)} of partner pool</td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <AssignConsultantModal
                                consultant={{
                                  id: profile.id,
                                  name: displayUserName(profile.user),
                                  email: profile.user.email,
                                  avatarUrl: profile.user.avatarUrl,
                                  groupLeaderProfileId: profile.groupLeaderProfileId
                                }}
                                partnerProfileId={selectedPartner.id}
                                groupLeaders={selectedPartner.groupLeaders.map((leader) => ({
                                  id: leader.id,
                                  displayName: leader.displayName
                                }))}
                                returnTo={`/admin/consultants?partnerId=${selectedPartner.id}&section=network&updated=assignment_updated`}
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
                                partnerProfileId={selectedPartner.id}
                                groupLeaders={selectedPartner.groupLeaders.map((leader) => ({
                                  id: leader.id,
                                  displayName: leader.displayName
                                }))}
                                returnTo={`/admin/consultants?partnerId=${selectedPartner.id}&section=network&updated=consultant_updated`}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                      {selectedPartner.consultants.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-5 py-8 text-center text-slate-500">No consultants are assigned to this partner yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
              </>
              ) : null}

              {activeSection === "approval" ? (
              <Card className="overflow-hidden">
                <div className="border-b border-border p-5">
                  <Badge>Approval workflow</Badge>
                  <h3 className="mt-4 text-2xl font-semibold text-clinic-ink">Pending applications</h3>
                </div>
                <div className="divide-y divide-border">
                  {selectedPending.map((user) => {
                    const isLeaderApplication = user.requestedRole === "GROUP_LEADER";
                    return (
                      <div key={user.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-clinic-ink">{displayUserName(user)}</p>
                            <Badge className={isLeaderApplication ? "border-blue-100 bg-blue-50 text-clinic-navy" : "border-emerald-100 bg-emerald-50 text-emerald-700"}>
                              {isLeaderApplication ? "Group leader" : "Seller"}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <form action={rejectConsultant}>
                            <input type="hidden" name="userId" value={user.id} />
                            <input type="hidden" name="reason" value="Application rejected by company admin." />
                            <SubmitButton size="sm" variant="outline" pendingText="Rejecting...">Reject</SubmitButton>
                          </form>
                          <form action={approveConsultant} className="flex flex-wrap justify-end gap-2">
                            <input type="hidden" name="userId" value={user.id} />
                            <input type="hidden" name="partnerProfileId" value={selectedPartner.id} />
                            {isLeaderApplication ? (
                              <>
                                <input name="leaderCommissionPercent" type="number" min="0" max="100" step="0.01" defaultValue="25" className="h-9 w-32 rounded-lg border border-input bg-white px-2 text-xs font-semibold text-clinic-ink" aria-label="Leader direct share of partner pool" />
                                <input name="consultantOverridePercent" type="number" min="0" max="100" step="0.01" defaultValue="0" className="h-9 w-32 rounded-lg border border-input bg-white px-2 text-xs font-semibold text-clinic-ink" aria-label="Leader override from consultant sales" />
                              </>
                            ) : (
                              <>
                                <select name="groupLeaderProfileId" className="h-9 rounded-lg border border-input bg-white px-2 text-xs font-semibold text-clinic-ink" defaultValue={user.requestedGroupLeaderProfileId ?? ""}>
                                  <option value="">Direct partner</option>
                                  {selectedPartner.groupLeaders.map((leader) => (
                                    <option key={leader.id} value={leader.id}>{leader.displayName}</option>
                                  ))}
                                </select>
                                <input name="consultantCommissionPercent" type="number" min="0" max="100" step="0.01" defaultValue="50" className="h-9 w-28 rounded-lg border border-input bg-white px-2 text-xs font-semibold text-clinic-ink" aria-label="Consultant share of partner pool" />
                              </>
                            )}
                            <SubmitButton size="sm" variant="accent" pendingText="Approving...">Approve</SubmitButton>
                          </form>
                        </div>
                      </div>
                    );
                  })}
                  {selectedPending.length === 0 && <p className="p-5 text-sm text-slate-500">No pending applications for this partner.</p>}
                </div>
              </Card>
              ) : null}
          </div>
        )}
      </div>
    </SidebarShell>
  );
}
