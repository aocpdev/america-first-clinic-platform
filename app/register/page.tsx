import { LegalFooter } from "@/components/layout/legal-footer";
import { ClinicLogo } from "@/components/layout/logo";
import { prisma } from "@/lib/db/prisma";
import { RegisterForm } from "./register-form";

export default async function RegisterPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessages: Record<string, string> = {
    duplicate_email: "That email is already registered. Please use another email or log in.",
    duplicate_phone: "That phone number is already registered. Please use another phone number.",
    invalid_role: "Please choose whether you are registering as a seller or group leader.",
    invalid_partner: "Please select a valid partner company.",
    invalid_group_leader: "Please select a valid group leader for that partner."
  };
  const [partners, groupLeaders] = await Promise.all([
    prisma.partnerProfile.findMany({
      where: {
        company: { slug: "america-first-clinic" },
        user: { isActive: true }
      },
      include: { user: true },
      orderBy: [{ companyName: "asc" }, { displayName: "asc" }]
    }),
    prisma.groupLeaderProfile.findMany({
      where: {
        company: { slug: "america-first-clinic" },
        user: { isActive: true }
      },
      include: { partnerProfile: true },
      orderBy: [{ partnerProfile: { companyName: "asc" } }, { displayName: "asc" }]
    })
  ]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-5 flex justify-center">
          <ClinicLogo />
        </div>
        <RegisterForm
          partners={partners.map((partner) => ({
            id: partner.id,
            name: partner.companyName || partner.displayName
          }))}
          groupLeaders={groupLeaders.map((leader) => ({
            id: leader.id,
            partnerProfileId: leader.partnerProfileId,
            displayName: leader.displayName
          }))}
          error={error}
          errorMessage={error ? errorMessages[error] : undefined}
        />
        <LegalFooter compact />
      </div>
    </main>
  );
}
