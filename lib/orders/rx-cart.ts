import { z } from "zod";

export const RX_CART_COOKIE = "gvh_rx_cart_v1";
const itemSchema = z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(100) }).strict();
export const rxCartSchema = z.object({ version: z.literal(1), companyId: z.string().uuid(), items: z.array(itemSchema).max(25), couponCode: z.string().max(64) }).strict()
  .refine(cart => new Set(cart.items.map(item => item.productId)).size === cart.items.length);
export type RxCart = z.infer<typeof rxCartSchema>;

export function emptyRxCart(companyId: string): RxCart { return { version: 1, companyId, items: [], couponCode: "" }; }
export function decodeRxCart(value: string | undefined, companyId: string): RxCart {
  if (!value || value.length > 3800 || !/^[A-Za-z0-9_-]+$/.test(value)) return emptyRxCart(companyId);
  try {
    const result = rxCartSchema.safeParse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    return result.success && result.data.companyId === companyId ? result.data : emptyRxCart(companyId);
  } catch { return emptyRxCart(companyId); }
}
export function encodeRxCart(cart: RxCart) {
  const encoded = Buffer.from(JSON.stringify(rxCartSchema.parse(cart))).toString("base64url");
  if (encoded.length > 3800) throw new Error("CART_LIMIT");
  return encoded;
}
export function updateRxCart(cart: RxCart, productId: string, quantity: number, operation: "add" | "set" | "remove"): RxCart {
  z.string().uuid().parse(productId);
  const current = rxCartSchema.parse(cart);
  const existing = current.items.find(item => item.productId === productId);
  const items = current.items.filter(item => item.productId !== productId);
  if (operation !== "remove") {
    z.number().int().min(1).max(100).parse(quantity);
    if (operation === "set" && !existing) throw new Error("PRODUCT_UNAVAILABLE");
    const nextQuantity = operation === "add" ? (existing?.quantity ?? 0) + quantity : quantity;
    items.push(itemSchema.parse({ productId, quantity: nextQuantity }));
  }
  if (items.length > 25) throw new Error("CART_LIMIT");
  // Keep product order stable after quantity changes.
  items.sort((a, b) => {
    const index = (id: string) => { const value = current.items.findIndex(item => item.productId === id); return value < 0 ? current.items.length : value; };
    return index(a.productId) - index(b.productId);
  });
  return { ...current, items, couponCode: items.length ? current.couponCode : "" };
}
