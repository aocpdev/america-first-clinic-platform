"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRxCompany, rxBasePath } from "@/lib/products/rx-catalog";
import { readCatalog } from "@/lib/products/catalog-reader";
import { readRxCart, saveRxCart } from "@/lib/orders/rx-cart-session";
import { updateRxCart } from "@/lib/orders/rx-cart";
import { rxShopProductWhere } from "@/lib/products/rx-telehealth";

async function mutate(formData: FormData, operation: "add" | "set" | "remove") {
  const company = await requireRxCompany();
  const base = await rxBasePath();
  let notice = operation === "add" ? "added" : operation === "remove" ? "removed" : "updated";
  try {
    const productId = z.string().uuid().parse(formData.get("productId"));
    const quantityText = operation === "remove" ? "1" : formData.get("quantity");
    if (typeof quantityText !== "string" || !/^\d{1,3}$/.test(quantityText) || Number(quantityText) < 1 || Number(quantityText) > 100) throw new Error("INVALID_QUANTITY");
    if (operation !== "remove") {
      const product = await readCatalog(company.id, (db, companyId) => db.product.findFirst({ where: { ...rxShopProductWhere(companyId), id: productId }, select: { id: true, priceCents: true } }));
      if (!product || product.priceCents <= 0) throw new Error("PRODUCT_UNAVAILABLE");
    }
    await saveRxCart(updateRxCart(await readRxCart(company.id), productId, Number(quantityText), operation), base);
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof Error && ["INVALID_QUANTITY", "CART_LIMIT"].includes(error.message)) notice = "limit";
    else if (error instanceof Error && error.message === "PRODUCT_UNAVAILABLE") notice = "unavailable";
    else throw error;
  }
  revalidatePath("/rx", "layout");
  redirect(`${base}/cart?notice=${notice}#cart`);
}
export async function addToCart(formData: FormData) { return mutate(formData, "add"); }
export async function setCartQuantity(formData: FormData) { return mutate(formData, "set"); }
export async function removeCartItem(formData: FormData) { return mutate(formData, "remove"); }
export async function applyCartCoupon(formData: FormData) {
  const company = await requireRxCompany();
  const base = await rxBasePath();
  const code = formData.get("coupon");
  if (typeof code !== "string" || code.length > 64) redirect(`${base}/cart?notice=coupon#cart`);
  const cart = await readRxCart(company.id);
  await saveRxCart({ ...cart, couponCode: code.trim() }, base);
  revalidatePath("/rx", "layout");
  redirect(`${base}/cart#cart`);
}
