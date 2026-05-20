"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePartner, requireRole } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import type { PaymentProviderCode } from "@/lib/payments/types";

const providerCodes = ["stripe", "authorize_net", "nmi", "ach"] as const;
const webhookEvents = [
  "customer.created",
  "order.created",
  "invoice.requested",
  "payment.succeeded",
  "payment.failed",
  "receipt.ready",
  "receipt.resend_requested",
  "password.reset.requested",
  "consultant.approved",
  "consultant.rejected",
  "commission.generated",
  "subscription.created",
  "subscription.payment_failed"
] as const;

const providerLabels: Record<PaymentProviderCode, string> = {
  stripe: "Stripe",
  authorize_net: "Authorize.net",
  nmi: "NMI",
  ach: "ACH"
};

const paymentSettingsSchema = z.object({
  providerCode: z.enum(providerCodes),
  mode: z.enum(["test", "live"]),
  saveCards: z.boolean(),
  collectInsideCrm: z.boolean(),
  sendInvoiceLinks: z.boolean()
});

const webhookSchema = z.object({
  name: z.string().min(2),
  url: z.string().url(),
  events: z.array(z.enum(webhookEvents)).min(1)
});

async function requireAdminCompanyId() {
  const user = await requireRole("COMPANY_ADMIN");
  if (!user.companyId) redirect("/admin/settings?error=missing_company");
  return user.companyId;
}

function formBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function formEvents(formData: FormData) {
  return formData.getAll("events").map(String);
}

export async function updatePaymentSettings(formData: FormData) {
  const companyId = await requireAdminCompanyId();
  const parsed = paymentSettingsSchema.parse({
    providerCode: formData.get("providerCode"),
    mode: formData.get("mode"),
    saveCards: formBoolean(formData, "saveCards"),
    collectInsideCrm: formBoolean(formData, "collectInsideCrm"),
    sendInvoiceLinks: formBoolean(formData, "sendInvoiceLinks")
  });

  await prisma.$transaction([
    prisma.paymentProvider.updateMany({
      where: { companyId },
      data: {
        active: false,
        isDefault: false
      }
    }),
    prisma.paymentProvider.upsert({
      where: {
        companyId_code: {
          companyId,
          code: parsed.providerCode
        }
      },
      create: {
        companyId,
        code: parsed.providerCode,
        label: providerLabels[parsed.providerCode],
        active: true,
        isDefault: true,
        mode: parsed.mode,
        config: {
          saveCards: parsed.saveCards,
          collectInsideCrm: parsed.collectInsideCrm,
          sendInvoiceLinks: parsed.sendInvoiceLinks
        }
      },
      update: {
        label: providerLabels[parsed.providerCode],
        active: true,
        isDefault: true,
        mode: parsed.mode,
        config: {
          saveCards: parsed.saveCards,
          collectInsideCrm: parsed.collectInsideCrm,
          sendInvoiceLinks: parsed.sendInvoiceLinks
        }
      }
    })
  ]);

  revalidatePath("/admin/settings");
}

export async function createAdminWebhookEndpoint(formData: FormData) {
  const companyId = await requireAdminCompanyId();
  const parsed = webhookSchema.parse({
    name: formData.get("name"),
    url: formData.get("url"),
    events: formEvents(formData)
  });

  await prisma.webhookEndpoint.create({
    data: {
      companyId,
      name: parsed.name.trim(),
      url: parsed.url,
      events: parsed.events,
      secret: `whsec_${randomBytes(24).toString("hex")}`
    }
  });

  revalidatePath("/admin/settings");
}

export async function createPartnerWebhookEndpoint(formData: FormData) {
  const user = await requirePartner();
  if (user.role !== "PARTNER" || !user.companyId || !user.partnerProfile) {
    redirect("/partner/settings?error=access_denied");
  }
  const parsed = webhookSchema.parse({
    name: formData.get("name"),
    url: formData.get("url"),
    events: formEvents(formData)
  });

  await prisma.webhookEndpoint.create({
    data: {
      companyId: user.companyId,
      partnerProfileId: user.partnerProfile.id,
      name: parsed.name.trim(),
      url: parsed.url,
      events: parsed.events,
      secret: `whsec_${randomBytes(24).toString("hex")}`
    }
  });

  revalidatePath("/partner/settings");
}

export async function toggleWebhookEndpoint(formData: FormData) {
  const scope = String(formData.get("scope") || "admin");
  const endpointId = String(formData.get("endpointId") || "");
  const nextActive = formData.get("nextActive") === "true";

  if (scope === "partner") {
    const user = await requirePartner();
    if (user.role !== "PARTNER" || !user.partnerProfile) {
      redirect("/partner/settings?error=access_denied");
    }
    await prisma.webhookEndpoint.updateMany({
      where: {
        id: endpointId,
        partnerProfileId: user.partnerProfile.id
      },
      data: { isActive: nextActive }
    });
    revalidatePath("/partner/settings");
    return;
  }

  const companyId = await requireAdminCompanyId();
  await prisma.webhookEndpoint.updateMany({
    where: {
      id: endpointId,
      companyId
    },
    data: { isActive: nextActive }
  });
  revalidatePath("/admin/settings");
}

export async function updateWebhookEndpoint(formData: FormData) {
  const scope = String(formData.get("scope") || "admin");
  const endpointId = String(formData.get("endpointId") || "");
  const parsed = webhookSchema.parse({
    name: formData.get("name"),
    url: formData.get("url"),
    events: formEvents(formData)
  });

  if (scope === "partner") {
    const user = await requirePartner();
    if (user.role !== "PARTNER" || !user.partnerProfile) {
      redirect("/partner/settings?error=access_denied");
    }
    await prisma.webhookEndpoint.updateMany({
      where: {
        id: endpointId,
        partnerProfileId: user.partnerProfile.id
      },
      data: {
        name: parsed.name.trim(),
        url: parsed.url,
        events: parsed.events
      }
    });
    revalidatePath("/partner/settings");
    return;
  }

  const companyId = await requireAdminCompanyId();
  await prisma.webhookEndpoint.updateMany({
    where: {
      id: endpointId,
      companyId
    },
    data: {
      name: parsed.name.trim(),
      url: parsed.url,
      events: parsed.events
    }
  });
  revalidatePath("/admin/settings");
}
