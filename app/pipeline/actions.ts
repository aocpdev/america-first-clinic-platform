"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { isCustomerPipelineStage } from "@/lib/sales/pipeline";

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry.trim() : "";
}

export async function updateCustomerPipelineStage(formData: FormData) {
  const user = await requireUser();
  const customerId = value(formData, "customerId");
  const stage = value(formData, "pipelineStage");

  if (!customerId || !isCustomerPipelineStage(stage)) {
    redirect("/login?error=invalid_pipeline_update");
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      consultantProfile: {
        select: {
          id: true,
          partnerProfileId: true
        }
      },
      partnerProfile: {
        select: { id: true }
      }
    }
  });

  if (!customer || customer.companyId !== user.companyId) {
    redirect("/login?error=access_denied");
  }

  if (user.role === "CONSULTANT") {
    if (!user.consultantProfile?.id || customer.consultantProfileId !== user.consultantProfile.id) {
      redirect("/login?error=access_denied");
    }
  } else if (user.role === "PARTNER") {
    const partnerProfile = await prisma.partnerProfile.findUnique({ where: { userId: user.id } });
    if (!partnerProfile || (customer.partnerProfileId !== partnerProfile.id && customer.consultantProfile?.partnerProfileId !== partnerProfile.id)) {
      redirect("/login?error=access_denied");
    }
  } else if (user.role !== "COMPANY_ADMIN" && user.role !== "SUPER_ADMIN") {
    redirect("/login?error=access_denied");
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      pipelineStage: stage,
      pipelineUpdatedAt: new Date()
    }
  });

  await prisma.activityLog.create({
    data: {
      companyId: customer.companyId,
      userId: user.id,
      customerId: customer.id,
      action: "CUSTOMER_PIPELINE_STAGE_UPDATED",
      metadata: {
        pipelineStage: stage
      }
    }
  });

  revalidatePath("/consultant/pipeline");
  revalidatePath("/partner/pipeline");
  revalidatePath("/admin/pipeline");
  revalidatePath("/admin/customers");
}
