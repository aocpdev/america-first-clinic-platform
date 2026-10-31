export function rxReviewInput(params: { quantity?: unknown; coupon?: unknown }) {
  const validQuantity = params.quantity === undefined ||
    (typeof params.quantity === "string" && /^\d{1,3}$/.test(params.quantity) && Number(params.quantity) >= 1 && Number(params.quantity) <= 100);
  const validCoupon = params.coupon === undefined || (typeof params.coupon === "string" && params.coupon.length <= 64);
  return {
    quantity: validQuantity && params.quantity !== undefined ? Number(params.quantity) : 1,
    coupon: validCoupon && typeof params.coupon === "string" ? params.coupon.trim() : "",
    error: !validQuantity ? "Choose a whole quantity between 1 and 100." :
      !validCoupon ? "Enter a coupon of no more than 64 characters." : null
  };
}
