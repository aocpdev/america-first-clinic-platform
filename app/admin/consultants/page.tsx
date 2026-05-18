import { approveConsultant, rejectConsultant } from "@/app/(auth)/actions";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { adminNav } from "@/lib/constants/navigation";
import { prisma } from "@/lib/db/prisma";

export default async function AdminConsultantsPage() {
  const [pendingConsultants, activeConsultants] = await Promise.all([
    prisma.user.findMany({
      where: {
        requestedRole: "CONSULTANT",
        status: "PENDING_APPROVAL"
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.consultantProfile.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 12
    })
  ]);

  return (
    <SidebarShell nav={adminNav} eyebrow="Admin" title="Consultants">
      <div className="space-y-6">
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
            <h3 className="text-lg font-semibold text-clinic-ink">Applications queue</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-clinic-mist text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-5 py-3">Applicant</th>
                  <th className="px-5 py-3">Email</th>
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
                          <SubmitButton size="sm" variant="accent" pendingText="Approving...">Approve</SubmitButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
                {pendingConsultants.length === 0 && (
                  <tr>
                    <td className="px-5 py-8 text-center text-slate-500" colSpan={5}>
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
