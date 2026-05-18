import Link from "next/link";
import { registerUser } from "@/app/(auth)/actions";
import { ClinicLogo } from "@/components/layout/logo";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { prisma } from "@/lib/db/prisma";

export default async function RegisterPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const partners = await prisma.partnerProfile.findMany({
    where: {
      company: { slug: "america-first-clinic" },
      user: { isActive: true }
    },
    include: { user: true },
    orderBy: [{ companyName: "asc" }, { displayName: "asc" }]
  });

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg p-6 shadow-soft">
        <ClinicLogo />
        <h1 className="mt-8 text-3xl font-semibold text-clinic-ink">Create your account</h1>
        <p className="mt-2 text-sm text-slate-500">
          Consultant accounts require partner or admin approval before selling.
        </p>
        {error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            Registration could not be completed. Please review your information and try again.
          </div>
        )}
        <form action={registerUser} className="mt-6 grid gap-4 sm:grid-cols-2">
          <Input name="firstName" placeholder="First name" required />
          <Input name="lastName" placeholder="Last name" required />
          <Input className="sm:col-span-2" name="email" placeholder="Email address" type="email" required />
          <Input className="sm:col-span-2" name="password" placeholder="Password" type="password" minLength={8} required />
          <label className="sm:col-span-2 text-sm font-semibold text-clinic-ink">
            Partner company
            <select
              name="requestedPartnerProfileId"
              className="mt-2 h-11 w-full rounded-lg border border-input bg-white px-3 text-sm shadow-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              defaultValue=""
              required
            >
              <option value="" disabled>Select your partner company</option>
              {partners.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.companyName || partner.displayName}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="requestedRole" value="CONSULTANT" />
          <SubmitButton className="sm:col-span-2 mt-1 w-full" pendingText="Creating account..." variant="accent">
            Request consultant access
          </SubmitButton>
        </form>
        <p className="mt-5 text-center text-sm text-slate-500">
          Already have an account? <Link href="/login" className="font-semibold text-clinic-blue">Log in</Link>
        </p>
      </Card>
    </main>
  );
}
