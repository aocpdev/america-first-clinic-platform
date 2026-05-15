import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.upsert({
    where: { slug: "america-first-clinic" },
    update: {},
    create: {
      name: "America First Clinic",
      slug: "america-first-clinic",
      logoUrl: "/america-first-clinic-logo.jpeg",
      primaryColor: "#073763",
      accentColor: "#DC1F2A"
    }
  });

  const categories = await Promise.all(
    ["Weight Loss", "Wellness Products", "Vitamin Injections", "GLP-1", "Wellness Services"].map((name) =>
      prisma.productCategory.upsert({
        where: { companyId_slug: { companyId: company.id, slug: name.toLowerCase().replaceAll(" ", "-") } },
        update: {},
        create: {
          companyId: company.id,
          name,
          slug: name.toLowerCase().replaceAll(" ", "-")
        }
      })
    )
  );

  const admin = await prisma.user.upsert({
    where: { email: "admin@americafirstclinic.com" },
    update: {},
    create: {
      authUserId: "seed-admin",
      companyId: company.id,
      role: UserRole.COMPANY_ADMIN,
      email: "admin@americafirstclinic.com",
      firstName: "America First",
      lastName: "Admin"
    }
  });

  const consultantUser = await prisma.user.upsert({
    where: { email: "consultant@americafirstclinic.com" },
    update: {},
    create: {
      authUserId: "seed-consultant",
      companyId: company.id,
      role: UserRole.CONSULTANT,
      email: "consultant@americafirstclinic.com",
      firstName: "Avery",
      lastName: "Johnson"
    }
  });

  await prisma.consultantProfile.upsert({
    where: { userId: consultantUser.id },
    update: {},
    create: {
      userId: consultantUser.id,
      companyId: company.id,
      referralSlug: "avery-johnson",
      referralCode: "AVERY123",
      monthlyGoal: 3500000,
      onboardingDone: true
    }
  });

  const weightLoss = categories.find((category) => category.name === "Weight Loss") ?? categories[0];
  await prisma.product.upsert({
    where: { companyId_slug: { companyId: company.id, slug: "medical-weight-loss-program" } },
    update: {},
    create: {
      companyId: company.id,
      categoryId: weightLoss.id,
      title: "Medical Weight Loss Program",
      slug: "medical-weight-loss-program",
      description: "Clinician-guided wellness and weight loss program with recurring care support.",
      priceCents: 49900,
      internalCostCents: 16000,
      marginBps: 6800,
      sku: "AFC-WL-001",
      supportsSubscription: true,
      supportsRecurring: true,
      inventory: {
        create: {
          quantityOnHand: 96,
          reorderPoint: 12
        }
      }
    }
  });

  await prisma.paymentProvider.createMany({
    data: [
      { companyId: company.id, code: "nmi", label: "NMI", active: false },
      { companyId: company.id, code: "authorize_net", label: "Authorize.net", active: false },
      { companyId: company.id, code: "stripe", label: "Stripe", active: false },
      { companyId: company.id, code: "ach", label: "ACH Provider", active: false }
    ],
    skipDuplicates: true
  });

  console.log(`Seeded ${company.name} with admin ${admin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
