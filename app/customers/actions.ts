"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireApprovedConsultant, requirePartner, requireRole, requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { normalizePhoneToE164 } from "@/lib/phone";
import { isCustomerPipelineStage } from "@/lib/sales/pipeline";

const customerSchema = z.object({
  customerId: z.string().uuid().optional(),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().optional(),
  email: z.string().trim().email(),
  phone: z.string().trim().optional().transform((value) => normalizePhoneToE164(value)),
  dateOfBirth: z.string().trim().optional(),
  birthSex: z.enum(["", "MALE", "FEMALE", "PREFER_NOT_TO_SAY"]).optional(),
  pipelineStage: z.string().trim().optional(),
  tags: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  returnTo: z.string().trim().optional()
});

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalDate(value?: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function tagsFromInput(value?: string) {
  return String(value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function roleBasePath(role: string) {
  if (role === "COMPANY_ADMIN" || role === "SUPER_ADMIN") return "/admin/customers";
  if (role === "CONSULTANT") return "/consultant/customers";
  return "/partner/customers";
}

function cleanReturnTo(value: string | undefined, fallback: string) {
  if (!value || !value.startsWith("/")) return fallback;
  return value;
}

async function customerScope() {
  const user = await requireUser();

  if (user.role === "COMPANY_ADMIN" || user.role === "SUPER_ADMIN") {
    const admin = await requireRole("COMPANY_ADMIN");
    if (!admin.companyId) redirect("/admin/customers?error=missing_company");
    return {
      user: admin,
      companyId: admin.companyId,
      basePath: "/admin/customers",
      createData: {},
      where: { companyId: admin.companyId }
    };
  }

  if (user.role === "CONSULTANT") {
    const consultant = await requireApprovedConsultant();
    if (!consultant.companyId || !consultant.consultantProfile) redirect("/consultant/customers?error=missing_profile");
    return {
      user: consultant,
      companyId: consultant.companyId,
      basePath: "/consultant/customers",
      createData: {
        consultantProfileId: consultant.consultantProfile.id,
        partnerProfileId: consultant.consultantProfile.partnerProfileId,
        groupLeaderProfileId: consultant.consultantProfile.groupLeaderProfileId
      },
      where: { companyId: consultant.companyId, consultantProfileId: consultant.consultantProfile.id }
    };
  }

  const partnerUser = await requirePartner();
  const partnerProfile = await prisma.partnerProfile.findUnique({ where: { userId: partnerUser.id } });
  const groupLeaderProfile = await prisma.groupLeaderProfile.findUnique({ where: { userId: partnerUser.id } });

  if (!partnerUser.companyId || (!partnerProfile && !groupLeaderProfile)) {
    redirect("/partner/customers?error=missing_profile");
  }

  if (partnerProfile) {
    return {
      user: partnerUser,
      companyId: partnerUser.companyId!,
      basePath: "/partner/customers",
      createData: { partnerProfileId: partnerProfile.id },
      where: {
        companyId: partnerUser.companyId!,
        OR: [
          { partnerProfileId: partnerProfile.id },
          { consultantProfile: { partnerProfileId: partnerProfile.id } },
          { groupLeaderProfile: { partnerProfileId: partnerProfile.id } }
        ]
      }
    };
  }

  return {
    user: partnerUser,
    companyId: partnerUser.companyId!,
    basePath: "/partner/customers",
    createData: {
      partnerProfileId: groupLeaderProfile!.partnerProfileId,
      groupLeaderProfileId: groupLeaderProfile!.id
    },
    where: {
      companyId: partnerUser.companyId!,
      OR: [
        { groupLeaderProfileId: groupLeaderProfile!.id },
        { consultantProfile: { groupLeaderProfileId: groupLeaderProfile!.id } }
      ]
    }
  };
}

async function assertEmailAvailable(companyId: string, email: string, customerId?: string) {
  const existing = await prisma.customer.findUnique({
    where: { companyId_email: { companyId, email } },
    select: { id: true }
  });

  if (existing && existing.id !== customerId) {
    redirect(`${roleBasePath((await requireUser()).role)}?error=duplicate_customer_email`);
  }
}

export async function createCustomer(formData: FormData) {
  const scope = await customerScope();
  const parsed = customerSchema.parse({
    firstName: formValue(formData, "firstName"),
    lastName: formValue(formData, "lastName"),
    email: formValue(formData, "email"),
    phone: formValue(formData, "phone"),
    dateOfBirth: formValue(formData, "dateOfBirth"),
    birthSex: formValue(formData, "birthSex"),
    pipelineStage: formValue(formData, "pipelineStage"),
    tags: formValue(formData, "tags"),
    notes: formValue(formData, "notes"),
    returnTo: formValue(formData, "returnTo")
  });
  const email = parsed.email.toLowerCase();
  const pipelineStage = parsed.pipelineStage && isCustomerPipelineStage(parsed.pipelineStage) ? parsed.pipelineStage : "NEW_LEAD";

  await assertEmailAvailable(scope.companyId, email);
  const customer = await prisma.customer.create({
    data: {
      companyId: scope.companyId,
      ...scope.createData,
      firstName: parsed.firstName,
      lastName: parsed.lastName || null,
      email,
      phone: parsed.phone,
      dateOfBirth: optionalDate(parsed.dateOfBirth),
      birthSex: parsed.birthSex || null,
      pipelineStage,
      pipelineUpdatedAt: new Date(),
      tags: tagsFromInput(parsed.tags),
      notes: parsed.notes || null
    }
  });

  revalidatePath(scope.basePath);
  redirect(`${scope.basePath}/${customer.id}?created=1`);
}

export async function updateCustomer(formData: FormData) {
  const scope = await customerScope();
  const parsed = customerSchema.parse({
    customerId: formValue(formData, "customerId"),
    firstName: formValue(formData, "firstName"),
    lastName: formValue(formData, "lastName"),
    email: formValue(formData, "email"),
    phone: formValue(formData, "phone"),
    dateOfBirth: formValue(formData, "dateOfBirth"),
    birthSex: formValue(formData, "birthSex"),
    pipelineStage: formValue(formData, "pipelineStage"),
    tags: formValue(formData, "tags"),
    notes: formValue(formData, "notes"),
    returnTo: formValue(formData, "returnTo")
  });

  if (!parsed.customerId) redirect(`${scope.basePath}?error=missing_customer`);
  const existing = await prisma.customer.findFirst({
    where: { id: parsed.customerId, ...scope.where },
    select: { id: true }
  });
  if (!existing) redirect(`${scope.basePath}?error=customer_not_found`);

  const email = parsed.email.toLowerCase();
  const pipelineStage = parsed.pipelineStage && isCustomerPipelineStage(parsed.pipelineStage) ? parsed.pipelineStage : "NEW_LEAD";

  await assertEmailAvailable(scope.companyId, email, parsed.customerId);
  await prisma.customer.update({
    where: { id: parsed.customerId },
    data: {
      firstName: parsed.firstName,
      lastName: parsed.lastName || null,
      email,
      phone: parsed.phone,
      dateOfBirth: optionalDate(parsed.dateOfBirth),
      birthSex: parsed.birthSex || null,
      pipelineStage,
      pipelineUpdatedAt: new Date(),
      tags: tagsFromInput(parsed.tags),
      notes: parsed.notes || null
    }
  });

  const returnTo = cleanReturnTo(parsed.returnTo, `${scope.basePath}/${parsed.customerId}`);
  revalidatePath(scope.basePath);
  revalidatePath(returnTo);
  redirect(`${returnTo}?updated=customer`);
}

export async function deleteCustomer(formData: FormData) {
  const scope = await customerScope();
  const customerId = formValue(formData, "customerId");
  if (!customerId) redirect(`${scope.basePath}?error=missing_customer`);

  const existing = await prisma.customer.findFirst({
    where: { id: customerId, ...scope.where },
    select: { id: true }
  });
  if (!existing) redirect(`${scope.basePath}?error=customer_not_found`);

  const orders = await prisma.order.findMany({
    where: { customerId },
    select: { id: true }
  });
  const orderIds = orders.map((order) => order.id);

  await prisma.$transaction([
    prisma.webhookDelivery.deleteMany({
      where: {
        OR: [
          { payload: { path: ["customerId"], equals: customerId } },
          ...orderIds.map((orderId) => ({ payload: { path: ["orderId"], equals: orderId } }))
        ]
      }
    }),
    prisma.paymentTransaction.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.commissionSplit.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.commission.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.subscription.deleteMany({ where: { OR: [{ customerId }, { orderId: { in: orderIds } }] } }),
    prisma.paymentMethod.deleteMany({ where: { customerId } }),
    prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } }),
    prisma.order.deleteMany({ where: { id: { in: orderIds } } }),
    prisma.activityLog.deleteMany({ where: { customerId } }),
    prisma.customer.delete({ where: { id: customerId } })
  ]);

  revalidatePath(scope.basePath);
  redirect(`${scope.basePath}?deleted=customer`);
}
