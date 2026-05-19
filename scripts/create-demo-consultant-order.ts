import { prisma } from "@/lib/db/prisma";
import { createMarginCommissionLedger } from "@/lib/commissions/margin-split";

async function main() {
  const company = await prisma.company.findUnique({
    where: { slug: "america-first-clinic" }
  });

  if (!company) {
    throw new Error("America First Clinic company was not found.");
  }

  const consultant = await prisma.consultantProfile.findFirst({
    where: {
      companyId: company.id,
      partnerProfileId: { not: null }
    },
    include: {
      user: true,
      partnerProfile: true,
      groupLeaderProfile: true
    },
    orderBy: { createdAt: "asc" }
  });

  if (!consultant) {
    throw new Error("No active consultant with a partner profile was found.");
  }

  const product = await prisma.product.findFirst({
    where: {
      companyId: company.id,
      active: true
    },
    orderBy: { title: "asc" }
  });

  if (!product) {
    throw new Error("No active product was found.");
  }

  const customerEmail = "mariana.rivera.demo@example.com";
  const customer = await prisma.customer.upsert({
    where: {
      companyId_email: {
        companyId: company.id,
        email: customerEmail
      }
    },
    update: {
      firstName: "Mariana",
      lastName: "Rivera",
      phone: "7875550198",
      consultantProfileId: consultant.id,
      partnerProfileId: null,
      groupLeaderProfileId: consultant.groupLeaderProfileId,
      pipelineStage: "CART_BUILT",
      pipelineUpdatedAt: new Date(),
      notes: "Demo customer created to validate role-based order visibility."
    },
    create: {
      companyId: company.id,
      consultantProfileId: consultant.id,
      partnerProfileId: null,
      groupLeaderProfileId: consultant.groupLeaderProfileId,
      email: customerEmail,
      firstName: "Mariana",
      lastName: "Rivera",
      phone: "7875550198",
      pipelineStage: "CART_BUILT",
      pipelineUpdatedAt: new Date(),
      notes: "Demo customer created to validate role-based order visibility."
    }
  });

  const quantity = 1;
  const subtotalCents = product.priceCents * quantity;
  const order = await prisma.order.create({
    data: {
      companyId: company.id,
      customerId: customer.id,
      consultantProfileId: consultant.id,
      partnerProfileId: null,
      groupLeaderProfileId: consultant.groupLeaderProfileId,
      subtotalCents,
      totalCents: subtotalCents,
      paymentProviderCode: "authorize_net",
      paymentStatus: "PENDING",
      orderStatus: "PENDING",
      commissionStatus: "PENDING",
      referralSource: "demo_consultant_order",
      referralMetadata: {
        source: "demo_seed",
        customerName: "Mariana Rivera",
        assignedConsultantEmail: consultant.user.email
      },
      items: {
        create: {
          productId: product.id,
          quantity,
          unitPriceCents: product.priceCents,
          totalCents: subtotalCents
        }
      }
    }
  });

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      lifetimeValueCents: { increment: subtotalCents },
      lastPurchaseAt: new Date()
    }
  });

  const split = await createMarginCommissionLedger({
    prisma,
    orderId: order.id,
    commissionMode: "CONSULTANT_PARTNER_SPLIT"
  });

  console.log(JSON.stringify({
    orderId: order.id,
    customer: customerEmail,
    consultant: consultant.user.email,
    product: product.title,
    totalCents: subtotalCents,
    grossMarginCents: split.grossMarginCents,
    commissionPoolCents: split.commissionPoolCents
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
