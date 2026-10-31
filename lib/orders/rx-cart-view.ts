import { readCatalog } from "../products/catalog-reader";
import { rxProductSelect } from "../products/rx-catalog";
import { loadRxQuote } from "./rx-quote-service";
import { readRxCart } from "./rx-cart-session";
import { isRxClinicalService } from "../products/rx-telehealth";

export async function loadRxCartView(companyId: string) {
  const cart = await readRxCart(companyId);
  return readCatalog(companyId, async (db, catalogCompanyId) => {
    const products = cart.items.length ? await db.product.findMany({ where: { companyId: catalogCompanyId, id: { in: cart.items.map(item => item.productId) } }, select: { ...rxProductSelect, active: true } }) : [];
    const lines = cart.items.map(item => ({ ...item, product: products.find(product => product.id === item.productId) ?? null }));
    let quote: Awaited<ReturnType<typeof loadRxQuote>>["publicQuote"] | null = null;
    let warning: string | null = null;
    if (lines.some(line => !line.product?.active)) warning = "One or more products are no longer available. Remove them before continuing.";
    else if (lines.some(line => line.product && isRxClinicalService(line.product.category.name))) warning = "Clinical services now have a separate Telehealth experience. Remove this service from your cart and explore Telehealth from the home page.";
    else if (cart.items.length) {
      const intent = { items: cart.items, couponCode: cart.couponCode };
      try { quote = (await loadRxQuote(db, catalogCompanyId, intent)).publicQuote; }
      catch (error) {
        if (error instanceof Error && ["INVALID_DISCOUNT", "DISCOUNT_NOT_APPLICABLE"].includes(error.message)) {
          warning = "This coupon is unavailable or does not apply to your cart. No discount has been applied.";
          quote = (await loadRxQuote(db, catalogCompanyId, { ...intent, couponCode: "" })).publicQuote;
        } else if (error instanceof Error && ["INVALID_PRODUCT_PRICE", "INVALID_ORDER_TOTAL", "PRODUCT_UNAVAILABLE"].includes(error.message)) {
          warning = "We cannot confirm pricing for this selection. Please update your cart before continuing.";
        } else throw error;
      }
    }
    return { cart, lines, quote, warning };
  });
}
