import { z } from "zod";

export const roleSchema = z.enum(["SUPER_ADMIN", "COMPANY_ADMIN", "PARTNER", "GROUP_LEADER", "MANAGER", "CONSULTANT", "CUSTOMER"]);

export const productSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(10),
  categoryId: z.string().uuid(),
  priceCents: z.number().int().positive(),
  internalCostCents: z.number().int().nonnegative(),
  sku: z.string().min(2),
  inventoryQuantity: z.number().int().nonnegative(),
  supportsSubscription: z.boolean(),
  active: z.boolean()
});

export const orderSchema = z.object({
  customerId: z.string().uuid(),
  consultantProfileId: z.string().uuid().optional(),
  paymentProviderCode: z.enum(["stripe", "authorize_net", "nmi", "ach"]),
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().positive() })).min(1)
});

export const referralSchema = z.object({
  consultantSlug: z.string().min(3).regex(/^[a-z0-9-]+$/),
  referralCode: z.string().min(3).max(24)
});
