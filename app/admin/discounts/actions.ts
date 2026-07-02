"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { normalizeDiscountCode, normalizeDiscountFundingStrategy } from "@/lib/discounts/calculations";

function cents(value: FormDataEntryValue | null) {
  const amount = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function bps(value: FormDataEntryValue | null) {
  const percent = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(percent) ? Math.round(percent * 100) : 0;
}

function optionalDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function selectedValues(formData: FormData, key: string) {
  return formData.getAll(key).map(String).filter(Boolean);
}

const discountSchema = z.object({
  name: z.string().trim().min(2),
  code: z.string().trim().min(2),
  discountType: z.enum(["PERCENT", "AMOUNT"]),
  valueBps: z.number().int().min(0).max(10000),
  amountCents: z.number().int().min(0),
  minSubtotalCents: z.number().int().min(0),
  ownerProtectedProfitCents: z.number().int().min(0),
  fundingStrategy: z.enum(["ORIGINATOR_FUNDED", "PARTNER_FUNDED", "COMPANY_FUNDED", "SHARED_POOL"]),
  maxRedemptions: z.number().int().positive().nullable(),
  startsAt: z.date().nullable(),
  endsAt: z.date().nullable(),
  affectsCommissions: z.boolean(),
  active: z.boolean(),
  productIds: z.array(z.string()),
  categoryNames: z.array(z.string())
});

async function requireCompanyId() {
  const user = await requireRole("COMPANY_ADMIN");
  if (!user.companyId) redirect("/admin/discounts?error=missing_company");
  return user.companyId;
}

function parseDiscount(formData: FormData) {
  const rawMax = String(formData.get("maxRedemptions") ?? "").trim();
  const fundingStrategy = normalizeDiscountFundingStrategy(formData.get("fundingStrategy"));
  return discountSchema.parse({
    name: formData.get("name"),
    code: normalizeDiscountCode(String(formData.get("code") ?? "")),
    discountType: formData.get("discountType"),
    valueBps: bps(formData.get("valuePercent")),
    amountCents: cents(formData.get("amount")),
    minSubtotalCents: cents(formData.get("minSubtotal")),
    ownerProtectedProfitCents: cents(formData.get("ownerProtectedProfit")),
    fundingStrategy,
    maxRedemptions: rawMax ? Number(rawMax) : null,
    startsAt: optionalDate(formData.get("startsAt")),
    endsAt: optionalDate(formData.get("endsAt")),
    affectsCommissions: fundingStrategy !== "COMPANY_FUNDED",
    active: formData.get("active") === "on",
    productIds: selectedValues(formData, "productIds"),
    categoryNames: []
  });
}

export async function createDiscount(formData: FormData) {
  const companyId = await requireCompanyId();
  const parsed = parseDiscount(formData);

  await prisma.discount.create({
    data: {
      companyId,
      ...parsed
    }
  });

  revalidatePath("/admin/discounts");
}

export async function updateDiscount(formData: FormData) {
  const companyId = await requireCompanyId();
  const discountId = String(formData.get("discountId") ?? "");
  const parsed = parseDiscount(formData);

  await prisma.discount.updateMany({
    where: { id: discountId, companyId },
    data: parsed
  });

  revalidatePath("/admin/discounts");
}

export async function toggleDiscount(formData: FormData) {
  const companyId = await requireCompanyId();
  const discountId = String(formData.get("discountId") ?? "");
  const active = formData.get("active") === "true";

  await prisma.discount.updateMany({
    where: { id: discountId, companyId },
    data: { active }
  });

  revalidatePath("/admin/discounts");
}

export async function deleteDiscount(formData: FormData) {
  const companyId = await requireCompanyId();
  const discountId = String(formData.get("discountId") ?? "");

  await prisma.discount.deleteMany({
    where: { id: discountId, companyId, redemptionCount: 0 }
  });

  revalidatePath("/admin/discounts");
}
