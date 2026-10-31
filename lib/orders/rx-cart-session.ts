import { cookies } from "next/headers";
import { decodeRxCart, encodeRxCart, RX_CART_COOKIE, type RxCart } from "./rx-cart";

export async function readRxCart(companyId: string) {
  return decodeRxCart((await cookies()).get(RX_CART_COOKIE)?.value, companyId);
}
export async function saveRxCart(cart: RxCart, base: string) {
  // Session-only, host-only, HttpOnly. No identity, address, price, margin or referral is stored here.
  (await cookies()).set(RX_CART_COOKIE, encodeRxCart(cart), {
    httpOnly: true, secure: process.env.NODE_ENV === "production" || base === "",
    sameSite: "lax", path: base || "/"
  });
}
