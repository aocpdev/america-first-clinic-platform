import { UserRole, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD before running this script.");
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
      role: UserRole.COMPANY_ADMIN,
      company_id: company.id,
      status: UserStatus.ACTIVE
    },
    user_metadata: {
      first_name: "America First",
      last_name: "Admin"
    }
  });

  if (error || !data.user?.id) {
    throw new Error(error?.message ?? "Unable to create Supabase admin user.");
  }

  await prisma.user.upsert({
    where: { email },
    update: {
      authUserId: data.user.id,
      companyId: company.id,
      role: UserRole.COMPANY_ADMIN,
      requestedRole: UserRole.COMPANY_ADMIN,
      status: UserStatus.ACTIVE,
      isActive: true,
      approvedAt: new Date()
    },
    create: {
      authUserId: data.user.id,
      companyId: company.id,
      role: UserRole.COMPANY_ADMIN,
      requestedRole: UserRole.COMPANY_ADMIN,
      status: UserStatus.ACTIVE,
      email,
      firstName: "America First",
      lastName: "Admin",
      isActive: true,
      approvedAt: new Date()
    }
  });

  console.log(`Created company admin: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
