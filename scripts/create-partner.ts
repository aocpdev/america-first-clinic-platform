import { UserRole, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

async function main() {
  const email = process.env.PARTNER_EMAIL;
  const password = process.env.PARTNER_PASSWORD;
  const displayName = process.env.PARTNER_NAME ?? "America First Partner";

  if (!email || !password) {
    throw new Error("Set PARTNER_EMAIL and PARTNER_PASSWORD before running this script.");
  }

  const company = await prisma.company.upsert({
    where: { slug: "america-first-clinic" },
    update: {},
    create: {
      name: "Go Virtual Health",
      slug: "america-first-clinic",
      logoUrl: "/go-virtual-health-logo.jpeg"
    }
  });

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      role: UserRole.PARTNER,
      company_id: company.id,
      status: UserStatus.ACTIVE
    },
    user_metadata: {
      first_name: displayName,
      last_name: "Partner"
    }
  });

  if (error || !data.user?.id) {
    throw new Error(error?.message ?? "Unable to create Supabase partner user.");
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      authUserId: data.user.id,
      companyId: company.id,
      role: UserRole.PARTNER,
      requestedRole: UserRole.PARTNER,
      status: UserStatus.ACTIVE,
      isActive: true,
      approvedAt: new Date()
    },
    create: {
      authUserId: data.user.id,
      companyId: company.id,
      role: UserRole.PARTNER,
      requestedRole: UserRole.PARTNER,
      status: UserStatus.ACTIVE,
      email,
      firstName: displayName,
      lastName: "Partner",
      isActive: true,
      approvedAt: new Date()
    }
  });

  await prisma.partnerProfile.upsert({
    where: { userId: user.id },
    update: { displayName, companyId: company.id },
    create: {
      userId: user.id,
      companyId: company.id,
      displayName
    }
  });

  console.log(`Created partner: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
