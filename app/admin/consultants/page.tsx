import Link from "next/link";
import {
  approveConsultant,
  createGroupLeader,
  rejectConsultant,
  updateConsultantCommercials,
  updateGroupLeaderProfile,
  updatePartnerProfileByAdmin
} from "@/app/(auth)/actions";
import { CreatePartnerModal } from "@/app/admin/consultants/create-partner-modal";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { SalesHierarchyView } from "@/components/network/sales-hierarchy-view";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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

export default async function AdminConsultantsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; updated?: string; partnerId?: string }>;
}) {
  const params = await searchParams;
  const [pendingConsultants, partners] = await Promise.all([
    prisma.user.findMany({
      where: {
        requestedRole: "CONSULTANT",
        status: "PENDING_APPROVAL"
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.partnerProfile.findMany({
      include: {
        user: true,
        groupLeaders: {
          include: { user: true },
          orderBy: { displayName: "asc" }
        },
        consultants: {
          include: { user: true, groupLeaderProfile: true },
          orderBy: { createdAt: "desc" }
        }
      },
      orderBy: [{ companyName: "asc" }, { displayName: "asc" }]
    })
  ]);

  const selectedPartner = partners.find((partner) => partner.id === params.partnerId) ?? partners[0] ?? null;
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
        orders: selectedOrders
      })
    : null;
  const selectedPending = selectedPartner
    ? pendingConsultants.filter((user) => user.requestedPartnerProfileId === selectedPartner.id)
    : [];
  const totalLeaders = partners.reduce((sum, partner) => sum + partner.groupLeaders.length, 0);
  const totalConsultants = partners.reduce((sum, partner) => sum + partner.consultants.length, 0);

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
            The requested action could not be completed. Please review the details and try again.
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Partners</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-navy">{partners.length}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Group leaders</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-navy">{totalLeaders}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Consultants</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-navy">{totalConsultants}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Pending</p>
            <p className="mt-3 text-3xl font-semibold text-clinic-red">{pendingConsultants.length}</p>
          </Card>
        </div>

        <CreatePartnerModal />

        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card className="overflow-hidden">
            <div className="border-b border-border p-5">
              <h3 className="text-lg font-semibold text-clinic-ink">Partners</h3>
              <p className="mt-1 text-sm text-slate-500">Open a partner to manage its leaders, consultants, and commission structure.</p>
            </div>
            <div className="divide-y divide-border">
              {partners.map((partner) => {
                const isSelected = selectedPartner?.id === partner.id;

                return (
                  <Link
                    key={partner.id}
                    href={`/admin/consultants?partnerId=${partner.id}`}
                    className={`block p-5 transition hover:bg-clinic-mist/70 ${isSelected ? "bg-clinic-mist" : "bg-white"}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-clinic-ink">{partner.companyName || partner.displayName}</p>
                        <p className="mt-1 text-sm text-slate-500">{partner.user.email}</p>
                      </div>
                      <Badge className={isSelected ? "border-blue-100 bg-blue-50 text-clinic-navy" : ""}>
                        {percentLabel(partner.commissionBps)}
                      </Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-semibold text-slate-500">
                      <div className="rounded-xl bg-white/80 px-2 py-2">
                        <p className="text-lg text-clinic-navy">{partner.groupLeaders.length}</p>
                        <p>Leaders</p>
                      </div>
                      <div className="rounded-xl bg-white/80 px-2 py-2">
                        <p className="text-lg text-clinic-navy">{partner.consultants.length}</p>
                        <p>Sellers</p>
                      </div>
                      <div className="rounded-xl bg-white/80 px-2 py-2">
                        <p className="text-lg text-clinic-red">{pendingConsultants.filter((user) => user.requestedPartnerProfileId === partner.id).length}</p>
                        <p>Pending</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
              {partners.length === 0 && <p className="p-5 text-sm text-slate-500">Create the first partner to start building the sales network.</p>}
            </div>
          </Card>

          {selectedPartner ? (
            <div className="space-y-6">
              <Card className="p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <Badge>Partner workspace</Badge>
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

                <form action={updatePartnerProfileByAdmin} className="mt-6 grid gap-3 md:grid-cols-[1fr_180px_auto]">
                  <input type="hidden" name="partnerProfileId" value={selectedPartner.id} />
                  <input name="companyName" defaultValue={selectedPartner.companyName ?? selectedPartner.displayName} className={inputClass()} required />
                  <input name="commissionPercent" type="number" min="0" max="100" step="0.01" defaultValue={selectedPartner.commissionBps / 100} className={inputClass()} required />
                  <SubmitButton variant="outline" pendingText="Saving...">Save partner</SubmitButton>
                </form>
              </Card>

              {hierarchyTree ? (
                <SalesHierarchyView
                  tree={hierarchyTree}
                  title={`${selectedPartner.companyName || selectedPartner.displayName} hierarchy`}
                />
              ) : null}

              <Card className="p-6">
                <div>
                  <Badge>Leaders</Badge>
                  <h3 className="mt-4 text-2xl font-semibold text-clinic-ink">Create group leader</h3>
                  <p className="mt-2 text-sm text-slate-500">Leader and consultant percentages are shares of the Partner margin pool.</p>
                </div>
                <form action={createGroupLeader} className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                  <input type="hidden" name="partnerProfileId" value={selectedPartner.id} />
                  <input name="firstName" placeholder="First name" className={inputClass()} required />
                  <input name="lastName" placeholder="Last name" className={inputClass()} required />
                  <input name="email" type="email" placeholder="Leader email" className={inputClass()} required />
                  <input name="password" type="password" minLength={8} placeholder="Temporary password" className={inputClass()} required />
                  <input name="commissionPercent" type="number" min="0" max="100" step="0.01" placeholder="% of partner pool" defaultValue="25" className={inputClass()} required />
                  <div>
                    <SubmitButton variant="accent" pendingText="Creating...">Create leader</SubmitButton>
                  </div>
                </form>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {selectedPartner.groupLeaders.map((leader) => (
                    <div key={leader.id} className="rounded-2xl border border-border bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-clinic-ink">{leader.displayName}</p>
                          <p className="mt-1 text-sm text-slate-500">{leader.user.email}</p>
                        </div>
                        <Badge>{percentLabel(leader.commissionBps)} pool share</Badge>
                      </div>
                      <form action={updateGroupLeaderProfile} className="mt-4 flex gap-2">
                        <input type="hidden" name="groupLeaderProfileId" value={leader.id} />
                        <input name="commissionPercent" type="number" min="0" max="100" step="0.01" defaultValue={leader.commissionBps / 100} className={inputClass("min-w-0 flex-1")} required />
                        <SubmitButton size="sm" variant="outline" pendingText="Saving...">Save</SubmitButton>
                      </form>
                    </div>
                  ))}
                  {selectedPartner.groupLeaders.length === 0 && <p className="text-sm text-slate-500">No leaders have been created for this partner yet.</p>}
                </div>
              </Card>

              <Card className="overflow-hidden">
                <div className="border-b border-border p-5">
                  <Badge>Approval workflow</Badge>
                  <h3 className="mt-4 text-2xl font-semibold text-clinic-ink">Pending applications</h3>
                </div>
                <div className="divide-y divide-border">
                  {selectedPending.map((user) => (
                    <div key={user.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                      <div>
                        <p className="font-semibold text-clinic-ink">{displayUserName(user)}</p>
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
                          <select name="groupLeaderProfileId" className="h-9 rounded-lg border border-input bg-white px-2 text-xs font-semibold text-clinic-ink" defaultValue={user.requestedGroupLeaderProfileId ?? ""}>
                            <option value="">Direct partner</option>
                            {selectedPartner.groupLeaders.map((leader) => (
                              <option key={leader.id} value={leader.id}>{leader.displayName}</option>
                            ))}
                          </select>
                          <input name="consultantCommissionPercent" type="number" min="0" max="100" step="0.01" defaultValue="50" className="h-9 w-28 rounded-lg border border-input bg-white px-2 text-xs font-semibold text-clinic-ink" aria-label="Consultant share of partner pool" />
                          <SubmitButton size="sm" variant="accent" pendingText="Approving...">Approve</SubmitButton>
                        </form>
                      </div>
                    </div>
                  ))}
                  {selectedPending.length === 0 && <p className="p-5 text-sm text-slate-500">No pending consultants for this partner.</p>}
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
                        <th className="px-5 py-3 text-right">Update</th>
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
                          <td className="px-5 py-4">
                            <form action={updateConsultantCommercials} className="flex justify-end gap-2">
                              <input type="hidden" name="consultantProfileId" value={profile.id} />
                              <input type="hidden" name="partnerProfileId" value={selectedPartner.id} />
                              <select name="groupLeaderProfileId" className="h-9 rounded-lg border border-input bg-white px-2 text-xs font-semibold text-clinic-ink" defaultValue={profile.groupLeaderProfileId ?? ""}>
                                <option value="">Direct partner</option>
                                {selectedPartner.groupLeaders.map((leader) => (
                                  <option key={leader.id} value={leader.id}>{leader.displayName}</option>
                                ))}
                              </select>
                              <input name="consultantCommissionPercent" type="number" min="0" max="100" step="0.01" defaultValue={profile.commissionBps / 100} className="h-9 w-24 rounded-lg border border-input bg-white px-2 text-xs font-semibold text-clinic-ink" aria-label="Consultant share of partner pool" />
                              <SubmitButton size="sm" variant="outline" pendingText="Saving...">Save</SubmitButton>
                            </form>
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
            </div>
          ) : (
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-clinic-ink">No partner selected</h2>
              <p className="mt-2 text-slate-600">Create a partner to start building leaders and consultants.</p>
            </Card>
          )}
        </div>
      </div>
    </SidebarShell>
  );
}
